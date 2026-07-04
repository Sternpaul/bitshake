import { query } from '../db.js';
import { getSolarData } from '../mqtt-bridge.js';

/**
 * Register stats routes.
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function statsRoutes(fastify) {
  // All stats routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/stats/overview — Dashboard KPI summary
  fastify.get('/api/stats/overview', async (request, reply) => {
    try {
      // Fetch settings for cost calculations
      const settingsResult = await query(
        `SELECT key, value FROM settings WHERE key IN ('electricity_price', 'feedin_tariff', 'currency', 'enable_feedin_tariff')`
      );
      const settings = {};
      settingsResult.rows.forEach(r => { settings[r.key] = r.value; });

      const electricityPrice = parseFloat(settings.electricity_price || '0.35');
      const feedinTariff = parseFloat(settings.feedin_tariff || '0.00');
      const currency = settings.currency || 'EUR';
      const enableFeedinTariff = settings.enable_feedin_tariff === 'true';

      // Latest reading
      const latestResult = await query(
        `SELECT time, total_import, total_export, power_current, power_l1, power_l2, power_l3, 
                solar_power, solar_energy_daily, solar_energy_total,
                solar_estimated_power, solar_estimated_daily, solar_estimated_total
         FROM meter_readings ORDER BY time DESC LIMIT 1`
      );

      // Today's summary
      const todayResult = await query(`
        SELECT 
          MAX(power_current) as peak_power,
          LAST(total_import, time) - FIRST(total_import, time) as consumed_kwh,
          LAST(total_export, time) - FIRST(total_export, time) as exported_kwh,
          LAST(solar_energy_total, time) - FIRST(solar_energy_total, time) as generated_kwh,
          LAST(solar_estimated_total, time) - FIRST(solar_estimated_total, time) as generated_estimated_kwh
        FROM meter_readings 
        WHERE time >= CURRENT_DATE
      `);

      // This week's consumption and feed-in
      const weekResult = await query(
        `SELECT
           COALESCE(SUM(consumed_kwh), 0) AS consumed_week,
           COALESCE(SUM(exported_kwh), 0) AS exported_week,
           COALESCE(SUM(generated_kwh), 0) AS generated_week
         FROM daily_energy
         WHERE bucket >= date_trunc('week', NOW())`
      );

      // This month's consumption and feed-in
      const monthResult = await query(
        `SELECT
           COALESCE(SUM(consumed_kwh), 0) AS consumed_month,
           COALESCE(SUM(exported_kwh), 0) AS exported_month,
           COALESCE(SUM(generated_kwh), 0) AS generated_month
         FROM daily_energy
         WHERE bucket >= date_trunc('month', NOW())`
      );

      const latest = latestResult.rows[0] || null;
      const todayData = todayResult.rows[0] || {};
      const week = weekResult.rows[0] || {};
      const month = monthResult.rows[0] || {};

      return reply.send({
        current: latest ? {
          power: latest.power_current,
          power_l1: latest.power_l1,
          power_l2: latest.power_l2,
          power_l3: latest.power_l3,
          total_import: latest.total_import,
          total_export: latest.total_export,
          solar_power: latest.solar_power,
          solar_estimated_power: latest.solar_estimated_power,
          timestamp: latest.time,
        } : null,
        today: todayData ? {
          consumed_kwh: parseFloat(todayData.consumed_kwh || 0),
          exported_kwh: parseFloat(todayData.exported_kwh || 0),
          generated_kwh: parseFloat(todayData.generated_kwh || 0),
          generated_estimated_kwh: parseFloat(todayData.generated_estimated_kwh || 0),
          net_balance_kwh: parseFloat(todayData.exported_kwh || 0) - parseFloat(todayData.consumed_kwh || 0),
          peak_power: parseFloat(todayData.peak_power || 0),
          cost: parseFloat(todayData.consumed_kwh || 0) * electricityPrice,
          earnings: enableFeedinTariff ? parseFloat(todayData.exported_kwh || 0) * feedinTariff : 0,
        } : null,
        week: {
          consumed_kwh: parseFloat(week.consumed_week || 0),
          exported_kwh: parseFloat(week.exported_week || 0),
          generated_kwh: parseFloat(week.generated_week || 0),
          cost: parseFloat(week.consumed_week || 0) * electricityPrice,
          earnings: parseFloat(week.exported_week || 0) * feedinTariff,
        },
        month: {
          consumed_kwh: parseFloat(month.consumed_month || 0),
          exported_kwh: parseFloat(month.exported_month || 0),
          generated_kwh: parseFloat(month.generated_month || 0),
          cost: parseFloat(month.consumed_month || 0) * electricityPrice,
          earnings: parseFloat(month.exported_month || 0) * feedinTariff,
        },
        inverter_stats: getSolarData(),
        settings: {
          electricity_price: electricityPrice,
          feedin_tariff: feedinTariff,
          enable_feedin_tariff: enableFeedinTariff,
          currency,
        },
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to compute overview stats' });
    }
  });

  // GET /api/stats/hourly-profile — Average power per hour of the day
  fastify.get('/api/stats/hourly-profile', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
        },
      },
    },
  }, async (request, reply) => {
    const { days } = request.query;

    try {
      const result = await query(
        `SELECT
           EXTRACT(HOUR FROM time) AS hour_of_day,
           AVG(power_current) FILTER (WHERE power_current > 0) AS avg_consumption_w,
           ABS(AVG(power_current) FILTER (WHERE power_current < 0)) AS avg_export_w
         FROM meter_readings
         WHERE time >= NOW() - $1::interval
         GROUP BY hour_of_day
         ORDER BY hour_of_day ASC`,
        [`${days} days`]
      );

      // Ensure all 24 hours are present in the response
      const dataMap = new Map(result.rows.map(r => [Number(r.hour_of_day), r]));
      
      const full24Hours = Array.from({ length: 24 }, (_, i) => {
        const row = dataMap.get(i);
        return {
          hour: i,
          hour_label: `${String(i).padStart(2, '0')}:00`,
          avg_consumption_w: parseFloat(row?.avg_consumption_w || 0),
          avg_export_w: parseFloat(row?.avg_export_w || 0),
        };
      });

      return reply.send({ data: full24Hours });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to compute hourly profile' });
    }
  });

  // GET /api/stats/compare — Compare current period to previous period
  fastify.get('/api/stats/compare', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['24h', '7d', '30d', '1y'], default: '7d' },
        },
      },
    },
  }, async (request, reply) => {
    const { range } = request.query;
    let days = 7;
    if (range === '24h') days = 1;
    if (range === '30d') days = 30;
    if (range === '1y') days = 365;

    try {
      const comparisonResult = await query(`
        SELECT 
          SUM(consumed_kwh) as period1_consumed,
          SUM(exported_kwh) as period1_exported,
          SUM(generated_kwh) as period1_generated,
          SUM(generated_estimated_kwh) as period1_generated_estimated
        FROM daily_energy
        WHERE bucket >= NOW() - $1::interval AND bucket < NOW()
      `, [`${days} days`]);
      
      const previousPeriodResult = await query(`
        SELECT 
          SUM(consumed_kwh) as period2_consumed,
          SUM(exported_kwh) as period2_exported,
          SUM(generated_kwh) as period2_generated,
          SUM(generated_estimated_kwh) as period2_generated_estimated
        FROM daily_energy
        WHERE bucket >= NOW() - $1::interval AND bucket < NOW() - $2::interval
      `, [`${days * 2} days`, `${days} days`]);

      const c = comparisonResult.rows[0] || {};
      const p = previousPeriodResult.rows[0] || {};

      const p1c = parseFloat(c.period1_consumed || 0);
      const p2c = parseFloat(p.period2_consumed || 0);
      const trendConsumedPct = p2c > 0 ? ((p1c - p2c) / p2c) * 100 : null;
      
      const p1e = parseFloat(c.period1_exported || 0);
      const p2e = parseFloat(p.period2_exported || 0);
      const trendExportedPct = p2e > 0 ? ((p1e - p2e) / p2e) * 100 : null;
      
      const p1g = parseFloat(c.period1_generated || 0);
      const p2g = parseFloat(p.period2_generated || 0);
      const trendGeneratedPct = p2g > 0 ? ((p1g - p2g) / p2g) * 100 : null;

      const p1ge = parseFloat(c.period1_generated_estimated || 0);
      const p2ge = parseFloat(p.period2_generated_estimated || 0);
      const trendGeneratedEstimatedPct = p2ge > 0 ? ((p1ge - p2ge) / p2ge) * 100 : null;

      return reply.send({
        current: { consumed: p1c, exported: p1e, generated: p1g, generated_estimated: p1ge },
        previous: { consumed: p2c, exported: p2e, generated: p2g, generated_estimated: p2ge },
        trend_consumed_pct: trendConsumedPct,
        trend_exported_pct: trendExportedPct,
        trend_generated_pct: trendGeneratedPct,
        trend_generated_estimated_pct: trendGeneratedEstimatedPct,
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to compute trend comparison' });
    }
  });

  // GET /api/stats/heatmap — Weekly 7x24 Matrix
  fastify.get('/api/stats/heatmap', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
        },
      },
    },
  }, async (request, reply) => {
    const { days } = request.query;

    try {
      const result = await query(
        `SELECT
           EXTRACT(ISODOW FROM time) AS day_of_week,
           EXTRACT(HOUR FROM time) AS hour_of_day,
           AVG(power_current) FILTER (WHERE power_current > 0) AS avg_consumption_w
         FROM meter_readings
         WHERE time >= NOW() - $1::interval
         GROUP BY day_of_week, hour_of_day`,
        [`${days} days`]
      );

      // Create empty 7x24 matrix
      const matrix = Array.from({ length: 7 }, (_, d) =>
        Array.from({ length: 24 }, (_, h) => ({
          day: d + 1,
          hour: h,
          value: 0
        }))
      );

      // Fill matrix
      for (const row of result.rows) {
        const d = Number(row.day_of_week) - 1; // 1-7 -> 0-6
        const h = Number(row.hour_of_day);
        if (d >= 0 && d <= 6 && h >= 0 && h <= 23) {
          matrix[d][h].value = parseFloat(row.avg_consumption_w || 0);
        }
      }

      return reply.send({ data: matrix });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to compute heatmap' });
    }
  });
}
