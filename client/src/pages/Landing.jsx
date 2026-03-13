import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { t } from '../strings';
import Icon from '../components/Icon';

export default function Landing() {
  const navigate = useNavigate();
  const loginRef = useRef(null);
  const hasInvite = !!localStorage.getItem('jh_invite_code');

  const scrollToLogin = useCallback(() => {
    loginRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="landing-page">
      <Nav scrollToLogin={scrollToLogin} />
      <Hero hasInvite={hasInvite} scrollToLogin={scrollToLogin} />
      <ProblemSection />
      <ComparisonSection />
      <HowItWorks />
      <Features />
      <Metrics />
      <PricingTeaser />
      <FinalCTA hasInvite={hasInvite} scrollToLogin={scrollToLogin} />
      <LoginSection ref={loginRef} hasInvite={hasInvite} />
      <Footer navigate={navigate} />
    </div>
  );
}

function Nav({ scrollToLogin }) {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark'
  );

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('jh-theme', next);
    setTheme(next);
  };

  return (
    <nav className="landing-nav">
      <div className="landing-logo">
        <img src="/img/mascot/avatar.webp" alt="JH" className="landing-logo-img" />
        <span>{t('landing.logo')}</span>
      </div>
      <div className="landing-nav-right">
        <button className="theme-toggle" title={t('common.themeToggle')} onClick={toggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <a
          href="#login"
          className="landing-login-link"
          onClick={(e) => {
            e.preventDefault();
            scrollToLogin();
          }}
        >
          {t('landing.loginLink')}
        </a>
      </div>
    </nav>
  );
}

function Hero({ hasInvite, scrollToLogin }) {
  return (
    <section className="landing-hero">
      <div className="landing-hero-content">
        <span className="landing-badge">{t('landing.badge')}</span>
        <h1 className="landing-h1">
          {t('landing.h1_line1')}
          <br />
          <span className="accent">{t('landing.h1_accent')}</span>
        </h1>
        <p className="landing-subtitle">{t('landing.subtitle')}</p>
        <div className="landing-hero-cta">
          <button className="btn-primary btn-lg" onClick={scrollToLogin}>
            {hasInvite ? t('landing.inviteCTA') : t('landing.waitlistTitle')}
          </button>
          {hasInvite ? (
            <span className="landing-invite-badge">{t('landing.inviteBadge')}</span>
          ) : (
            <span className="landing-try-hint">{t('landing.tryHint')}</span>
          )}
        </div>
      </div>
      <div className="landing-hero-visual">
        <img
          src="/img/mascot/hero.webp"
          alt="JH the raccoon, coding intensely"
          className="landing-hero-img"
          loading="eager"
        />
      </div>
    </section>
  );
}

