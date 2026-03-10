import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';
import { authGuard } from '../middleware/auth-guard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsBase = join(__dirname, '../..', 'uploads');

mkdirSync(join(uploadsBase, 'photos'), { recursive: true });
mkdirSync(join(uploadsBase, 'cvs'), { recursive: true });

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_CV_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default async function uploadRoutes(app) {
  app.addHook('preHandler', authGuard);

  app.post('/photo', async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'No file uploaded' });
    if (!ALLOWED_PHOTO_TYPES.includes(file.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Use JPEG, PNG, or WebP.' });
    }
    const ext = extname(file.filename) || '.jpg';
    const name = `${randomUUID()}${ext}`;
    const dest = join(uploadsBase, 'photos', name);
    await pipeline(file.file, createWriteStream(dest));
    reply.send({ path: `/uploads/photos/${name}` });
  });

  app.post('/cv-file', async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'No file uploaded' });
    if (!ALLOWED_CV_TYPES.includes(file.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Use PDF, DOCX, JPEG, or PNG.' });
    }
    const ext = extname(file.filename) || '.pdf';
    const name = `${randomUUID()}${ext}`;
    const dest = join(uploadsBase, 'cvs', name);
    await pipeline(file.file, createWriteStream(dest));
    reply.send({ path: `/uploads/cvs/${name}`, filename: file.filename });
  });
}
