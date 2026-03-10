import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { registerStatic } from './plugins/static.js';
import { registerCors } from './plugins/cors.js';
import { db } from './db/connection.js';
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';

const app = Fastify({ logger: true });

// Plugins
await app.register(registerCors);
await app.register(cookie);
await app.register(session, {
  secret: config.sessionSecret,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
  saveUninitialized: false,
});
await app.register(formbody);
await app.register(multipart, {
  limits: { fileSize: config.upload.maxFileSize },
});

// Store db on app for routes
app.decorate('db', db);

// Routes will be registered in later tasks
await app.register(authRoutes, { prefix: '/api/auth' });
// await app.register(cvRoutes, { prefix: '/api/cv' });
// await app.register(aiRoutes, { prefix: '/api/ai' });
await app.register(uploadRoutes, { prefix: '/api/upload' });

// Static files (must be last — catches unmatched routes for SPA)
await app.register(registerStatic);

// Start
try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
