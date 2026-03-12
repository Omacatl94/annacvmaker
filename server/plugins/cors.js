import cors from '@fastify/cors';
import { config } from '../config.js';

export async function registerCors(app) {
  await app.register(cors, {
    origin: config.allowedOrigins,
    credentials: true,
  });
}
