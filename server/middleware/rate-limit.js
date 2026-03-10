const requests = new Map();

export function rateLimit({ windowMs = 60000, max = 20 } = {}) {
  return function rateLimitHook(request, reply, done) {
    const key = request.session?.userId || request.ip;
    const now = Date.now();
    if (!requests.has(key)) requests.set(key, []);
    const timestamps = requests.get(key).filter(t => now - t < windowMs);
    timestamps.push(now);
    requests.set(key, timestamps);
    if (timestamps.length > max) {
      reply.code(429).send({ error: 'Too many requests. Try again later.' });
      return;
    }
    done();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requests) {
    const valid = timestamps.filter(t => now - t < 300000);
    if (valid.length === 0) requests.delete(key);
    else requests.set(key, valid);
  }
}, 300000);
