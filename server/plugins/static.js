import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../../dist');
const publicDir = join(__dirname, '../../public');

export async function registerStatic(app) {
  // Serve Vite build output
  await app.register(fastifyStatic, {
    root: distDir,
    prefix: '/',
  });

  // Serve static assets from public/ (images, robots.txt, etc.)
  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
    decorateReply: false,
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
