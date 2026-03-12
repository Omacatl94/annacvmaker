import { api } from './api.js';
import { navigate } from './app.js';
import { t } from './strings.js';
import { icon } from './icons.js';
import { track } from './analytics.js';

export function renderLanding(root) {
  root.textContent = '';

  const page = document.createElement('div');
  page.className = 'landing-page';

  // ── Nav ──
  const nav = document.createElement('nav');
  nav.className = 'landing-nav';

  const logo = document.createElement('div');
  logo.className = 'landing-logo';
  const logoImg = document.createElement('img');
  logoImg.src = '/img/mascot/avatar.webp';
  logoImg.alt = 'JH';
  logoImg.className = 'landing-logo-img';
  logo.appendChild(logoImg);
  const logoText = document.createElement('span');
  logoText.textContent = t('landing.logo');
  logo.appendChild(logoText);
  nav.appendChild(logo);

  const navRight = document.createElement('div');
  navRight.className = 'landing-nav-right';

  const themeBtn = document.createElement('button');
  themeBtn.className = 'theme-toggle';
  themeBtn.title = t('common.themeToggle');
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
  navRight.appendChild(themeBtn);

  const loginLink = document.createElement('a');
  loginLink.href = '#login';
  loginLink.className = 'landing-login-link';
  loginLink.textContent = t('landing.loginLink');
  loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginSection(page);
  });
  navRight.appendChild(loginLink);

  nav.appendChild(navRight);
  page.appendChild(nav);

  // ── Hero ──
  const hero = document.createElement('section');
  hero.className = 'landing-hero';

  const heroContent = document.createElement('div');
  heroContent.className = 'landing-hero-content';

  const badge = document.createElement('span');
  badge.className = 'landing-badge';
  badge.textContent = t('landing.badge');
  heroContent.appendChild(badge);

  const h1 = document.createElement('h1');
  h1.className = 'landing-h1';
  h1.appendChild(document.createTextNode(t('landing.h1_line1')));
  h1.appendChild(document.createElement('br'));
  const accentSpan = document.createElement('span');
  accentSpan.className = 'accent';
  accentSpan.textContent = t('landing.h1_accent');
  h1.appendChild(accentSpan);
  heroContent.appendChild(h1);

  const subtitle = document.createElement('p');
  subtitle.className = 'landing-subtitle';
  subtitle.textContent = t('landing.subtitle');
  heroContent.appendChild(subtitle);

  const heroCTA = document.createElement('div');
  heroCTA.className = 'landing-hero-cta';

  const hasInvite = !!localStorage.getItem('jh_invite_code');

  const tryBtn = document.createElement('button');
  tryBtn.className = 'btn-primary btn-lg';
  tryBtn.textContent = hasInvite ? t('landing.inviteCTA') : t('landing.tryFree');
  tryBtn.addEventListener('click', async () => {
    track('landing_cta_click', { position: 'hero', hasInvite });
    if (hasInvite) {
      // Go to login — after OAuth, app.js will auto-claim the invite
      showLoginSection(page);
    } else {
      tryBtn.disabled = true;
      tryBtn.textContent = t('landing.wait');
      try {
        await api.guestLogin();
        track('signup', { method: 'guest' });
        navigate();
      } catch {
        tryBtn.disabled = false;
        tryBtn.textContent = t('landing.tryFree');
      }
    }
  });
  heroCTA.appendChild(tryBtn);

  if (hasInvite) {
    const inviteBadge = document.createElement('span');
    inviteBadge.className = 'landing-invite-badge';
    inviteBadge.textContent = t('landing.inviteBadge');
    heroCTA.appendChild(inviteBadge);
  } else {
    const tryHint = document.createElement('span');
    tryHint.className = 'landing-try-hint';
    tryHint.textContent = t('landing.tryHint');
    heroCTA.appendChild(tryHint);
  }

  heroContent.appendChild(heroCTA);

  const heroVisual = document.createElement('div');
  heroVisual.className = 'landing-hero-visual';
  const heroImg = document.createElement('img');
  heroImg.src = '/img/mascot/hero.webp';
  heroImg.alt = 'JH the raccoon, coding intensely';
  heroImg.className = 'landing-hero-img';
  heroImg.loading = 'eager';
  heroVisual.appendChild(heroImg);
  hero.appendChild(heroContent);
  hero.appendChild(heroVisual);
  page.appendChild(hero);

  // ── Problem ──
  const problem = document.createElement('section');
  problem.className = 'landing-section';

  const problemTitle = document.createElement('h2');
  problemTitle.className = 'landing-h2';
  problemTitle.textContent = t('landing.problemTitle');
  problem.appendChild(problemTitle);

  const problemGrid = document.createElement('div');
  problemGrid.className = 'landing-grid-3';

  const problems = [
    { iconName: 'shield-ban', title: t('landing.problem1Title'), text: t('landing.problem1Text') },
    { iconName: 'file-text', title: t('landing.problem2Title'), text: t('landing.problem2Text') },
    { iconName: 'clock', title: t('landing.problem3Title'), text: t('landing.problem3Text') },
  ];

  for (const p of problems) {
    const card = document.createElement('div');
    card.className = 'landing-card';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'landing-card-icon';
    iconWrap.appendChild(icon(p.iconName, { size: 32 }));
    card.appendChild(iconWrap);

    const cardTitle = document.createElement('h3');
    cardTitle.textContent = p.title;
    card.appendChild(cardTitle);

    const cardText = document.createElement('p');
    cardText.textContent = p.text;
    card.appendChild(cardText);

    problemGrid.appendChild(card);
  }

  problem.appendChild(problemGrid);
  page.appendChild(problem);

  // ── Comparison ──
  const comparison = document.createElement('section');
  comparison.className = 'landing-section landing-section-alt';

  const compTitle = document.createElement('h2');
  compTitle.className = 'landing-h2';
  compTitle.textContent = t('landing.compTitle');
  comparison.appendChild(compTitle);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'comparison-table-wrap';

  const table = document.createElement('table');
  table.className = 'comparison-table';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['', t('landing.compHeader1'), t('landing.compHeader2'), t('landing.compHeader3')].forEach((text, i) => {
    const th = document.createElement('th');
    th.textContent = text;
    if (i === 3) th.className = 'comp-highlight';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  const rows = [
    [t('landing.compRow1Label'), t('landing.compRow1A'), t('landing.compRow1B'), t('landing.compRow1C')],
    [t('landing.compRow2Label'), t('landing.compRow2A'), t('landing.compRow2B'), t('landing.compRow2C')],
    [t('landing.compRow3Label'), t('landing.compRow3A'), t('landing.compRow3B'), t('landing.compRow3C')],
    [t('landing.compRow4Label'), t('landing.compRow4A'), t('landing.compRow4B'), t('landing.compRow4C')],
    [t('landing.compRow5Label'), t('landing.compRow5A'), t('landing.compRow5B'), t('landing.compRow5C')],
  ];

  for (const rowData of rows) {
    const tr = document.createElement('tr');
    rowData.forEach((text, i) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (i === 0) td.className = 'comp-label';
      if (i === 3) td.className = 'comp-highlight';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  tableWrap.appendChild(table);
  comparison.appendChild(tableWrap);
  page.appendChild(comparison);

  // ── How it works ──
  const how = document.createElement('section');
  how.className = 'landing-section';

  const howTitle = document.createElement('h2');
  howTitle.className = 'landing-h2';
  howTitle.textContent = t('landing.howTitle');
  how.appendChild(howTitle);

  const steps = document.createElement('div');
  steps.className = 'landing-steps';

  const stepData = [
    { num: '1', title: t('landing.step1Title'), text: t('landing.step1Text') },
    { num: '2', title: t('landing.step2Title'), text: t('landing.step2Text') },
    { num: '3', title: t('landing.step3Title'), text: t('landing.step3Text') },
  ];

  for (const s of stepData) {
    const step = document.createElement('div');
    step.className = 'landing-step';

    const num = document.createElement('div');
    num.className = 'landing-step-num';
    num.textContent = s.num;
    step.appendChild(num);

    const content = document.createElement('div');
    content.className = 'landing-step-content';

    const stepTitle = document.createElement('h3');
    stepTitle.textContent = s.title;
    content.appendChild(stepTitle);

    const stepText = document.createElement('p');
    stepText.textContent = s.text;
    content.appendChild(stepText);

    step.appendChild(content);
    steps.appendChild(step);
  }

  how.appendChild(steps);
  page.appendChild(how);

  // ── Features ──
  const features = document.createElement('section');
  features.className = 'landing-section landing-section-alt';

  const featTitle = document.createElement('h2');
  featTitle.className = 'landing-h2';
  featTitle.textContent = t('landing.featTitle');
  features.appendChild(featTitle);

  const featGrid = document.createElement('div');
  featGrid.className = 'landing-grid-2';

  const featureData = [
    { title: t('landing.feat1Title'), text: t('landing.feat1Text') },
    { title: t('landing.feat2Title'), text: t('landing.feat2Text') },
    { title: t('landing.feat3Title'), text: t('landing.feat3Text') },
    { title: t('landing.feat4Title'), text: t('landing.feat4Text') },
  ];

  for (const f of featureData) {
    const card = document.createElement('div');
    card.className = 'landing-card';

    const cardTitle = document.createElement('h3');
    cardTitle.textContent = f.title;
    card.appendChild(cardTitle);

    const cardText = document.createElement('p');
    cardText.textContent = f.text;
    card.appendChild(cardText);

    featGrid.appendChild(card);
  }

  features.appendChild(featGrid);
  page.appendChild(features);

  // ── Metrics ──
  const metrics = document.createElement('section');
  metrics.className = 'landing-section landing-metrics';

  const metricsTitle = document.createElement('h2');
  metricsTitle.className = 'landing-h2';
  metricsTitle.textContent = t('landing.metricsTitle');
  metrics.appendChild(metricsTitle);

  const metricsGrid = document.createElement('div');
  metricsGrid.className = 'landing-grid-3';

  const metricData = [
    { value: t('landing.metric1Value'), label: t('landing.metric1Label') },
    { value: t('landing.metric2Value'), label: t('landing.metric2Label') },
    { value: t('landing.metric3Value'), label: t('landing.metric3Label') },
  ];

  for (const m of metricData) {
    const card = document.createElement('div');
    card.className = 'metric-card';

    const value = document.createElement('div');
    value.className = 'metric-value';
    value.textContent = m.value;
    card.appendChild(value);

    const label = document.createElement('div');
    label.className = 'metric-label';
    label.textContent = m.label;
    card.appendChild(label);

    metricsGrid.appendChild(card);
  }

  metrics.appendChild(metricsGrid);
  page.appendChild(metrics);

  // ── Pricing teaser ──
  const pricing = document.createElement('section');
  pricing.className = 'landing-section landing-section-alt';

  const priceTitle = document.createElement('h2');
  priceTitle.className = 'landing-h2';
  priceTitle.textContent = t('landing.pricingTitle');
  pricing.appendChild(priceTitle);

  const priceSubtitle = document.createElement('p');
  priceSubtitle.className = 'landing-section-subtitle';
  priceSubtitle.textContent = t('landing.pricingSubtitle');
  pricing.appendChild(priceSubtitle);

  const priceGrid = document.createElement('div');
  priceGrid.className = 'landing-grid-4';

  // Open Beta: single card instead of pricing tiers
  const betaCard = document.createElement('div');
  betaCard.className = 'landing-price-card highlighted beta-card';

  const betaBadge = document.createElement('div');
  betaBadge.className = 'price-name';
  betaBadge.textContent = t('beta.badge');
  betaCard.appendChild(betaBadge);

  const betaAmount = document.createElement('div');
  betaAmount.className = 'price-amount';
  betaAmount.textContent = '\u20AC0';
  betaCard.appendChild(betaAmount);

  const betaDetail = document.createElement('div');
  betaDetail.className = 'price-detail';
  betaDetail.textContent = '5 CV / giorno';
  betaCard.appendChild(betaDetail);

  const betaPerCv = document.createElement('div');
  betaPerCv.className = 'price-per-cv';
  betaPerCv.textContent = 'Gratis, per un periodo limitato';
  betaCard.appendChild(betaPerCv);

  priceGrid.appendChild(betaCard);

  pricing.appendChild(priceGrid);
  page.appendChild(pricing);

  // ── Final CTA ──
  const finalCta = document.createElement('section');
  finalCta.className = 'landing-section landing-final-cta';

  const ctaTitle = document.createElement('h2');
  ctaTitle.className = 'landing-h2';
  ctaTitle.textContent = t('landing.ctaTitle');
  finalCta.appendChild(ctaTitle);

  const ctaText = document.createElement('p');
  ctaText.className = 'landing-section-subtitle';
  ctaText.textContent = t('landing.ctaText');
  finalCta.appendChild(ctaText);

  const ctaBtn = document.createElement('button');
  ctaBtn.className = 'btn-primary btn-lg';
  ctaBtn.textContent = hasInvite ? t('landing.inviteCTA') : t('landing.ctaBtn');
  ctaBtn.addEventListener('click', async () => {
    track('landing_cta_click', { position: 'final', hasInvite });
    if (hasInvite) {
      showLoginSection(page);
    } else {
      ctaBtn.disabled = true;
      ctaBtn.textContent = t('landing.wait');
      try {
        await api.guestLogin();
        track('signup', { method: 'guest' });
        navigate();
      } catch {
        ctaBtn.disabled = false;
        ctaBtn.textContent = hasInvite ? t('landing.inviteCTA') : t('landing.ctaBtn');
      }
    }
  });
  finalCta.appendChild(ctaBtn);
  page.appendChild(finalCta);

  // ── Footer ──
  const footer = document.createElement('footer');
  footer.className = 'landing-footer';

  const footerContent = document.createElement('div');
  footerContent.className = 'landing-footer-content';

  const footerLogo = document.createElement('div');
  footerLogo.className = 'landing-footer-logo';
  const footerLogoImg = document.createElement('img');
  footerLogoImg.src = '/img/mascot/avatar.webp';
  footerLogoImg.alt = 'JH';
  footerLogoImg.className = 'landing-logo-img';
  footerLogo.appendChild(footerLogoImg);
  const footerLogoText = document.createElement('span');
  footerLogoText.textContent = t('landing.logo');
  footerLogo.appendChild(footerLogoText);
  footerContent.appendChild(footerLogo);

  const footerText = document.createElement('p');
  footerText.className = 'landing-footer-text';
  footerText.textContent = t('landing.footerTrust');
  footerContent.appendChild(footerText);

  const footerLinks = document.createElement('div');
  footerLinks.className = 'landing-footer-links';

  const privacyLink = document.createElement('a');
  privacyLink.href = '#privacy';
  privacyLink.textContent = 'Privacy Policy';
  privacyLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('privacy');
  });
  footerLinks.appendChild(privacyLink);

  const sep = document.createElement('span');
  sep.textContent = ' \u00B7 ';
  sep.className = 'landing-footer-sep';
  footerLinks.appendChild(sep);

  const termsLink = document.createElement('a');
  termsLink.href = '#terms';
  termsLink.textContent = 'Termini di Servizio';
  termsLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('terms');
  });
  footerLinks.appendChild(termsLink);

  footerContent.appendChild(footerLinks);

  footer.appendChild(footerContent);
  page.appendChild(footer);

  // Show login section immediately (before footer)
  showLoginSection(page);

  root.appendChild(page);
}

