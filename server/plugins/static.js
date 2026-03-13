import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../../dist');

export async function registerStatic(app) {
  // Serve Vite build output (includes static assets from client/public/)
  await app.register(fastifyStatic, {
    root: distDir,
    prefix: '/',
  });

  // Serve uploads
  await app.register(fastifyStatic, {
    root: join(__dirname, '../../uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });

  // SPA fallback: serve index.html for non-API, non-file routes
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      reply.code(404).send({ error: 'Not found' });
    } else {
      reply.type('text/html').send(readFileSync(join(distDir, 'index.html')));
    }
  });
}
