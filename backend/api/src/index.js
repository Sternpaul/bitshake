import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyCookie from '@fastify/cookie';
import { verifyToken } from './middleware/auth.js';
import { startMqttBridge, getMqttStatus, stopMqttBridge } from './mqtt-bridge.js';
import authRoutes from './routes/auth.js';
import readingsRoutes from './routes/readings.js';
import statsRoutes from './routes/stats.js';
import settingsRoutes from './routes/settings.js';

const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '0.0.0.0';

// Initialize Fastify
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true },
    } : undefined,
  },
  trustProxy: true,
});

// ── Security Plugins ────────────────────────────────────────
await fastify.register(helmet, {
  contentSecurityPolicy: false, // Managed by Caddy
});

const corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin) {
  throw new Error('CORS_ORIGIN environment variable is required');
}

await fastify.register(cors, {
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
});

await fastify.register(fastifyCookie, {
  secret: process.env.JWT_SECRET || 'change-me-in-production',
});

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  // Stricter limit for auth endpoints
  keyGenerator: (request) => request.ip,
});

// ── Auth Decorator ──────────────────────────────────────────
// Make `fastify.authenticate` available to all routes
fastify.decorate('authenticate', verifyToken);

// ── Routes ──────────────────────────────────────────────────
await fastify.register(authRoutes);
await fastify.register(readingsRoutes);
await fastify.register(statsRoutes);
await fastify.register(settingsRoutes);

// ── Health Check ────────────────────────────────────────────
fastify.get('/api/health', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const mqttStatus = getMqttStatus();
  return reply.send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mqtt: {
      connected: mqttStatus.connected,
      messages_processed: mqttStatus.messageCount,
      last_reading_at: mqttStatus.lastReading?.time || null,
      last_raw_payload_grid: mqttStatus.lastRawPayloadGrid || null,
      last_raw_payload_solar: mqttStatus.lastRawPayloadSolar || null,
    },
  });
});

// Login rate limit is now handled directly in routes/auth.js

// ── Start Server ────────────────────────────────────────────
const start = async () => {
  try {
    // Start MQTT bridge
    startMqttBridge();

    // Run migration
    try {
      const { query } = await import('./db.js');
      const migrationSql = `
        ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS solar_power DOUBLE PRECISION;
        ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS solar_energy_daily DOUBLE PRECISION;
        ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS solar_energy_total DOUBLE PRECISION;
        DROP MATERIALIZED VIEW IF EXISTS hourly_energy CASCADE;
        DROP MATERIALIZED VIEW IF EXISTS daily_energy CASCADE;
        
        CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_energy WITH (timescaledb.continuous) AS
        SELECT time_bucket('1 hour', time) AS bucket, AVG(power_current) AS avg_power, MAX(power_current) AS max_power, MIN(power_current) AS min_power, LAST(total_import, time) - FIRST(total_import, time) AS consumed_kwh, LAST(total_export, time) - FIRST(total_export, time) AS exported_kwh, LAST(solar_energy_total, time) - FIRST(solar_energy_total, time) AS generated_kwh, COUNT(*) AS sample_count
        FROM meter_readings GROUP BY bucket WITH NO DATA;
        
        CREATE MATERIALIZED VIEW IF NOT EXISTS daily_energy WITH (timescaledb.continuous) AS
        SELECT time_bucket('1 day', time) AS bucket, AVG(power_current) AS avg_power, MAX(power_current) AS max_power, MIN(power_current) AS min_power, LAST(total_import, time) - FIRST(total_import, time) AS consumed_kwh, LAST(total_export, time) - FIRST(total_export, time) AS exported_kwh, LAST(solar_energy_total, time) - FIRST(solar_energy_total, time) AS generated_kwh, COUNT(*) AS sample_count
        FROM meter_readings GROUP BY bucket WITH NO DATA;
        
        SELECT add_continuous_aggregate_policy('hourly_energy', start_offset => INTERVAL '3 hours', end_offset => INTERVAL '1 hour', schedule_interval => INTERVAL '1 hour', if_not_exists => TRUE);
        SELECT add_continuous_aggregate_policy('daily_energy', start_offset => INTERVAL '3 days', end_offset => INTERVAL '1 day', schedule_interval => INTERVAL '1 day', if_not_exists => TRUE);
      `;
      console.log('[DB] Running solar migration script...');
      await query(migrationSql);
      console.log('[DB] Solar migration complete.');
    } catch (e) {
      console.warn('[DB] Migration failed (it may have already run):', e.message);
    }

    // Start HTTP server
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 Bitshake API running on http://${HOST}:${PORT}`);
    console.log(`📊 Health check: http://${HOST}:${PORT}/api/health`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  stopMqttBridge();
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
