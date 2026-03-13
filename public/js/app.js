import { api } from './api.js';
import { t } from './strings.js';
import { renderLogin } from './auth.js';
import { renderLanding } from './landing.js';
import { renderProfilePage, renderGeneraPage } from './cv-form.js';
import { renderAccount } from './account.js';
import { renderCandidature } from './candidature.js';
import { renderPrivacyPolicy, renderTermsOfService } from './legal.js';
import { icon } from './icons.js';
import { showATSEducation, shouldShowATSEducation } from './ats-education.js';
import { showPricingModal } from './pricing.js';
import { renderAdmin } from './admin.js';

const root = document.getElementById('app');
let currentUser = null;
let activeTab = 'profilo';

export function getUser() { return currentUser; }
export function setUser(u) { currentUser = u; }
export function getRoot() { return root; }
export function getActiveTab() { return activeTab; }

export async function navigate(tab) {
  const hash = window.location.hash;

  // Capture referral code from URL
  const refMatch = hash.match(/ref=([A-Z0-9]+)/i);
  if (refMatch) {
    localStorage.setItem('jh-referral', refMatch[1].toUpperCase());
    window.location.hash = '';
  }

  // Capture invite code from URL (?invite=CODE)
  const urlParams = new URLSearchParams(window.location.search);
  const inviteCode = urlParams.get('invite');
  if (inviteCode) {
    localStorage.setItem('jh_invite_code', inviteCode.toUpperCase());
    // Clean URL without reload
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState(null, '', cleanUrl);
  }

  if (hash === '#payment-success') {
    window.location.hash = '';
    setTimeout(() => {
      const toast = document.createElement('div');
      toast.className = 'toast success';
      toast.textContent = 'Pagamento completato! I crediti sono stati aggiunti.';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }, 500);
  }
  if (hash === '#payment-cancel') {
    window.location.hash = '';
  }

  // Legal pages — accessible without auth
  if (tab === 'privacy') { renderPrivacyPolicy(root); return; }
  if (tab === 'terms') { renderTermsOfService(root); return; }

  try {
    const { user } = await api.getMe();
    currentUser = user;

    // Claim invite code if pending
    const pendingInvite = localStorage.getItem('jh_invite_code');
    if (pendingInvite && currentUser && !currentUser.guest) {
      try {
        await api.claimInvite(pendingInvite);
        localStorage.removeItem('jh_invite_code');
        // Re-fetch user (status may have changed)
        const { user: refreshed } = await api.getMe();
        currentUser = refreshed;
      } catch {
        localStorage.removeItem('jh_invite_code');
      }
    }

    // Legacy referral claim
    const pendingRef = localStorage.getItem('jh-referral');
    if (pendingRef && currentUser && !currentUser.guest) {
      api.claimReferral(pendingRef).catch(() => {});
      localStorage.removeItem('jh-referral');
    }
  } catch {
    currentUser = null;
  }

  if (!currentUser) {
    renderLanding(root);
    return;
  }

  // Waitlist gate
  if (currentUser.status === 'waitlist') {
    renderWaitlistScreen(root);
    return;
  }

  if (tab) activeTab = tab;

  root.textContent = '';
  root.appendChild(buildHeader());

  const content = document.createElement('div');
  content.className = 'tab-content';
  root.appendChild(content);

  switch (activeTab) {
    case 'profilo':
      renderProfilePage(content);
      break;
    case 'genera':
      renderGeneraPage(content);
      if (shouldShowATSEducation()) {
        showATSEducation();
      }
      break;
    case 'candidature':
      renderCandidature(content);
      break;
    case 'account':
      renderAccount(content);
      break;
    case 'admin':
      if (currentUser.role === 'admin') renderAdmin(content);
      else renderProfilePage(content);
      break;
    default:
      renderProfilePage(content);
      break;
  }
}

