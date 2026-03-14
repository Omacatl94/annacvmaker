import Stripe from 'stripe';
import { authGuard } from '../middleware/auth-guard.js';
import { config } from '../config.js';
import { PRICING_TIERS, addCredits, getBalance } from '../services/credits.js';
import { notify } from '../services/notifications.js';

export default async function paymentRoutes(app) {
  // GET /pricing — public, returns visible tiers
  app.get('/pricing', async (req, reply) => {
    const tiers = Object.entries(PRICING_TIERS)
      .filter(([, v]) => !v.hidden)
      .map(([key, v]) => ({
        id: key,
        label: v.label,
        credits: v.credits,
        price_cents: v.price_cents,
      }));
    reply.send({ tiers });
  });

  // GET /balance — auth required (works without Stripe)
  app.get('/balance', { preHandler: authGuard }, async (req, reply) => {
    const balance = await getBalance(app.db, req.user.id);
    const purchaseRes = await app.db.query('SELECT 1 FROM purchases WHERE user_id = $1 LIMIT 1', [req.user.id]);

    reply.send({ ...balance, hasPurchased: purchaseRes.rows.length > 0, gift: null });
  });

  if (!config.stripe.secretKey) {
    app.log.warn('STRIPE_SECRET_KEY not set — Stripe payment routes disabled');
    return;
  }

  const stripe = new Stripe(config.stripe.secretKey);

  // POST /create-checkout — auth required
  app.post('/create-checkout', {
    preHandler: authGuard,
    schema: {
      body: {
        type: 'object',
        required: ['tier'],
        properties: {
          tier: { type: 'string', enum: Object.keys(PRICING_TIERS) },
        },
      },
    },
  }, async (req, reply) => {
    const { tier } = req.body;
    const tierData = PRICING_TIERS[tier];
    if (!tierData) return reply.code(400).send({ error: 'Tier non valido' });

    const userId = req.user.id;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: tierData.price_cents,
          product_data: {
            name: `JobHacker — ${tierData.label}`,
            description: `${tierData.credits} crediti per generare CV personalizzati`,
          },
        },
        quantity: 1,
      }],
      metadata: { userId, tier },
      success_url: `${config.appOrigin}/#payment-success`,
      cancel_url: `${config.appOrigin}/#payment-cancel`,
    });

    reply.send({ url: session.url });
  });

  // POST /webhook — Stripe webhook, needs raw body for signature verification
  // This route uses a custom content type parser registered in index.js
  app.post('/webhook', async (req, reply) => {
    const sig = req.headers['stripe-signature'];
    if (!sig) return reply.code(400).send({ error: 'Missing signature' });

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, config.stripe.webhookSecret);
    } catch (err) {
      app.log.warn({ err }, 'Webhook signature verification failed');
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { userId, tier } = session.metadata;
      if (userId && tier) {
        try {
          const result = await addCredits(app.db, userId, tier, session.id, session.payment_intent);
          app.log.info({ userId, tier, credits: result.credits }, 'Credits added via Stripe');
          const tierCredits = PRICING_TIERS[tier]?.credits || 0;
          notify(app.db, userId, 'credits_purchased', { credits: tierCredits, tier }).catch(() => {});
        } catch (err) {
          app.log.error({ err, userId, tier }, 'Failed to add credits');
          app.db.query(
            `INSERT INTO error_logs (level, endpoint, message, stack, status_code)
             VALUES ('error', 'POST /api/payments/webhook', $1, $2, 500)`,
            [err.message, err.stack]
          ).catch(() => {});
        }
      }
    }

    reply.send({ received: true });
  });
}