function ProblemSection() {
  const problems = [
    { iconName: 'shield-ban', title: t('landing.problem1Title'), text: t('landing.problem1Text') },
    { iconName: 'file-text', title: t('landing.problem2Title'), text: t('landing.problem2Text') },
    { iconName: 'clock', title: t('landing.problem3Title'), text: t('landing.problem3Text') },
  ];

  return (
    <section className="landing-section">
      <h2 className="landing-h2">{t('landing.problemTitle')}</h2>
      <div className="landing-grid-3">
        {problems.map((p, i) => (
          <div className="landing-card" key={i}>
            <div className="landing-card-icon">
              <Icon name={p.iconName} size={32} />
            </div>
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ComparisonSection() {
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

  return (
    <section className="landing-section landing-section-alt">
      <h2 className="landing-h2">{t('landing.compTitle')}</h2>
      <div className="comp-cards">
        {cardDefs.map((def, ci) => (
          <div className={def.highlight ? 'comp-card comp-card-highlight' : 'comp-card'} key={ci}>
            <h3>{def.header}</h3>
            {rowLabels.map((label, ri) => (
              <div className="comp-row" key={ri}>
                <span className="comp-row-label">{label}</span>
                <span className="comp-row-value">{def.values[ri]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const stepData = [
    { num: '1', title: t('landing.step1Title'), text: t('landing.step1Text') },
    { num: '2', title: t('landing.step2Title'), text: t('landing.step2Text') },
    { num: '3', title: t('landing.step3Title'), text: t('landing.step3Text') },
  ];

  return (
    <section className="landing-section">
      <h2 className="landing-h2">{t('landing.howTitle')}</h2>
      <div className="landing-steps">
        {stepData.map((s, i) => (
          <div className="landing-step" key={i}>
            <div className="landing-step-num">{s.num}</div>
            <div className="landing-step-content">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const featureData = [
    { title: t('landing.feat1Title'), text: t('landing.feat1Text') },
    { title: t('landing.feat2Title'), text: t('landing.feat2Text') },
    { title: t('landing.feat3Title'), text: t('landing.feat3Text') },
    { title: t('landing.feat4Title'), text: t('landing.feat4Text') },
  ];

  return (
    <section className="landing-section landing-section-alt">
      <h2 className="landing-h2">{t('landing.featTitle')}</h2>
      <div className="landing-grid-2">
        {featureData.map((f, i) => (
          <div className="landing-card" key={i}>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metrics() {
  const metricData = [
    { value: t('landing.metric1Value'), label: t('landing.metric1Label') },
    { value: t('landing.metric2Value'), label: t('landing.metric2Label') },
    { value: t('landing.metric3Value'), label: t('landing.metric3Label') },
  ];

  return (
    <section className="landing-section landing-metrics">
      <h2 className="landing-h2">{t('landing.metricsTitle')}</h2>
      <div className="landing-grid-3">
        {metricData.map((m, i) => (
          <div className="metric-card" key={i}>
            <div className="metric-value">{m.value}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PricingTeaser() {
  return (
    <section className="landing-section landing-section-alt">
      <h2 className="landing-h2">{t('landing.pricingTitle')}</h2>
      <p className="landing-section-subtitle">{t('landing.pricingSubtitle')}</p>
      <div className="landing-price-card highlighted beta-card">
        <div className="price-name">{t('beta.badge')}</div>
        <div className="price-amount">{'\u20AC0'}</div>
        <div className="price-detail">{t('beta.landingText')}</div>
        <div className="price-per-cv">{t('beta.modalHint')}</div>
      </div>
    </section>
  );
}

function FinalCTA({ hasInvite, scrollToLogin }) {
  return (
    <section className="landing-section landing-final-cta">
      <h2 className="landing-h2">{t('landing.ctaTitle')}</h2>
      <p className="landing-section-subtitle">{t('landing.ctaText')}</p>
      <button className="btn-primary btn-lg" onClick={scrollToLogin}>
        {hasInvite ? t('landing.inviteCTA') : t('landing.waitlistTitle')}
      </button>
    </section>
  );
}

import { forwardRef } from 'react';

const LoginSection = forwardRef(function LoginSection({ hasInvite }, ref) {
  const [showOAuth, setShowOAuth] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleWaitlist = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await api.joinWaitlist(trimmed);
      setDone(true);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <section className="landing-section landing-login-section" ref={ref}>
      <div className="login-card">
        {hasInvite ? (
          <>
            <h2>{t('landing.inviteCTA')}</h2>
            <p className="login-subtitle">
              {t('landing.inviteBadge')}. {t('landing.loginLink')} per attivarlo.
            </p>
            <OAuthButtons />
          </>
        ) : (
          <>
            <h2>{t('landing.waitlistTitle')}</h2>
            <p className="login-subtitle">
              {t('beta.landingTitle')}. {t('landing.waitlistPlaceholder')} e ti avviseremo.
            </p>
            {!showOAuth ? (
              <>
                <div className="waitlist-inline-form">
                  {done ? (
                    <p className="waitlist-done">{t('landing.waitlistDone')}</p>
                  ) : (
                    <>
                      <input
                        type="email"
                        placeholder={t('landing.waitlistPlaceholder')}
                        className="waitlist-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <button
                        className="btn-secondary"
                        disabled={submitting}
                        onClick={handleWaitlist}
                      >
                        {t('landing.waitlistBtn')}
                      </button>
                    </>
                  )}
                </div>
                <div className="landing-login-toggle">
                  {'Hai gi\u00E0 un codice invito? '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowOAuth(true);
                    }}
                  >
                    Accedi qui
                  </a>
                </div>
              </>
            ) : (
              <OAuthButtons />
            )}
          </>
        )}
      </div>
    </section>
  );
});

function OAuthButtons() {
  return (
    <div className="login-buttons">
      <a href="/api/auth/google" className="login-btn google-btn">
        {t('auth.google')}
      </a>
      <a href="/api/auth/linkedin" className="login-btn linkedin-btn">
        {t('auth.linkedin')}
      </a>
    </div>
  );
}

function Footer({ navigate }) {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-content">
        <div className="landing-footer-logo">
          <img src="/img/mascot/avatar.webp" alt="JH" className="landing-logo-img" />
          <span>{t('landing.logo')}</span>
        </div>
        <p className="landing-footer-text">{t('landing.footerTrust')}</p>
        <div className="landing-footer-links">
          <a
            href="#privacy"
            onClick={(e) => {
              e.preventDefault();
              navigate('/privacy');
            }}
          >
            Privacy Policy
          </a>
          <span className="landing-footer-sep"> {'\u00B7'} </span>
          <a
            href="#terms"
            onClick={(e) => {
              e.preventDefault();
              navigate('/terms');
            }}
          >
            Termini di Servizio
          </a>
        </div>
      </div>
    </footer>
  );
}