function buildHeader() {
  const header = document.createElement('header');
  header.className = 'app-header';

  // Logo
  const logo = document.createElement('h1');
  logo.className = 'app-logo';
  logo.textContent = 'JobHacker';
  logo.addEventListener('click', () => navigate('profilo'));
  header.appendChild(logo);

  // Tabs
  const tabs = document.createElement('nav');
  tabs.className = 'app-tabs';

  const tabDefs = [
    { id: 'profilo', label: 'Il mio CV', guestOk: true },
    { id: 'genera', label: 'Genera CV', guestOk: true },
    { id: 'candidature', label: 'Candidature', guestOk: false },
    { id: 'account', label: 'Account', guestOk: false },
    ...(currentUser.role === 'admin' ? [{ id: 'admin', label: 'Admin', guestOk: false }] : []),
  ];

  for (const t of tabDefs) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (activeTab === t.id ? ' active' : '');
    btn.textContent = t.label;

    if (!t.guestOk && currentUser.guest) {
      btn.disabled = true;
      btn.title = 'Accedi per sbloccare';
      btn.classList.add('tab-locked');
    } else {
      btn.addEventListener('click', () => navigate(t.id));
    }

    tabs.appendChild(btn);
  }

  header.appendChild(tabs);

  // User area
  const userArea = document.createElement('div');
  userArea.className = 'app-user-area';

  const avatar = document.createElement('div');
  avatar.className = 'header-avatar';
  if (currentUser.photo_path) {
    const img = document.createElement('img');
    img.src = currentUser.photo_path;
    img.alt = 'Avatar';
    avatar.appendChild(img);
  } else {
    avatar.textContent = (currentUser.name || 'U')[0].toUpperCase();
  }
  userArea.appendChild(avatar);

  const name = document.createElement('span');
  name.className = 'header-username';
  name.textContent = currentUser.guest ? 'Ospite' : (currentUser.name || currentUser.email);
  userArea.appendChild(name);

  // Theme toggle
  const themeBtn = document.createElement('button');
  themeBtn.className = 'theme-toggle';
  themeBtn.title = 'Cambia tema';
  function setThemeIcon(theme) {
    themeBtn.textContent = '';
    themeBtn.appendChild(icon(theme === 'dark' ? 'sun' : 'moon', { size: 18 }));
  }
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  setThemeIcon(isDark ? 'dark' : 'light');
  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('jh-theme', next);
    setThemeIcon(next);
  });
  userArea.appendChild(themeBtn);

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn-logout';
  logoutBtn.textContent = 'Esci';
  logoutBtn.addEventListener('click', async () => {
    await api.logout();
    activeTab = 'profilo';
    navigate();
  });
  userArea.appendChild(logoutBtn);

  if (!currentUser.guest) {
    const creditBadge = document.createElement('button');
    creditBadge.className = 'credit-badge';
    creditBadge.title = 'Crediti rimasti';
    creditBadge.appendChild(icon('coins', { size: 14 }));
    creditBadge.appendChild(document.createTextNode(' ...'));
    creditBadge.addEventListener('click', () => showPricingModal());
    api.getBalance().then(({ credits, gift, openBeta, dailyUsed, dailyLimit }) => {
      creditBadge.textContent = '';
      creditBadge.appendChild(icon('coins', { size: 14 }));

      if (openBeta) {
        const freeRemaining = Math.max(0, dailyLimit - dailyUsed);
        const total = freeRemaining + credits;
        creditBadge.appendChild(document.createTextNode(` ${freeRemaining}/${dailyLimit}`));
        if (credits > 0) {
          creditBadge.appendChild(document.createTextNode(` +${credits}`));
          creditBadge.title = `Open Beta: ${freeRemaining} gratis oggi + ${credits} crediti bonus`;
        } else {
          creditBadge.title = `Open Beta: ${freeRemaining} CV rimasti oggi`;
        }
        if (total <= 0) creditBadge.classList.add('empty');
        else if (total <= 1) creditBadge.classList.add('low');
      } else {
        creditBadge.appendChild(document.createTextNode(' ' + credits));
        if (credits <= 0) creditBadge.classList.add('empty');
        else if (credits <= 2) creditBadge.classList.add('low');
      }

      if (gift && gift.credits > 0) {
        // Overlay
        const overlay = document.createElement('div');
        overlay.className = 'gift-overlay';

        const modal = document.createElement('div');
        modal.className = 'gift-modal';

        const giftImg = document.createElement('img');
        giftImg.src = '/img/mascot/gift.webp';
        giftImg.alt = 'JH porta un regalo';
        giftImg.className = 'gift-img';
        modal.appendChild(giftImg);

        const title = document.createElement('div');
        title.className = 'gift-title';
        title.textContent = `Hai ricevuto ${gift.credits} crediti!`;
        modal.appendChild(title);

        if (gift.reason) {
          const reason = document.createElement('div');
          reason.className = 'gift-reason';
          reason.textContent = `"${gift.reason}"`;
          modal.appendChild(reason);
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'gift-close';
        closeBtn.textContent = 'Grazie, JobHacker!';
        closeBtn.addEventListener('click', () => {
          overlay.classList.add('gift-out');
          setTimeout(() => overlay.remove(), 400);
        });
        modal.appendChild(closeBtn);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Spawn confetti
        for (let i = 0; i < 40; i++) {
          const c = document.createElement('div');
          c.className = 'gift-confetti';
          c.style.left = Math.random() * 100 + '%';
          c.style.animationDelay = Math.random() * 0.8 + 's';
          c.style.background = ['#00E676','#FFD600','#FF4081','#448AFF','#E040FB','#FF6E40'][Math.floor(Math.random() * 6)];
          overlay.appendChild(c);
        }
      }
    }).catch(() => {
      creditBadge.textContent = '';
      creditBadge.appendChild(icon('coins', { size: 14 }));
      creditBadge.appendChild(document.createTextNode(' 0'));
      creditBadge.classList.add('empty');
    });
    userArea.appendChild(creditBadge);
  }

  header.appendChild(userArea);
  return header;
}

