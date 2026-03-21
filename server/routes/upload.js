import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { authGuard } from '../middleware/auth-guard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsBase = join(__dirname, '../..', 'uploads');

mkdirSync(join(uploadsBase, 'photos'), { recursive: true });
mkdirSync(join(uploadsBase, 'cvs'), { recursive: true });

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_CV_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.oasis.opendocument.text', // .odt
];

const MAGIC_BYTES = {
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  'image/webp': [Buffer.from('RIFF')],
  'application/pdf': [Buffer.from('%PDF')],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // ZIP
  'application/msword': [Buffer.from([0xD0, 0xCF, 0x11, 0xE0])], // OLE compound
  'application/vnd.oasis.opendocument.text': [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // ZIP
};

function validateMagicBytes(buffer, mimetype) {
  const expected = MAGIC_BYTES[mimetype];
  if (!expected) return true;
  return expected.some(magic => buffer.subarray(0, magic.length).equals(magic));
}

export default async function uploadRoutes(app) {
  app.addHook('preHandler', authGuard);

  app.post('/photo', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'No file uploaded' });
    if (!ALLOWED_PHOTO_TYPES.includes(file.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Use JPEG, PNG, or WebP.' });
    }

    const chunks = [];
    for await (const chunk of file.file) { chunks.push(chunk); }
    const buffer = Buffer.concat(chunks);

    if (!validateMagicBytes(buffer, file.mimetype)) {
      return reply.code(400).send({ error: 'File content does not match declared type' });
    }

    const ext = extname(file.filename) || '.jpg';
    const name = `${randomUUID()}${ext}`;
    const dest = join(uploadsBase, 'photos', name);
    writeFileSync(dest, buffer);
    reply.send({ path: `/uploads/photos/${name}` });
  });

  app.post('/cv-file', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'No file uploaded' });
    if (!ALLOWED_CV_TYPES.includes(file.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Use PDF, DOCX, DOC, ODT, JPEG, or PNG.' });
    }

    const chunks = [];
    for await (const chunk of file.file) { chunks.push(chunk); }
    const buffer = Buffer.concat(chunks);

    if (!validateMagicBytes(buffer, file.mimetype)) {
      return reply.code(400).send({ error: 'File content does not match declared type' });
    }

    const ext = extname(file.filename) || '.pdf';
    const name = `${randomUUID()}${ext}`;
    const dest = join(uploadsBase, 'cvs', name);
    writeFileSync(dest, buffer);
    reply.send({ path: `/uploads/cvs/${name}`, filename: file.filename });
  });
}
