import 'dotenv/config';
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
      last_raw_payload: mqttStatus.lastRawPayload || null,
    },
  });
});

// Login rate limit is now handled directly in routes/auth.js

// ── Start Server ────────────────────────────────────────────
const start = async () => {
  try {
    // Run database migrations
    const { query } = await import('./db.js');
    await query(`
      ALTER TABLE meter_readings 
      ADD COLUMN IF NOT EXISTS solar_power DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS solar_energy_daily DOUBLE PRECISION
    `);
    console.log('[DB] Migrations applied successfully');

    // Start MQTT bridge
    startMqttBridge();

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
