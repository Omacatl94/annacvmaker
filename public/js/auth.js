import { api } from './api.js';
import { navigate } from './app.js';

export function renderLogin(root) {
  root.textContent = '';

  const page = document.createElement('div');
  page.className = 'login-page';

  const card = document.createElement('div');
  card.className = 'login-card';

  const h1 = document.createElement('h1');
  h1.textContent = 'CV Maker';
  card.appendChild(h1);

  const subtitle = document.createElement('p');
  subtitle.className = 'login-subtitle';
  subtitle.textContent = 'Crea il CV perfetto per ogni candidatura. AI-powered, ATS-optimized.';
  card.appendChild(subtitle);

  const buttons = document.createElement('div');
  buttons.className = 'login-buttons';

  const googleBtn = document.createElement('a');
  googleBtn.href = '/api/auth/google';
  googleBtn.className = 'login-btn google-btn';
  googleBtn.textContent = 'Accedi con Google';
  buttons.appendChild(googleBtn);

  const linkedinBtn = document.createElement('a');
  linkedinBtn.href = '/api/auth/linkedin';
  linkedinBtn.className = 'login-btn linkedin-btn';
  linkedinBtn.textContent = 'Accedi con LinkedIn';
  buttons.appendChild(linkedinBtn);

  card.appendChild(buttons);
  page.appendChild(card);
  root.appendChild(page);
}

export async function handleLogout() {
  await api.logout();
  navigate();
}
