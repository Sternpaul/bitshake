import { query } from '../db.js';

/**
 * Register readings routes.
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function readingsRoutes(fastify) {
  // All readings routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/readings/live — Latest reading
  fastify.get('/api/readings/live', async (request, reply) => {
    try {
      const result = await query(
        `SELECT time, total_import, total_export, power_current, power_l1, power_l2, power_l3, solar_power, solar_energy_daily
         FROM meter_readings
         ORDER BY time DESC
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return reply.send({ data: null, message: 'No readings available yet' });
      }

      return reply.send({ data: result.rows[0] });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to fetch live reading' });
    }
  });

  // GET /api/readings/recent?minutes=30 — Recent raw readings for live chart
  fastify.get('/api/readings/recent', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          minutes: { type: 'integer', minimum: 1, maximum: 1440, default: 30 },
        },
      },
    },
  }, async (request, reply) => {
    const { minutes } = request.query;

    try {
      const result = await query(
        `SELECT time, power_current, power_l1, power_l2, power_l3, total_import, total_export, solar_power, solar_energy_daily, solar_estimated_power
         FROM meter_readings
         WHERE time >= NOW() - $1::interval
         ORDER BY time ASC`,
        [`${minutes} minutes`]
      );

      return reply.send({ data: result.rows });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to fetch recent readings' });
    }
  });

  // GET /api/readings/history?range=24h|7d|30d|1y — Aggregated historical data
  fastify.get('/api/readings/history', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['24h', '7d', '30d', '1y'], default: '24h' },
        },
      },
    },
  }, async (request, reply) => {
    const { range } = request.query;

    try {
      let queryText;
      let params;

      switch (range) {
        case '24h':
          // Use raw data bucketed into 5-minute intervals
          queryText = `
            SELECT
              time_bucket('5 minutes', time) AS bucket,
              AVG(power_current) AS avg_power,
              AVG(solar_power) AS avg_solar_power,
              AVG(solar_estimated_power) AS avg_solar_estimated_power,
              MAX(power_current) AS max_power,
              MIN(power_current) AS min_power,
              LAST(total_import, time) - FIRST(total_import, time) AS consumed_kwh,
              LAST(total_export, time) - FIRST(total_export, time) AS exported_kwh
            FROM meter_readings
            WHERE time >= NOW() - INTERVAL '24 hours'
            GROUP BY bucket
            ORDER BY bucket ASC`;
          params = [];
          break;

        case '7d':
          // Calculate dynamically to ensure immediate availability for new installs
          queryText = `
            SELECT
              time_bucket('1 day', time) AS bucket,
              AVG(power_current) AS avg_power,
              AVG(solar_power) AS avg_solar_power,
              AVG(solar_estimated_power) AS avg_solar_estimated_power,
              MAX(power_current) AS max_power,
              MIN(power_current) AS min_power,
              LAST(total_import, time) - FIRST(total_import, time) AS consumed_kwh,
              LAST(total_export, time) - FIRST(total_export, time) AS exported_kwh
            FROM meter_readings
            WHERE time >= NOW() - INTERVAL '7 days'
            GROUP BY bucket
            ORDER BY bucket ASC`;
          params = [];
          break;

        case '30d':
          // Calculate dynamically to ensure immediate availability for new installs
          queryText = `
            SELECT
              time_bucket('1 day', time) AS bucket,
              AVG(power_current) AS avg_power,
              AVG(solar_power) AS avg_solar_power,
              AVG(solar_estimated_power) AS avg_solar_estimated_power,
              MAX(power_current) AS max_power,
              MIN(power_current) AS min_power,
              LAST(total_import, time) - FIRST(total_import, time) AS consumed_kwh,
              LAST(total_export, time) - FIRST(total_export, time) AS exported_kwh
            FROM meter_readings
            WHERE time >= NOW() - INTERVAL '30 days'
            GROUP BY bucket
            ORDER BY bucket ASC`;
          params = [];
          break;

        case '1y':
          // Calculate dynamically to ensure immediate availability for new installs
          queryText = `
            SELECT
              time_bucket('1 day', time) AS bucket,
              AVG(power_current) AS avg_power,
              AVG(solar_power) AS avg_solar_power,
              AVG(solar_estimated_power) AS avg_solar_estimated_power,
              MAX(power_current) AS max_power,
              MIN(power_current) AS min_power,
              LAST(total_import, time) - FIRST(total_import, time) AS consumed_kwh,
              LAST(total_export, time) - FIRST(total_export, time) AS exported_kwh
            FROM meter_readings
            WHERE time >= NOW() - INTERVAL '1 year'
            GROUP BY bucket
            ORDER BY bucket ASC`;
          params = [];
          break;
      }

      const result = await query(queryText, params);
      return reply.send({ data: result.rows, range });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to fetch history' });
    }
  });

  // GET /api/readings/daily?date=YYYY-MM-DD — Minute-resolution for a specific day
  fastify.get('/api/readings/daily', {
    schema: {
      querystring: {
        type: 'object',
        required: ['date'],
        properties: {
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        },
      },
    },
  }, async (request, reply) => {
    const { date } = request.query;

    try {
      const result = await query(
        `SELECT
           time_bucket('1 minute', time) AS bucket,
           AVG(power_current) AS avg_power,
           AVG(solar_power) AS avg_solar_power,
           AVG(solar_estimated_power) AS avg_solar_estimated_power,
           AVG(power_l1) AS avg_power_l1,
           AVG(power_l2) AS avg_power_l2,
           AVG(power_l3) AS avg_power_l3,
           LAST(total_import, time) AS total_import,
           LAST(total_export, time) AS total_export
         FROM meter_readings
         WHERE time >= $1::date AND time < ($1::date + INTERVAL '1 day')
         GROUP BY bucket
         ORDER BY bucket ASC`,
        [date]
      );

      return reply.send({ data: result.rows, date });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to fetch daily data' });
    }
  });

  // GET /api/readings/export?from=YYYY-MM-DD&to=YYYY-MM-DD — CSV export
  fastify.get('/api/readings/export', {
    schema: {
      querystring: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        },
      },
    },
  }, async (request, reply) => {
    const { from, to } = request.query;

    try {
      const result = await query(
        `SELECT time, total_import, total_export, power_current, power_l1, power_l2, power_l3, solar_power, solar_energy_daily, solar_estimated_power
         FROM meter_readings
         WHERE time >= $1::date AND time < ($2::date + INTERVAL '1 day')
         ORDER BY time ASC`,
        [from, to]
      );

      // Build CSV
      const headers = 'timestamp,total_import_kwh,total_export_kwh,power_w,power_l1_w,power_l2_w,power_l3_w,solar_power_w,solar_energy_daily_kwh';
      const rows = result.rows.map(r =>
        `${r.time},${r.total_import ?? ''},${r.total_export ?? ''},${r.power_current ?? ''},${r.power_l1 ?? ''},${r.power_l2 ?? ''},${r.power_l3 ?? ''},${r.solar_power ?? ''},${r.solar_energy_daily ?? ''}`
      );
      const csv = [headers, ...rows].join('\n');

      reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="bitshake_${from}_to_${to}.csv"`)
        .send(csv);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to export data' });
    }
  });
}
