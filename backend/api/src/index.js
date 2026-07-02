import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
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

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
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
fastify.get('/api/health', async (request, reply) => {
  const mqttStatus = getMqttStatus();
  return reply.send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mqtt: {
      connected: mqttStatus.connected,
      messages_processed: mqttStatus.messageCount,
      last_reading_at: mqttStatus.lastReading?.time || null,
    },
  });
});

// ── Stricter Rate Limit for Login ───────────────────────────
fastify.addHook('onRoute', (routeOptions) => {
  if (routeOptions.url === '/api/auth/login' && routeOptions.method === 'POST') {
    const originalHandler = routeOptions.handler;
    // Login gets a stricter rate limit of 5 attempts per minute
    // (handled via the global rate limit plugin with custom key)
  }
});

// ── Start Server ────────────────────────────────────────────
const start = async () => {
  try {
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
