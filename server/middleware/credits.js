import { hasCredits } from '../services/credits.js';
import { config } from '../config.js';

/**
 * Middleware factory: checks user has enough credits for the given action.
 * Returns 402 Payment Required if insufficient.
 */
export function creditGuard(action) {
  return async function (request, reply) {
    const userId = request.user?.id;
    if (!userId) return; // auth guard handles this

    const ok = await hasCredits(request.server.db, userId, action);
    if (!ok) {
      const msg = config.openBeta ? 'Limite giornaliero raggiunto' : 'Crediti insufficienti';
      reply.code(402).send({ error: msg, action });
      return;
    }
  };
}
