import { api } from './api.js';
import { navigate } from './app.js';
import { t } from './strings.js';

export function renderLogin(root) {
  root.textContent = '';

  const page = document.createElement('div');
  page.className = 'login-page';

  const card = document.createElement('div');
  card.className = 'login-card';

  const h1 = document.createElement('h1');
  h1.textContent = t('auth.title');
  card.appendChild(h1);

  const subtitle = document.createElement('p');
  subtitle.className = 'login-subtitle';
  subtitle.textContent = t('auth.subtitle');
  card.appendChild(subtitle);

  const buttons = document.createElement('div');
  buttons.className = 'login-buttons';

  const googleBtn = document.createElement('a');
  googleBtn.href = '/api/auth/google';
  googleBtn.className = 'login-btn google-btn';
  googleBtn.textContent = t('auth.google');
  buttons.appendChild(googleBtn);

  const linkedinBtn = document.createElement('a');
  linkedinBtn.href = '/api/auth/linkedin';
  linkedinBtn.className = 'login-btn linkedin-btn';
  linkedinBtn.textContent = t('auth.linkedin');
  buttons.appendChild(linkedinBtn);

  const divider = document.createElement('div');
  divider.className = 'login-divider';
  divider.textContent = t('auth.divider');
  buttons.appendChild(divider);

  const guestBtn = document.createElement('button');
  guestBtn.className = 'login-btn guest-btn';
  guestBtn.textContent = t('auth.guest');
  guestBtn.addEventListener('click', async () => {
    guestBtn.disabled = true;
    guestBtn.textContent = t('auth.wait');
    try {
      await api.guestLogin();
      navigate();
    } catch {
      guestBtn.disabled = false;
      guestBtn.textContent = t('auth.guest');
    }
  });
  buttons.appendChild(guestBtn);

  card.appendChild(buttons);

  const trust = document.createElement('p');
  trust.className = 'login-trust';
  trust.textContent = t('auth.trust');
  card.appendChild(trust);

  page.appendChild(card);
  root.appendChild(page);
}

export async function handleLogout() {
  await api.logout();
  navigate();
}
