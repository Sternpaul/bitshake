import { query } from '../db.js';

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
        `SELECT time, total_import, total_export, power_current, power_l1, power_l2, power_l3
         FROM meter_readings ORDER BY time DESC LIMIT 1`
      );

      // Today's consumption and feed-in
      // We use the difference between the last and first total_import/total_export today
      const todayResult = await query(
        `SELECT
           LAST(total_import, time) - FIRST(total_import, time) AS consumed_today,
           LAST(total_export, time) - FIRST(total_export, time) AS exported_today,
           AVG(power_current) AS avg_power_today,
           MAX(power_current) AS peak_power_today,
           MIN(power_current) AS min_power_today,
           COUNT(*) AS readings_today
         FROM meter_readings
         WHERE time >= date_trunc('day', NOW())`
      );

      // This week's consumption and feed-in
      const weekResult = await query(
        `SELECT
           COALESCE(SUM(consumed_kwh), 0) AS consumed_week,
           COALESCE(SUM(exported_kwh), 0) AS exported_week
         FROM daily_energy
         WHERE bucket >= date_trunc('week', NOW())`
      );

      // This month's consumption and feed-in
      const monthResult = await query(
        `SELECT
           COALESCE(SUM(consumed_kwh), 0) AS consumed_month,
           COALESCE(SUM(exported_kwh), 0) AS exported_month
         FROM daily_energy
         WHERE bucket >= date_trunc('month', NOW())`
      );

      const latest = latestResult.rows[0] || null;
      const today = todayResult.rows[0] || {};
      const week = weekResult.rows[0] || {};
      const month = monthResult.rows[0] || {};

      const consumedToday = parseFloat(today.consumed_today || 0);
      const exportedToday = parseFloat(today.exported_today || 0);

      // Net Grid Balance (Netzbilanz)
      // Positive = Net Producer (Export > Import)
      // Negative = Net Consumer (Import > Export)
      const netBalanceKwh = exportedToday - consumedToday;

      return reply.send({
        current: latest ? {
          power: latest.power_current,
          power_l1: latest.power_l1,
          power_l2: latest.power_l2,
          power_l3: latest.power_l3,
          total_import: latest.total_import,
          total_export: latest.total_export,
          timestamp: latest.time,
        } : null,
        today: {
          consumed_kwh: consumedToday,
          exported_kwh: exportedToday,
          avg_power: parseFloat(today.avg_power_today || 0),
          peak_power: parseFloat(today.peak_power_today || 0),
          min_power: parseFloat(today.min_power_today || 0),
          net_balance_kwh: netBalanceKwh,
          cost: consumedToday * electricityPrice,
          earnings: exportedToday * feedinTariff,
          readings_count: parseInt(today.readings_today || 0),
        },
        week: {
          consumed_kwh: parseFloat(week.consumed_week || 0),
          exported_kwh: parseFloat(week.exported_week || 0),
          cost: parseFloat(week.consumed_week || 0) * electricityPrice,
          earnings: parseFloat(week.exported_week || 0) * feedinTariff,
        },
        month: {
          consumed_kwh: parseFloat(month.consumed_month || 0),
          exported_kwh: parseFloat(month.exported_month || 0),
          cost: parseFloat(month.consumed_month || 0) * electricityPrice,
          earnings: parseFloat(month.exported_month || 0) * feedinTariff,
        },
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

    let int1 = '7 days';
    let int2 = '14 days';
    if (range === '24h') { int1 = '1 day'; int2 = '2 days'; }
    if (range === '30d') { int1 = '30 days'; int2 = '60 days'; }
    if (range === '1y') { int1 = '1 year'; int2 = '2 years'; }

    try {
      const currentRes = await query(
        `SELECT 
           LAST(total_import, time) - FIRST(total_import, time) AS consumed,
           LAST(total_export, time) - FIRST(total_export, time) AS exported
         FROM meter_readings
         WHERE time >= NOW() - $1::interval`,
        [int1]
      );

      const previousRes = await query(
        `SELECT 
           LAST(total_import, time) - FIRST(total_import, time) AS consumed,
           LAST(total_export, time) - FIRST(total_export, time) AS exported
         FROM meter_readings
         WHERE time >= NOW() - $2::interval AND time < NOW() - $1::interval`,
        [int2, int1]
      );

      const current = currentRes.rows[0] || { consumed: 0, exported: 0 };
      const previous = previousRes.rows[0] || { consumed: 0, exported: 0 };

      const curCons = parseFloat(current.consumed || 0);
      const curExp = parseFloat(current.exported || 0);
      const prevCons = parseFloat(previous.consumed || 0);
      const prevExp = parseFloat(previous.exported || 0);

      // If previous is 0 (or no data), we cannot calculate a trend percentage safely.
      const trendCons = prevCons > 0 ? ((curCons - prevCons) / prevCons) * 100 : null;
      const trendExp = prevExp > 0 ? ((curExp - prevExp) / prevExp) * 100 : null;

      return reply.send({
        current: { consumed: curCons, exported: curExp },
        previous: { consumed: prevCons, exported: prevExp },
        trend_consumed_pct: trendCons,
        trend_exported_pct: trendExp
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
