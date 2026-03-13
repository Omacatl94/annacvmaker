import { useState, useRef, useCallback } from 'react';
import { api } from '../api';
import { t } from '../strings';
import { track } from '../analytics';

const STYLES = [
  { id: 'professional', name: 'Professional', font: 'Georgia, serif', color: '#0d7377' },
  { id: 'modern', name: 'Modern', font: 'Inter, sans-serif', color: '#1e3a5f' },
  { id: 'minimal', name: 'Minimal', font: 'Lato, sans-serif', color: '#333333' },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Fit Score Card ──

function FitScoreCard({ result }) {
  if (!result) return null;

  const score = Math.round(result.score || 0);
  let scoreClass = 'poor';
  if (score >= 80) scoreClass = 'strong';
  else if (score >= 60) scoreClass = 'decent';
  else if (score >= 40) scoreClass = 'partial';

  return (
    <div className="fit-score-card">
      <div className={`fit-score-circle fit-${scoreClass}`}>
        <span className="fit-score-num">{score}</span>
        <span className="fit-score-label">/100</span>
      </div>
      <div className="fit-score-info">
        {result.summary && <p className="fit-score-summary">{result.summary}</p>}
        {result.strengths?.length > 0 && (
          <div className="fit-score-list strengths">
            <strong>Punti di forza: </strong>
            {result.strengths.join(' \u00B7 ')}
          </div>
        )}
        {result.gaps?.length > 0 && (
          <div className="fit-score-list gaps">
            <strong>Gap: </strong>
            {result.gaps.join(' \u00B7 ')}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Keyword Review Panel ──

function KeywordReviewPanel({ kwResult, onConfirm, onSkip }) {
  const [selections, setSelections] = useState(() => {
    const map = {};
    (kwResult.keywords || []).forEach((kw) => {
      map[kw.term] = kw.priority !== 'low'; // high & medium checked by default
    });
    return map;
  });

  const groups = { high: [], medium: [], low: [] };
  (kwResult.keywords || []).forEach((kw) => {
    if (groups[kw.priority]) groups[kw.priority].push(kw);
    else groups.medium.push(kw);
  });

  const groupLabels = {
    high: { label: 'Must-have', cssClass: 'kw-priority-high' },
    medium: { label: 'Nice-to-have', cssClass: 'kw-priority-medium' },
    low: { label: 'Opzionali', cssClass: 'kw-priority-low' },
  };

  const handleConfirm = () => {
    const selected = (kwResult.keywords || [])
      .filter((kw) => selections[kw.term])
      .map((kw) => ({ term: kw.term, priority: kw.priority, category: kw.category }));
    onConfirm(selected);
  };

  return (
    <div className="keyword-review-panel card">
      <div className="kw-review-header">
        <h3>{t('generator.kwTitle')}</h3>
        {kwResult.roleTitle && (
          <span className="kw-review-subtitle">
            {kwResult.roleTitle}
            {kwResult.domain ? ' \u2014 ' + kwResult.domain : ''}
          </span>
        )}
      </div>

      <p className="kw-review-desc">{t('generator.kwSubtitle')}</p>

      {Object.entries(groups).map(([priority, keywords]) => {
        if (keywords.length === 0) return null;
        return (
          <div key={priority} className="kw-priority-group">
            <div className={`kw-group-label ${groupLabels[priority].cssClass}`}>
              {groupLabels[priority].label} ({keywords.length})
            </div>
            <div className="kw-tags-wrap">
              {keywords.map((kw) => (
                <label key={kw.term} className={`kw-review-tag ${groupLabels[priority].cssClass}`}>
                  <input
                    type="checkbox"
                    checked={!!selections[kw.term]}
                    onChange={(e) =>
                      setSelections((prev) => ({ ...prev, [kw.term]: e.target.checked }))
                    }
                  />
                  <span>{kw.term}</span>
                  <small className="kw-cat-badge">{kw.category}</small>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      <div className="kw-review-actions">
        <button className="btn-primary" onClick={handleConfirm}>
          {t('generator.kwConfirm')}
        </button>
        <button className="btn-secondary" onClick={onSkip}>
          {t('generator.kwSkip')}
        </button>
      </div>
    </div>
  );
}

// ── Progress Bar ──

function ProgressBar({ visible, percent, stepText }) {
  if (!visible) return null;
  return (
    <div className="progress-container" style={{ display: 'block' }}>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-step">{stepText}</div>
    </div>
  );
}

// ── One-Tap Section ──

function OneTapSection({ profile, style, onGenerated }) {
  const [jd, setJd] = useState('');
  const [lang, setLang] = useState('it');
  const [status, setStatus] = useState({ text: '', type: '' });
  const [progress, setProgress] = useState({ visible: false, percent: 0, step: '' });
  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    const trimmed = jd.trim();
    if (!trimmed) {
      setStatus({ text: 'Incolla un annuncio prima di generare.', type: 'error' });
      return;
    }

    setGenerating(true);
    setStatus({ text: '', type: '' });

    try {
      setProgress({ visible: true, percent: 10, step: t('generator.progress1') });
      const kwResult = await api.extractKeywords({ jobDescription: trimmed, language: lang });

      const allKeywords = (kwResult.keywords || []).map((kw) => ({
        term: kw.term,
        priority: kw.priority,
        category: kw.category,
      }));

      setProgress({ visible: true, percent: 30, step: t('generator.progress3') });
      const result = await api.generate({
        profile,
        jobDescription: trimmed,
        language: lang,
        style,
        targetKeywords: allKeywords,
      });

      setProgress({ visible: true, percent: 80, step: t('generator.progress4') });
      await sleep(300);

      track('cv_generated', { language: lang, style, oneTap: true });

      setProgress({ visible: true, percent: 100, step: t('generator.progress5') });
      await sleep(500);

      setProgress({ visible: false, percent: 0, step: '' });
      if (onGenerated) onGenerated(result, trimmed, lang);
    } catch (err) {
      setProgress({ visible: false, percent: 0, step: '' });
      if (err.message === 'Crediti insufficienti' || err.message === 'Limite giornaliero raggiunto') {
        setStatus({
          text: err.message === 'Limite giornaliero raggiunto'
            ? 'Limite giornaliero raggiunto. Condividi il tuo link referral per ottenere crediti extra!'
            : 'Crediti esauriti. Ricarica per continuare.',
          type: 'error',
        });
      } else {
        setStatus({ text: t('generator.error') + ' ' + err.message, type: 'error' });
      }
    } finally {
      setGenerating(false);
    }
  }, [jd, lang, profile, style, onGenerated]);

  return (
    <div className="one-tap-section">
      <h3>Genera CV per un nuovo annuncio</h3>
      <p className="one-tap-hint">Incolla un annuncio e genera il CV in un click. Usa il tuo profilo attuale.</p>

      <textarea
        className="jd-textarea"
        placeholder="Incolla qui la job description..."
        style={{ minHeight: 120 }}
        value={jd}
        onChange={(e) => setJd(e.target.value)}
      />

      <div className="one-tap-options">
        {['it', 'en'].map((l) => (
          <button
            key={l}
            className={`lang-btn${l === lang ? ' active' : ''}`}
            onClick={() => setLang(l)}
          >
            {l === 'it' ? 'IT' : 'EN'}
          </button>
        ))}
      </div>

      <ProgressBar visible={progress.visible} percent={progress.percent} stepText={progress.step} />

      {status.text && (
        <div className={`generation-status ${status.type}`}>{status.text}</div>
      )}

      <button className="btn-primary btn-generate" disabled={generating} onClick={handleGenerate}>
        {t('generator.generate')}
      </button>
    </div>
  );
}

// ── Main Generator Component ──

export default function Generator({
  profile,
  style,
  lang,
  onStyleChange,
  onLangChange,
  onJobDescription,
  onGenerated,
}) {
  const [jd, setJd] = useState('');
  const [status, setStatus] = useState({ text: '', type: '' });
  const [progress, setProgress] = useState({ visible: false, percent: 0, step: '' });
  const [generating, setGenerating] = useState(false);
  const [fitScore, setFitScore] = useState(null);
  const [fitLoading, setFitLoading] = useState(false);
  const [kwResult, setKwResult] = useState(null);
  const lastJdChecked = useRef('');
  const fitTimer = useRef(null);

  // Debounced fit score
  const triggerFitScore = useCallback(() => {
    const trimmed = jd.trim();
    if (!trimmed || trimmed.length < 80 || trimmed === lastJdChecked.current) return;
    lastJdChecked.current = trimmed;

    clearTimeout(fitTimer.current);
    fitTimer.current = setTimeout(async () => {
      setFitLoading(true);
      try {
        const result = await api.fitScore({ profile, jobDescription: trimmed, language: lang });
        track('fit_score', { score: result.score });
        setFitScore(result);
      } catch {
        setFitScore(null);
      } finally {
        setFitLoading(false);
      }
    }, 800);
  }, [jd, profile, lang]);

  const handleJdBlur = useCallback(() => {
    triggerFitScore();
    if (onJobDescription) onJobDescription(jd.trim());
  }, [triggerFitScore, jd, onJobDescription]);

  const handleJdPaste = useCallback(() => {
    setTimeout(() => triggerFitScore(), 100);
  }, [triggerFitScore]);

  // Generate with keywords
  const generateWithKeywords = useCallback(async (selectedKw) => {
    setKwResult(null);
    setProgress({ visible: true, percent: 30, step: t('generator.progress3') });

    const result = await api.generate({
      profile,
      jobDescription: jd.trim(),
      language: lang,
      style,
      targetKeywords: selectedKw,
    });

    setProgress({ visible: true, percent: 80, step: t('generator.progress4') });
    await sleep(300);

    track('cv_generated', { language: lang, style, targeted: !!selectedKw });

    setProgress({ visible: true, percent: 100, step: t('generator.progress5') });
    await sleep(500);

    setProgress({ visible: false, percent: 0, step: '' });
    setStatus({ text: t('generator.success'), type: 'success' });

    if (onGenerated) onGenerated(result, jd.trim());
  }, [profile, jd, lang, style, onGenerated]);

  const handleGenerate = useCallback(async () => {
    const trimmed = jd.trim();
    if (!trimmed) {
      setStatus({ text: t('generator.jdRequired'), type: 'error' });
      return;
    }

    setGenerating(true);
    setStatus({ text: '', type: '' });

    try {
      // Phase 1: Extract keywords
      setProgress({ visible: true, percent: 10, step: t('generator.progress1') });
      const kwRes = await api.extractKeywords({ jobDescription: trimmed, language: lang });
      track('keywords_extracted', { count: (kwRes.keywords || []).length });
      setProgress({ visible: true, percent: 20, step: t('generator.progress2') });

      // Phase 2: Show keyword review
      setProgress({ visible: false, percent: 0, step: '' });
      setKwResult(kwRes);
    } catch (err) {
      setProgress({ visible: false, percent: 0, step: '' });
      if (err.message === 'Crediti insufficienti' || err.message === 'Limite giornaliero raggiunto') {
        setStatus({
          text: err.message === 'Limite giornaliero raggiunto'
            ? 'Limite giornaliero raggiunto. Condividi il tuo link referral per ottenere crediti extra!'
            : 'Crediti esauriti. Ricarica per continuare.',
          type: 'error',
        });
      } else {
        setStatus({ text: t('generator.error') + ' ' + err.message, type: 'error' });
      }
      setGenerating(false);
    }
  }, [jd, lang]);

  const handleKwConfirm = useCallback(async (selectedKw) => {
    try {
      await generateWithKeywords(selectedKw);
    } catch (err) {
      setProgress({ visible: false, percent: 0, step: '' });
      setStatus({ text: t('generator.error') + ' ' + err.message, type: 'error' });
    } finally {
      setGenerating(false);
    }
  }, [generateWithKeywords]);

  const handleKwSkip = useCallback(async () => {
    setKwResult(null);
    try {
      await generateWithKeywords(null);
    } catch (err) {
      setProgress({ visible: false, percent: 0, step: '' });
      setStatus({ text: t('generator.error') + ' ' + err.message, type: 'error' });
    } finally {
      setGenerating(false);
    }
  }, [generateWithKeywords]);

  return (
    <>
      {/* One-Tap section */}
      <OneTapSection profile={profile} style={style} onGenerated={onGenerated} />

      {/* Full generation step */}
      <div className="generation-step">
        <h2>Genera il tuo CV</h2>

        {/* Job Description textarea */}
        <div className="form-group">
          <label>{t('generator.jdLabel')}</label>
          <textarea
            className="jd-textarea"
            placeholder={t('generator.jdPlaceholder')}
            style={{ minHeight: 200 }}
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            onBlur={handleJdBlur}
            onPaste={handleJdPaste}
          />
        </div>

        {/* Language selector */}
        <div className="lang-selector">
          <label>{t('generator.langLabel')}:</label>
          {['it', 'en'].map((l) => (
            <button
              key={l}
              className={`lang-btn${l === lang ? ' active' : ''}`}
              onClick={() => onLangChange(l)}
            >
              {l === 'it' ? 'Italiano' : 'English'}
            </button>
          ))}
        </div>

        {/* Style selector */}
        <div className="style-selector">
          <label>{t('generator.styleLabel')}:</label>
          <div className="styles-row">
            {STYLES.map((s) => (
              <div
                key={s.id}
                className={`style-preview${s.id === style ? ' active' : ''}`}
                onClick={() => onStyleChange(s.id)}
              >
                <div className="style-mock-header" style={{ background: s.color }} />
                <div className="style-mock-body">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="style-mock-line"
                      style={i === 0 ? { borderColor: s.color } : undefined}
                    />
                  ))}
                </div>
                <span className="style-label" style={{ fontFamily: s.font }}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fit Score */}
        {fitLoading && (
          <div className="fit-score-card loading">Analisi compatibilita' in corso...</div>
        )}
        {!fitLoading && fitScore && <FitScoreCard result={fitScore} />}

        {/* Keyword Review Panel */}
        {kwResult && (
          <KeywordReviewPanel
            kwResult={kwResult}
            onConfirm={handleKwConfirm}
            onSkip={handleKwSkip}
          />
        )}

        {/* Progress bar */}
        <ProgressBar visible={progress.visible} percent={progress.percent} stepText={progress.step} />

        {/* Status */}
        {status.text && (
          <div className={`generation-status ${status.type}`}>{status.text}</div>
        )}

        {/* Generate button */}
        <button className="btn-primary btn-generate" disabled={generating} onClick={handleGenerate}>
          {t('generator.generate')}
        </button>
      </div>
    </>
  );
}
