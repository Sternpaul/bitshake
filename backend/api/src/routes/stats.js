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
        `SELECT key, value FROM settings WHERE key IN ('electricity_price', 'feedin_tariff', 'currency')`
      );
      const settings = {};
      settingsResult.rows.forEach(r => { settings[r.key] = r.value; });

      const electricityPrice = parseFloat(settings.electricity_price || '0.35');
      const feedinTariff = parseFloat(settings.feedin_tariff || '0.00');
      const currency = settings.currency || 'EUR';

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

      // Self-consumption rate:
      // If no solar export, it's 100% (all generation used internally)
      // Formula: 1 - (exported / total_generated)
      // Since we don't know total generation directly, we use:
      // self_consumption = consumed / (consumed + exported) when both are > 0
      let selfConsumptionRate = 0;
      if (consumedToday + exportedToday > 0) {
        selfConsumptionRate = consumedToday / (consumedToday + exportedToday);
      }

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
          self_consumption_rate: selfConsumptionRate,
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
          currency,
        },
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to compute overview stats' });
    }
  });
}