function renderWaitlistScreen(container) {
  container.textContent = '';

  const page = document.createElement('div');
  page.className = 'waitlist-page';

  const card = document.createElement('div');
  card.className = 'login-card';

  const img = document.createElement('img');
  img.src = '/img/mascot/empty.webp';
  img.alt = 'JH in attesa';
  img.className = 'waitlist-img';
  card.appendChild(img);

  const h2 = document.createElement('h2');
  h2.textContent = t('auth.waitlistTitle');
  card.appendChild(h2);

  const text = document.createElement('p');
  text.className = 'login-subtitle';
  text.textContent = t('auth.waitlistText');
  card.appendChild(text);

  // Invite code input
  const form = document.createElement('div');
  form.className = 'waitlist-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = t('auth.waitlistInput');
  input.maxLength = 8;
  input.className = 'waitlist-input';
  input.style.textTransform = 'uppercase';
  form.appendChild(input);

  const claimBtn = document.createElement('button');
  claimBtn.className = 'btn-primary';
  claimBtn.textContent = t('auth.waitlistClaim');
  claimBtn.addEventListener('click', async () => {
    const code = input.value.trim().toUpperCase();
    if (!code) return;
    claimBtn.disabled = true;
    claimBtn.textContent = '...';
    try {
      await api.claimInvite(code);
      navigate(); // Re-navigate — user is now active
    } catch {
      const err = document.createElement('p');
      err.className = 'waitlist-error';
      err.textContent = t('auth.waitlistError');
      form.appendChild(err);
      setTimeout(() => err.remove(), 3000);
    }
    claimBtn.disabled = false;
    claimBtn.textContent = t('auth.waitlistClaim');
  });
  form.appendChild(claimBtn);

  card.appendChild(form);

  // Logout option — inside the form so it stacks vertically
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn-secondary';
  logoutBtn.textContent = 'Esci';
  logoutBtn.addEventListener('click', async () => {
    await api.logout();
    navigate();
  });
  form.appendChild(logoutBtn);

  page.appendChild(card);
  container.appendChild(page);
}

navigate();
