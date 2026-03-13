import { api } from './api.js';
import { navigate } from './app.js';
import { t } from './strings.js';
import { icon } from './icons.js';
import { track } from './analytics.js';

export function renderLanding(root) {
  root.textContent = '';

  const page = document.createElement('div');
  page.className = 'landing-page';

  const hasInvite = !!localStorage.getItem('jh_invite_code');

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
    const section = page.querySelector('.landing-login-section');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
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

  const tryBtn = document.createElement('button');
  tryBtn.className = 'btn-primary btn-lg';
  tryBtn.textContent = hasInvite ? t('landing.inviteCTA') : t('landing.waitlistTitle');
  tryBtn.addEventListener('click', () => {
    track('landing_cta_click', { position: 'hero', hasInvite });
    const section = page.querySelector('.landing-login-section');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
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

  // ── Comparison (card layout) ──
  const comparison = document.createElement('section');
  comparison.className = 'landing-section landing-section-alt';

  const compTitle = document.createElement('h2');
  compTitle.className = 'landing-h2';
  compTitle.textContent = t('landing.compTitle');
  comparison.appendChild(compTitle);

  const compCards = document.createElement('div');
  compCards.className = 'comp-cards';

  const rowLabels = [
    t('landing.compRow1Label'),
    t('landing.compRow2Label'),
    t('landing.compRow3Label'),
    t('landing.compRow4Label'),
    t('landing.compRow5Label'),
  ];

  const cardDefs = [
    { header: t('landing.compHeader1'), values: [t('landing.compRow1A'), t('landing.compRow2A'), t('landing.compRow3A'), t('landing.compRow4A'), t('landing.compRow5A')], highlight: false },
    { header: t('landing.compHeader2'), values: [t('landing.compRow1B'), t('landing.compRow2B'), t('landing.compRow3B'), t('landing.compRow4B'), t('landing.compRow5B')], highlight: false },
    { header: t('landing.compHeader3'), values: [t('landing.compRow1C'), t('landing.compRow2C'), t('landing.compRow3C'), t('landing.compRow4C'), t('landing.compRow5C')], highlight: true },
  ];

  for (const def of cardDefs) {
    const card = document.createElement('div');
    card.className = def.highlight ? 'comp-card comp-card-highlight' : 'comp-card';

    const cardH3 = document.createElement('h3');
    cardH3.textContent = def.header;
    card.appendChild(cardH3);

    for (let i = 0; i < rowLabels.length; i++) {
      const row = document.createElement('div');
      row.className = 'comp-row';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'comp-row-label';
      labelSpan.textContent = rowLabels[i];
      row.appendChild(labelSpan);

      const valueSpan = document.createElement('span');
      valueSpan.className = 'comp-row-value';
      valueSpan.textContent = def.values[i];
      row.appendChild(valueSpan);

      card.appendChild(row);
    }

    compCards.appendChild(card);
  }

  comparison.appendChild(compCards);
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
  betaDetail.textContent = t('beta.landingText');
  betaCard.appendChild(betaDetail);

  const betaPerCv = document.createElement('div');
  betaPerCv.className = 'price-per-cv';
  betaPerCv.textContent = t('beta.modalHint');
  betaCard.appendChild(betaPerCv);

  pricing.appendChild(betaCard);
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
  ctaBtn.textContent = hasInvite ? t('landing.inviteCTA') : t('landing.waitlistTitle');
  ctaBtn.addEventListener('click', () => {
    track('landing_cta_click', { position: 'final', hasInvite });
    const section = page.querySelector('.landing-login-section');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
  });
  finalCta.appendChild(ctaBtn);
  page.appendChild(finalCta);

  // ── Login section (inline, before footer) ──
  const loginSection = document.createElement('section');
  loginSection.className = 'landing-section landing-login-section';

  const loginCard = document.createElement('div');
  loginCard.className = 'login-card';

  if (hasInvite) {
    // ── Invite state: OAuth buttons ──
    const loginH2 = document.createElement('h2');
    loginH2.textContent = t('landing.inviteCTA');
    loginCard.appendChild(loginH2);

    const loginSub = document.createElement('p');
    loginSub.className = 'login-subtitle';
    loginSub.textContent = t('landing.inviteBadge') + '. ' + t('landing.loginLink') + ' per attivarlo.';
    loginCard.appendChild(loginSub);

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

    loginCard.appendChild(buttons);
  } else {
    // ── No invite state: waitlist form ──
    const loginH2 = document.createElement('h2');
    loginH2.textContent = t('landing.waitlistTitle');
    loginCard.appendChild(loginH2);

    const loginSub = document.createElement('p');
    loginSub.className = 'login-subtitle';
    loginSub.textContent = t('beta.landingTitle') + '. ' + t('landing.waitlistPlaceholder') + ' e ti avviseremo.';
    loginCard.appendChild(loginSub);

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

    loginCard.appendChild(waitlistForm);

    // "Hai gia' un codice invito?" toggle
    const toggle = document.createElement('div');
    toggle.className = 'landing-login-toggle';
    toggle.appendChild(document.createTextNode('Hai gi\u00E0 un codice invito? '));
    const toggleLink = document.createElement('a');
    toggleLink.textContent = 'Accedi qui';
    toggleLink.addEventListener('click', (e) => {
      e.preventDefault();
      // Replace waitlist with OAuth buttons
      toggle.style.display = 'none';
      waitlistForm.style.display = 'none';

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

      loginCard.appendChild(buttons);
    });
    toggle.appendChild(toggleLink);
    loginCard.appendChild(toggle);
  }

  loginSection.appendChild(loginCard);
  page.appendChild(loginSection);

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

  root.appendChild(page);
}
