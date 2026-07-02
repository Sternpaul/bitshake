import { query } from '../db.js';

/**
 * Register settings routes.
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function settingsRoutes(fastify) {
  // All settings routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/settings — Get all settings
  fastify.get('/api/settings', async (request, reply) => {
    try {
      const result = await query('SELECT key, value, updated_at FROM settings ORDER BY key');
      const settings = {};
      result.rows.forEach(r => {
        settings[r.key] = {
          value: r.value,
          updated_at: r.updated_at,
        };
      });
      return reply.send({ data: settings });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to fetch settings' });
    }
  });

  // PUT /api/settings — Update one or more settings
  fastify.put('/api/settings', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          electricity_price: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
          enable_feedin_tariff: { type: 'string', enum: ['true', 'false'] },
          feedin_tariff: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
          currency: { type: 'string', enum: ['EUR', 'USD', 'GBP', 'CHF'] },
          dashboard_refresh_seconds: { type: 'string', pattern: '^\\d+$' },
        },
      },
    },
  }, async (request, reply) => {
    const updates = request.body;
    const allowedKeys = ['electricity_price', 'enable_feedin_tariff', 'feedin_tariff', 'currency', 'dashboard_refresh_seconds'];

    try {
      const results = {};

      for (const [key, value] of Object.entries(updates)) {
        if (!allowedKeys.includes(key)) {
          continue;
        }

        // Validate numeric ranges
        if (key === 'electricity_price' || key === 'feedin_tariff') {
          const num = parseFloat(value);
          if (num < 0 || num > 10) {
            return reply.code(400).send({
              error: `Invalid value for ${key}: must be between 0 and 10`,
            });
          }
        }

        if (key === 'dashboard_refresh_seconds') {
          const num = parseInt(value);
          if (num < 5 || num > 300) {
            return reply.code(400).send({
              error: 'Refresh interval must be between 5 and 300 seconds',
            });
          }
        }

        await query(
          `INSERT INTO settings (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, value]
        );
        results[key] = value;
      }

      return reply.send({ message: 'Settings updated', data: results });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to update settings' });
    }
  });
}