function showLoginSection(page) {
  let loginSection = page.querySelector('.landing-login-section');
  if (loginSection) {
    loginSection.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  loginSection = document.createElement('section');
  loginSection.className = 'landing-section landing-login-section';

  const card = document.createElement('div');
  card.className = 'login-card';

  const h2 = document.createElement('h2');
  h2.textContent = t('landing.loginLink');
  card.appendChild(h2);

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
    guestBtn.textContent = t('landing.wait');
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

  // Waitlist form (for users without invite)
  if (!localStorage.getItem('jh_invite_code')) {
    const waitlistDiv = document.createElement('div');
    waitlistDiv.className = 'landing-waitlist';

    const waitlistLabel = document.createElement('p');
    waitlistLabel.className = 'login-subtitle';
    waitlistLabel.textContent = t('landing.waitlistTitle');
    waitlistLabel.style.marginTop = '24px';
    waitlistDiv.appendChild(waitlistLabel);

    const waitlistForm = document.createElement('div');
    waitlistForm.className = 'waitlist-inline-form';

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = t('landing.waitlistPlaceholder');
    emailInput.className = 'waitlist-input';
    waitlistForm.appendChild(emailInput);

    const waitlistBtn = document.createElement('button');
    waitlistBtn.className = 'btn-secondary';
    waitlistBtn.textContent = t('landing.waitlistBtn');
    waitlistBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      if (!email) return;
      waitlistBtn.disabled = true;
      try {
        await api.joinWaitlist(email);
        waitlistForm.textContent = '';
        const done = document.createElement('p');
        done.className = 'waitlist-done';
        done.textContent = t('landing.waitlistDone');
        waitlistForm.appendChild(done);
      } catch {
        waitlistBtn.disabled = false;
      }
    });
    waitlistForm.appendChild(waitlistBtn);

    waitlistDiv.appendChild(waitlistForm);
    card.appendChild(waitlistDiv);
  }

  loginSection.appendChild(card);

  const footer = page.querySelector('.landing-footer');
  page.insertBefore(loginSection, footer);
  loginSection.scrollIntoView({ behavior: 'smooth' });
}
