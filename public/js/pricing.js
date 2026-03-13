import { api } from './api.js';
import { icon } from './icons.js';
import { t } from './strings.js';
import { track } from './analytics.js';

export async function showPricingModal(onClose) {
  const overlay = document.createElement('div');
  overlay.className = 'pricing-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const modal = document.createElement('div');
  modal.className = 'pricing-modal';

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'pricing-close';
  closeBtn.appendChild(icon('x', { size: 20 }));
  closeBtn.addEventListener('click', close);
  modal.appendChild(closeBtn);

  // Check if we're in open beta
  let isOpenBeta = false;
  try {
    const balance = await api.getBalance();
    isOpenBeta = balance.openBeta;
  } catch {}

  if (isOpenBeta) {
    // Beta info modal — no Stripe
    const title = document.createElement('h2');
    title.className = 'pricing-title';
    title.textContent = t('beta.modalTitle');
    modal.appendChild(title);

    const text = document.createElement('p');
    text.className = 'pricing-subtitle';
    text.textContent = t('beta.modalText');
    modal.appendChild(text);

    const hint = document.createElement('p');
    hint.className = 'pricing-guarantee';
    hint.textContent = t('beta.modalHint');
    modal.appendChild(hint);

    const referralHint = document.createElement('p');
    referralHint.className = 'pricing-subtitle';
    referralHint.style.marginTop = '12px';
    referralHint.textContent = 'Vuoi piu\' CV? Condividi il tuo link referral dalla sezione Account per ottenere crediti extra.';
    modal.appendChild(referralHint);

    const okBtn = document.createElement('button');
    okBtn.className = 'btn-primary';
    okBtn.textContent = 'OK';
    okBtn.addEventListener('click', close);
    okBtn.style.marginTop = '16px';
    modal.appendChild(okBtn);
  } else {
    // Normal Stripe pricing modal
    const title = document.createElement('h2');
    title.className = 'pricing-title';
    title.textContent = t('pricing.title');
    modal.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'pricing-subtitle';
    subtitle.textContent = t('pricing.subtitle');
    modal.appendChild(subtitle);

    const grid = document.createElement('div');
    grid.className = 'pricing-grid';
    modal.appendChild(grid);

    const guarantee = document.createElement('p');
    guarantee.className = 'pricing-guarantee';
    guarantee.textContent = t('pricing.guarantee');
    modal.appendChild(guarantee);

    try {
      const { tiers } = await api.getPricing();

      tiers.forEach((tier, i) => {
        const card = document.createElement('div');
        card.className = 'pricing-tier';

        if (i === 1) {
          card.classList.add('popular');
          const badge = document.createElement('span');
          badge.className = 'pricing-popular-badge';
          badge.textContent = t('pricing.popular');
          card.appendChild(badge);
        }

        const name = document.createElement('div');
        name.className = 'pricing-tier-name';
        name.textContent = tier.name.charAt(0).toUpperCase() + tier.name.slice(1);
        card.appendChild(name);

        const price = document.createElement('div');
        price.className = 'pricing-tier-price';
        price.textContent = '\u20AC' + (tier.price / 100).toFixed(2).replace('.', ',');
        card.appendChild(price);

        const credits = document.createElement('div');
        credits.className = 'pricing-tier-credits';
        credits.textContent = tier.credits + ' ' + t('pricing.credits');
        card.appendChild(credits);

        const perCv = document.createElement('div');
        perCv.className = 'pricing-tier-percv';
        perCv.textContent = '\u20AC' + (tier.price / 100 / tier.credits).toFixed(2).replace('.', ',') + t('pricing.perCv');
        card.appendChild(perCv);

        const buyBtn = document.createElement('button');
        buyBtn.className = 'btn-primary';
        buyBtn.textContent = t('pricing.buy');
        buyBtn.addEventListener('click', async () => {
          buyBtn.disabled = true;
          buyBtn.textContent = '...';
          try {
            track('pricing_buy_click', { tier: tier.id });
            const { url } = await api.createCheckout(tier.id);
            window.location.href = url;
          } catch (err) {
            buyBtn.disabled = false;
            buyBtn.textContent = t('pricing.buy');
          }
        });
        card.appendChild(buyBtn);

        grid.appendChild(card);
      });
    } catch (err) {
      const errorMsg = document.createElement('p');
      errorMsg.className = 'pricing-subtitle';
      errorMsg.style.color = 'var(--color-error)';
      errorMsg.textContent = err.message || 'Errore nel caricamento dei prezzi.';
      grid.replaceWith(errorMsg);
    }
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  track('pricing_modal_open');

  function close() {
    overlay.remove();
    if (onClose) onClose();
  }
}
