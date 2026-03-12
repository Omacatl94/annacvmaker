import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { registerStatic } from './plugins/static.js';
import { registerCors } from './plugins/cors.js';
import { db } from './db/connection.js';
import { verify } from './services/jwt.js';
import authRoutes from './routes/auth.js';
import cvRoutes from './routes/cv.js';
import uploadRoutes from './routes/upload.js';
import aiRoutes from './routes/ai.js';
import paymentRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';
const app = Fastify({ logger: true, trustProxy: true });

// Sanitize request body — remove sensitive fields
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return null;
  const sanitized = { ...body };
  for (const key of ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie']) {
    delete sanitized[key];
  }
  return sanitized;
}

app.setErrorHandler(async (error, request, reply) => {
  const statusCode = error.statusCode || 500;
  request.log.error({ err: error, url: request.url, method: request.method }, 'Request error');

  // Log to error_logs table (5xx and 422 parse failures)
  if (statusCode >= 500 || statusCode === 422) {
    db.query(
      `INSERT INTO error_logs (level, endpoint, message, stack, user_id, request_body, status_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        statusCode >= 500 ? 'error' : 'warn',
        `${request.method} ${request.url}`,
        error.message,
        error.stack || null,
        request.user?.id || null,
        sanitizeBody(request.body),
        statusCode,
      ]
    ).catch(() => {});
  }

  if (statusCode >= 500) {
    reply.code(statusCode).send({
      error: 'Errore interno. Riprova tra qualche secondo.',
    });
  } else {
    reply.code(statusCode).send({ error: error.message });
  }
});

// Plugins
await app.register(registerCors);
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
    },
  },
});
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
});
await app.register(cookie);
await app.register(formbody);
await app.register(multipart, {
  limits: { fileSize: config.upload.maxFileSize },
});

// Raw body support for Stripe webhooks
app.removeContentTypeParser('application/json');
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  req.rawBody = body;
  try {
    done(null, JSON.parse(body.toString()));
  } catch (err) {
    done(err);
  }
});

// JWT auth: decode token on every request, set req.user
app.decorateRequest('user', null);
app.addHook('onRequest', async (req) => {
  const token = req.cookies?.['__Host-jh_token'];
  if (!token) return;
  const payload = verify(token, config.jwtSecret);
  if (payload) req.user = payload;
});

// Store db on app for routes
app.decorate('db', db);

// Seed admin roles from ADMIN_EMAILS env var
if (config.adminEmails.length > 0) {
  await db.query(
    `UPDATE users SET role = 'admin' WHERE LOWER(email) = ANY($1) AND role != 'admin'`,
    [config.adminEmails]
  );
}

// Cleanup old error/audit logs (90 days)
await db.query(`DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '90 days'`).catch(() => {});
await db.query(`DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days'`).catch(() => {});

// Health check — no auth required
app.get('/api/health', async (request, reply) => {
  const checks = { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() };

  try {
    const result = await db.query('SELECT 1 AS ok');
    checks.db = result.rows[0]?.ok === 1 ? 'connected' : 'error';
  } catch (err) {
    checks.db = 'disconnected';
    checks.status = 'degraded';
    request.log.warn({ err }, 'Health check: DB unreachable');
  }

  const code = checks.status === 'ok' ? 200 : 503;
  reply.code(code).send(checks);
});

// Routes
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(cvRoutes, { prefix: '/api/cv' });
await app.register(aiRoutes, { prefix: '/api/ai' });
await app.register(paymentRoutes, { prefix: '/api/payments' });
await app.register(adminRoutes, { prefix: '/api/admin' });
await app.register(uploadRoutes, { prefix: '/api/upload' });

// Static files (must be last — catches unmatched routes for SPA)
await app.register(registerStatic);

// Graceful shutdown
async function shutdown(signal) {
  app.log.info(`${signal} received — shutting down`);
  try {
    await app.close();
    await db.pool.end();
    app.log.info('Shutdown complete');
  } catch (err) {
    app.log.error(err, 'Error during shutdown');
  }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled rejections at process level
process.on('unhandledRejection', (reason) => {
  app.log.error({ err: reason }, 'Unhandled promise rejection');
});

// Start
try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
