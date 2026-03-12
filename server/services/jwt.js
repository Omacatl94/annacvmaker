import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Minimal JWT implementation using HMAC-SHA256.
 * No external dependencies — uses Node.js built-in crypto.
 */

const ALG = 'HS256';
const HEADER = Buffer.from(JSON.stringify({ alg: ALG, typ: 'JWT' })).toString('base64url');

export function sign(payload, secret, expiresInSeconds = 7 * 24 * 3600) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iss: 'jobhacker', aud: 'app.jobhacker.it', iat: now, exp: now + expiresInSeconds };
  const encodedPayload = Buffer.from(JSON.stringify(body)).toString('base64url');
  const data = `${HEADER}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verify(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, sig] = parts;
  const data = `${header}.${payload}`;
  const expected = createHmac('sha256', secret).update(data).digest('base64url');

  // Timing-safe comparison
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    if (decoded.iss !== 'jobhacker' || decoded.aud !== 'app.jobhacker.it') return null;
    return decoded;
  } catch {
    return null;
  }
}
