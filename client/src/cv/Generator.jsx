import { useState, useCallback } from 'react';
import { api } from '../api';
import { t } from '../strings';
import { track } from '../analytics';
import Icon from '../components/Icon';

const STYLES = [
  { id: 'professional', name: 'Professional', font: 'Georgia, serif', color: '#0d7377' },
  { id: 'modern', name: 'Modern', font: 'Inter, sans-serif', color: '#1e3a5f' },
  { id: 'minimal', name: 'Minimal', font: 'Lato, sans-serif', color: '#333333' },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Fit Score (compact, inline) ──

function getScoreClass(score) {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'decent';
  if (score >= 40) return 'partial';
  return 'poor';
}

function getRaccoonTip(score) {
  if (score >= 85) return 'Match perfetto, candidati subito!';
  if (score >= 70) return 'Ottima compatibilità, vale la pena candidarsi.';
  if (score >= 50) return 'Base solida, il CV compenserà i gap.';
  if (score >= 30) return 'Gap importanti — valuta se concentrare le energie altrove.';
  return 'Profilo distante dal ruolo, candidati solo con contatto diretto.';
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

  const hasJd = jd.trim().length >= 80;

  // Explicit fit score check
  const handleCheckFit = useCallback(async () => {
    const trimmed = jd.trim();
    if (!trimmed || trimmed.length < 80) return;

    setFitLoading(true);
    setFitScore(null);
    try {
      const result = await api.fitScore({ profile, jobDescription: trimmed, language: lang });
      track('fit_score', { score: result.score });
      setFitScore(result);
    } catch {
      setStatus({ text: 'Errore durante l\'analisi. Riprova.', type: 'error' });
    } finally {
      setFitLoading(false);
    }
  }, [jd, profile, lang]);

  // Generate: extract keywords silently → generate CV
  const handleGenerate = useCallback(async () => {
    const trimmed = jd.trim();
    if (!trimmed) {
      setStatus({ text: t('generator.jdRequired'), type: 'error' });
      return;
    }

    setGenerating(true);
    setStatus({ text: '', type: '' });

    try {
      // Phase 1: Extract keywords silently
      setProgress({ visible: true, percent: 10, step: 'Analisi annuncio...' });
      let targetKeywords = null;
      try {
        const kwRes = await api.extractKeywords({ jobDescription: trimmed, language: lang });
        targetKeywords = (kwRes.keywords || []).map((kw) => ({
          term: kw.term,
          priority: kw.priority,
          category: kw.category,
        }));
        track('keywords_extracted', { count: targetKeywords.length });
      } catch {
        // Keywords extraction failed — proceed without, not blocking
      }

      // Phase 2: Generate CV
      setProgress({ visible: true, percent: 30, step: 'Generazione CV in corso...' });
      if (onJobDescription) onJobDescription(trimmed);

      const result = await api.generate({
        profile,
        jobDescription: trimmed,
        language: lang,
        style,
        targetKeywords,
      });

      setProgress({ visible: true, percent: 80, step: 'Finalizzazione...' });
      await sleep(300);

      track('cv_generated', { language: lang, style });

      setProgress({ visible: true, percent: 100, step: 'CV pronto!' });
      await sleep(500);

      setProgress({ visible: false, percent: 0, step: '' });
      if (onGenerated) onGenerated(result, trimmed, null, targetKeywords);
    } catch (err) {
      setProgress({ visible: false, percent: 0, step: '' });
      if (err.message === 'Crediti insufficienti' || err.message === 'Limite giornaliero raggiunto') {
        setStatus({
          text: err.message === 'Limite giornaliero raggiunto'
            ? 'Limite giornaliero raggiunto. Condividi il tuo link referral per ottenere Raccoin extra!'
            : 'Raccoin esauriti. Ricarica per continuare.',
          type: 'error',
        });
      } else {
        setStatus({ text: t('generator.error') + ' ' + err.message, type: 'error' });
      }
    } finally {
      setGenerating(false);
    }
  }, [jd, lang, profile, style, onGenerated, onJobDescription]);

  return (
    <div className="generation-step">
      {/* Job Description textarea */}
      <div className="form-group">
        <label>{t('generator.jdLabel')}</label>
        <textarea
          className="jd-textarea"
          placeholder={t('generator.jdPlaceholder')}
          style={{ minHeight: 200 }}
          value={jd}
          onChange={(e) => {
            setJd(e.target.value);
            // Reset fit score when JD changes
            if (fitScore) setFitScore(null);
          }}
        />
      </div>

      {/* Verifica compatibilità — collapsible panel */}
      <div className={`fit-panel${fitScore ? ' fit-panel-open' : ''}`}>
        {!fitScore ? (
          <button
            className={`fit-panel-trigger${hasJd && !fitLoading ? ' fit-ready' : ''}`}
            disabled={!hasJd || fitLoading}
            onClick={handleCheckFit}
          >
            <Icon name="target" size={18} />
            <span>{fitLoading ? 'Analisi in corso...' : 'Verifica compatibilità'}</span>
            {fitLoading && <div className="upload-spinner" style={{ width: 16, height: 16 }} />}
          </button>
        ) : (
          <div className="fit-panel-result">
            <div className="fit-result-header">
              <div className={`fit-score-pill fit-${getScoreClass(fitScore.score)}`}>
                {Math.round(fitScore.score)}/100
              </div>
              <span className="fit-result-title">Compatibilità</span>
            </div>
            {fitScore.strengths?.length > 0 && (
              <div className="fit-result-line fit-strength">
                <Icon name="check-circle" size={14} />
                <span>{fitScore.strengths[0]}</span>
              </div>
            )}
            {fitScore.gaps?.length > 0 && (
              <div className="fit-result-line fit-gap">
                <Icon name="alert-triangle" size={14} />
                <span>{fitScore.gaps[0]}</span>
              </div>
            )}
            <div className="fit-raccoon-tip">
              <img src="/img/mascot/avatar.webp" alt="" className="fit-raccoon-img" />
              <span>{getRaccoonTip(Math.round(fitScore.score))}</span>
            </div>
          </div>
        )}
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

      {/* Progress bar */}
      <ProgressBar visible={progress.visible} percent={progress.percent} stepText={progress.step} />

      {/* Status */}
      {status.text && (
        <div className={`generation-status ${status.type}`}>{status.text}</div>
      )}

      {/* Generate button */}
      <button
        className="btn-primary btn-generate"
        disabled={generating || !jd.trim()}
        onClick={handleGenerate}
      >
        {generating ? 'Generazione in corso...' : t('generator.generate')}
      </button>
    </div>
  );
}
