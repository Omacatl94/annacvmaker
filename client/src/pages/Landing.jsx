import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { t } from '../strings';
import Icon from '../components/Icon';

export default function Landing() {
  const navigate = useNavigate();
  const waitlistRef = useRef(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [waitlistedBanner, setWaitlistedBanner] = useState(false);

  // Handle ?waitlisted=1 redirect from OAuth (user not yet active)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('waitlisted') === '1') {
      setWaitlistedBanner(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const scrollToWaitlist = useCallback(() => {
    waitlistRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="landing-page">
      {waitlistedBanner && (
        <div className="waitlisted-banner">
          <p>{t('landing.waitlistedBanner')}</p>
          <button onClick={() => setWaitlistedBanner(false)} aria-label="Chiudi">&times;</button>
        </div>
      )}
      <Nav scrollToWaitlist={scrollToWaitlist} onLoginClick={() => setLoginOpen(true)} />
      <Hero scrollToWaitlist={scrollToWaitlist} />
      <ProblemSection />
      <ComparisonSection />
      <HowItWorks />
      <Features />
      <PricingTeaser />
      <WaitlistSection ref={waitlistRef} />
      <Footer navigate={navigate} />
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  );
}

// ── Login Modal (blur backdrop) ──

function LoginModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null); // null | { exists, active, providers }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCheck = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setChecking(true);
    try {
      const res = await api.checkEmail(trimmed);
      setResult(res);
    } catch {
      setResult({ exists: false });
    }
    setChecking(false);
  };

  const handleBack = () => {
    setResult(null);
    setEmail('');
  };

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose} aria-label="Chiudi">
          <Icon name="x" size={20} />
        </button>
        <img src="/img/mascot/avatar.webp" alt="" className="login-modal-avatar" />

        {!result ? (
          <>
            <h2>{t('landing.loginLink')}</h2>
            <p className="login-subtitle">{t('landing.loginModalSubtitle')}</p>
            <div className="login-email-form">
              <input
                type="email"
                placeholder={t('landing.waitlistPlaceholder')}
                className="waitlist-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                autoFocus
              />
              <button
                className="btn-primary"
                disabled={checking || !email.trim()}
                onClick={handleCheck}
              >
                {checking ? '...' : t('landing.loginCheckBtn')}
              </button>
            </div>
          </>
        ) : result.exists && result.active ? (
          <>
            <h2>{t('landing.loginWelcomeBack')}</h2>
            <p className="login-subtitle">{t('landing.loginChooseProvider')}</p>
            <OAuthButtons />
            <button className="login-modal-back" onClick={handleBack}>
              {t('landing.loginBackBtn')}
            </button>
          </>
        ) : result.exists && !result.active ? (
          <>
            <h2>{t('landing.loginWaitlisted')}</h2>
            <p className="login-subtitle">{t('landing.loginWaitlistedText')}</p>
            <button className="btn-primary" onClick={onClose}>{t('landing.loginOkBtn')}</button>
          </>
        ) : result.alreadyInWaitlist ? (
          <>
            <h2>{t('landing.loginAlreadyInWaitlist')}</h2>
            <p className="login-subtitle">{t('landing.loginAlreadyInWaitlistText')}</p>
            <button className="btn-primary" onClick={onClose}>{t('landing.loginOkBtn')}</button>
          </>
        ) : (
          <>
            <h2>{t('landing.loginAddedToWaitlist')}</h2>
            <p className="login-subtitle">{t('landing.loginAddedToWaitlistText')}</p>
            <button className="btn-primary" onClick={onClose}>{t('landing.loginOkBtn')}</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Nav ──

function Nav({ scrollToWaitlist, onLoginClick }) {
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
        <button className="theme-toggle" title={t('common.themeToggle')} aria-label={t('common.themeToggle')} onClick={toggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <button className="landing-login-link" onClick={onLoginClick}>
          {t('landing.loginLink')}
        </button>
      </div>
    </nav>
  );
}

// ── Hero ──

function Hero({ scrollToWaitlist }) {
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
          <button className="btn-primary btn-lg" onClick={scrollToWaitlist}>
            {t('landing.waitlistTitle')}
          </button>
          <span className="landing-try-hint">{t('landing.tryHint')}</span>
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

// ── Sections ──

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
            <div className="landing-card-body">
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
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

  const headers = [t('landing.compHeader1'), t('landing.compHeader2'), t('landing.compHeader3')];
  const columns = [
    [t('landing.compRow1A'), t('landing.compRow2A'), t('landing.compRow3A'), t('landing.compRow4A'), t('landing.compRow5A')],
    [t('landing.compRow1B'), t('landing.compRow2B'), t('landing.compRow3B'), t('landing.compRow4B'), t('landing.compRow5B')],
    [t('landing.compRow1C'), t('landing.compRow2C'), t('landing.compRow3C'), t('landing.compRow4C'), t('landing.compRow5C')],
  ];

  return (
    <section className="landing-section landing-section-alt">
      <h2 className="landing-h2">{t('landing.compTitle')}</h2>

      {/* Desktop: card layout */}
      <div className="comp-cards comp-desktop">
        {headers.map((header, ci) => (
          <div className={ci === 2 ? 'comp-card comp-card-highlight' : 'comp-card'} key={ci}>
            <h3>{header}</h3>
            {rowLabels.map((label, ri) => (
              <div className="comp-row" key={ri}>
                <span className="comp-row-label">{label}</span>
                <span className="comp-row-value">{columns[ci][ri]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Mobile: "loro vs tu" compact layout */}
      <div className="comp-mobile">
        {rowLabels.map((label, ri) => (
          <div className="comp-mobile-row" key={ri}>
            <div className="comp-mobile-label">{label}</div>
            <div className="comp-mobile-vs">
              <span className="comp-mobile-them">{columns[0][ri]}</span>
              <span className="comp-mobile-arrow">{'\u2192'}</span>
              <span className="comp-mobile-us">{columns[2][ri]}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const stepData = [
    { title: t('landing.step1Title'), text: t('landing.step1Text') },
    { title: t('landing.step2Title'), text: t('landing.step2Text') },
    { title: t('landing.step3Title'), text: t('landing.step3Text') },
  ];

  const sectionRef = useRef(null);
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let triggered = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !triggered) {
        triggered = true;
        stepData.forEach((_, i) => {
          setTimeout(() => setActiveStep(i), i * 800);
        });
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="landing-section" ref={sectionRef}>
      <h2 className="landing-h2">{t('landing.howTitle')}</h2>
      <div className="landing-steps">
        {stepData.map((s, i) => {
          const done = i <= activeStep;
          const current = i === activeStep;
          return (
            <div className={`landing-step${done ? ' step-done' : ''}${current ? ' step-current' : ''}`} key={i}>
              <div className="landing-step-check">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {done && <path d="M20 6L9 17l-5-5" className="check-path" />}
                </svg>
              </div>
              {i < stepData.length - 1 && (
                <div className={`landing-step-line${done ? ' line-done' : ''}`} />
              )}
              <div className="landing-step-content">
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Features() {
  const featureData = [
    { iconName: 'wand', title: t('landing.feat1Title'), text: t('landing.feat1Text') },
    { iconName: 'target', title: t('landing.feat2Title'), text: t('landing.feat2Text') },
    { iconName: 'palette', title: t('landing.feat3Title'), text: t('landing.feat3Text') },
    { iconName: 'zap', title: t('landing.feat4Title'), text: t('landing.feat4Text') },
    { iconName: 'sparkles', title: t('landing.feat5Title'), text: t('landing.feat5Text'), comingSoon: true },
  ];

  return (
    <section className="landing-section landing-section-alt">
      <h2 className="landing-h2">{t('landing.featTitle')}</h2>
      <div className="bento-grid">
        {featureData.map((f, i) => (
          <div className={`bento-item bento-item-${i}${f.comingSoon ? ' bento-coming' : ''}`} key={i}>
            <div className="bento-icon">
              <Icon name={f.iconName} size={i === 0 ? 36 : 28} />
            </div>
            <h3>{f.title}{f.comingSoon && <span className="bento-soon-badge">Soon</span>}</h3>
            <p>{f.text}</p>
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

// ── Final CTA + Waitlist (single block) ──

const WaitlistSection = forwardRef(function WaitlistSection(props, ref) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyActive, setAlreadyActive] = useState(false);

  const handleWaitlist = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await api.joinWaitlist(trimmed);
      if (res.alreadyActive) {
        setAlreadyActive(true);
      } else {
        setDone(true);
      }
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <section className="landing-section landing-final-cta" ref={ref}>
      <h2 className="landing-h2">{t('landing.ctaTitle')}</h2>
      <p className="landing-section-subtitle">{t('landing.ctaText')}</p>

      <div className="waitlist-card">
        <h3>{t('landing.waitlistTitle')}</h3>
        <p className="login-subtitle">{t('landing.waitlistSubtitle')}</p>

        {alreadyActive ? (
          <div className="waitlist-already-active">
            <img src="/img/mascot/avatar.webp" alt="" className="waitlist-raccoon" />
            <p>{t('landing.waitlistAlreadyActive')}</p>
          </div>
        ) : done ? (
          <div className="waitlist-done-msg">
            <Icon name="check-circle" size={24} />
            <p>{t('landing.waitlistDone')}</p>
          </div>
        ) : (
          <div className="waitlist-inline-form">
            <input
              type="email"
              placeholder={t('landing.waitlistPlaceholder')}
              className="waitlist-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleWaitlist()}
            />
            <button
              className="btn-primary"
              disabled={submitting}
              onClick={handleWaitlist}
            >
              {submitting ? '...' : t('landing.waitlistBtn')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
});

// ── OAuth Buttons ──

function OAuthButtons() {
  return (
    <div className="login-buttons">
      <a href="/api/auth/google" className="login-btn google-btn">
        <svg className="oauth-icon" viewBox="0 0 24 24" width="20" height="20" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {t('auth.google')}
      </a>
      <a href="/api/auth/linkedin" className="login-btn linkedin-btn">
        <svg className="oauth-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        {t('auth.linkedin')}
      </a>
    </div>
  );
}

// ── Footer ──

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
