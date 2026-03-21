import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_BASE = resolve(join(__dirname, '../..', 'uploads'));

export function safePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    const err = new Error('Invalid file path');
    err.statusCode = 400;
    throw err;
  }
  const cleaned = filePath.replace(/^\/?(uploads\/)?/, '');
  const resolved = resolve(UPLOADS_BASE, cleaned);
  if (!resolved.startsWith(UPLOADS_BASE)) {
    const err = new Error('Path traversal blocked');
    err.statusCode = 403;
    throw err;
  }
  return resolved;
}

export { UPLOADS_BASE };
