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

// ── Raccoon Advice ──

const RACCOON_ADVICE = [
  { min: 0, max: 29, emoji: '\uD83E\uDD94', className: 'poor', message: 'Mmh, questo ruolo \u00E8 abbastanza lontano dal tuo profilo attuale. Puoi generare il CV, ma sar\u00E0 difficile che passi i filtri ATS. Ti consiglio di candidarti solo se hai un contatto diretto in azienda.' },
  { min: 30, max: 49, emoji: '\uD83E\uDD14', className: 'partial', message: 'Ci sono dei gap importanti tra il tuo profilo e quello che cercano. Il CV compensar\u00E0 dove pu\u00F2, ma valuta se vale la pena candidarti \u2014 potresti concentrare le energie su annunci pi\u00F9 in linea.' },
  { min: 50, max: 69, emoji: '\uD83D\uDE0F', className: 'decent', message: 'Non male! Hai una base solida per questa posizione. Il CV verr\u00E0 fuori bene \u2014 i gap verranno colmati valorizzando le tue esperienze pi\u00F9 rilevanti.' },
  { min: 70, max: 84, emoji: '\uD83D\uDE0E', className: 'strong', message: 'Ottima compatibilit\u00E0! Il tuo profilo \u00E8 molto in linea con quello che cercano. Il CV sar\u00E0 convincente, ti consiglio di candidarti assolutamente.' },
  { min: 85, max: 100, emoji: '\uD83D\uDE80', className: 'perfect', message: 'Match quasi perfetto! Questo annuncio sembra scritto per te. Genera il CV e candidati subito \u2014 hai ottime possibilit\u00E0!' },
];

function getRaccoonAdvice(score) {
  return RACCOON_ADVICE.find((a) => score >= a.min && score <= a.max) || RACCOON_ADVICE[0];
}

// ── Fit Score Card with Raccoon ──

function FitScoreCard({ result }) {
  if (!result) return null;

  const score = Math.round(result.score || 0);
  const advice = getRaccoonAdvice(score);

  return (
    <div className={`fit-score-card fit-${advice.className}`}>
      <div className="fit-score-top">
        <div className="fit-raccoon">{advice.emoji}</div>
        <div className={`fit-score-circle fit-${advice.className}`}>
          <span className="fit-score-num">{score}</span>
          <span className="fit-score-label">/ 100</span>
        </div>
      </div>

      <div className="fit-raccoon-message">{advice.message}</div>

      <div className="fit-score-details">
        {result.strengths?.length > 0 && (
          <div className="fit-score-list strengths">
            <strong>Punti di forza:</strong>
            <ul>
              {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
        {result.gaps?.length > 0 && (
          <div className="fit-score-list gaps">
            <strong>Gap da colmare:</strong>
            <ul>
              {result.gaps.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>
        )}
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
  const [mode, setMode] = useState('jd');
  const [siteUrl, setSiteUrl] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [sparseData, setSparseData] = useState(null);

  const hasJd = jd.trim().length >= 80;
  const hasSpontaneousInput = siteUrl.trim().length > 0 && targetRole.trim().length > 0;

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
  }, [jd, lang, profile, style, onGenerated, onJobDescription]);

  const handleSpontaneousGenerate = useCallback(async (confirmSparse = false) => {
    if (!siteUrl.trim()) {
      setStatus({ text: t('generator.urlRequired'), type: 'error' });
      return;
    }
    if (!targetRole.trim()) {
      setStatus({ text: t('generator.roleRequired'), type: 'error' });
      return;
    }

    setGenerating(true);
    setStatus({ text: '', type: '' });
    setSparseData(null);

    try {
      setProgress({ visible: true, percent: 15, step: t('generator.scrapingProgress') });

      const result = await api.scrapeAndGenerate({
        url: siteUrl.trim(),
        role: targetRole.trim(),
        profile,
        language: lang,
        style,
        confirmSparse,
      });

      if (result.sparse) {
        setProgress({ visible: false, percent: 0, step: '' });
        setGenerating(false);
        setSparseData(result);
        return;
      }

      setProgress({ visible: true, percent: 80, step: 'Finalizzazione...' });
      await sleep(300);

      track('cv_generated_spontaneous', { language: lang, style });

      setProgress({ visible: true, percent: 100, step: 'CV pronto!' });
      await sleep(500);
      setProgress({ visible: false, percent: 0, step: '' });

      if (onGenerated) onGenerated(result, `[Candidatura spontanea] ${targetRole.trim()} \u2014 ${siteUrl.trim()}`, null, null);
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
  }, [siteUrl, targetRole, lang, profile, style, onGenerated]);

  return (
    <div className="generation-step">
      {/* Mode selector */}
      <div className="mode-selector">
        <button
          className={`mode-btn${mode === 'jd' ? ' active' : ''}`}
          onClick={() => setMode('jd')}
        >
          <Icon name="file-text" size={20} />
          <span>{t('generator.modeJd')}</span>
        </button>
        <button
          className={`mode-btn${mode === 'spontaneous' ? ' active' : ''}`}
          onClick={() => setMode('spontaneous')}
        >
          <Icon name="building" size={20} />
          <span>{t('generator.modeSpontaneous')}</span>
        </button>
      </div>

      {mode === 'jd' ? (
        <>
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
                if (fitScore) setFitScore(null);
              }}
            />
          </div>

          {/* Check compatibility button */}
          <button
            className="btn-secondary btn-check-fit"
            disabled={!hasJd || fitLoading}
            onClick={handleCheckFit}
          >
            {fitLoading ? 'Analisi in corso...' : 'Verifica compatibilit\u00E0'}
          </button>

          {/* Fit Score with raccoon */}
          {fitScore && <FitScoreCard result={fitScore} />}
        </>
      ) : (
        <>
          {/* Spontaneous: URL + Role inputs */}
          <div className="form-group">
            <label>{t('generator.urlLabel')}</label>
            <input
              type="url"
              className="jd-textarea"
              style={{ minHeight: 'auto', padding: '12px 16px' }}
              placeholder={t('generator.urlPlaceholder')}
              value={siteUrl}
              onChange={(e) => { setSiteUrl(e.target.value); setSparseData(null); }}
            />
          </div>
          <div className="form-group">
            <label>{t('generator.roleLabel')}</label>
            <input
              type="text"
              className="jd-textarea"
              style={{ minHeight: 'auto', padding: '12px 16px' }}
              placeholder={t('generator.rolePlaceholder')}
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </div>

          {/* Sparse data warning */}
          {sparseData && (
            <div className="sparse-warning card">
              <strong>{t('generator.sparseTitle')}</strong>
              <p>{t('generator.sparseMessage')}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => { setSparseData(null); handleSpontaneousGenerate(true); }}
                >
                  {t('generator.sparseConfirm')}
                </button>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => setSparseData(null)}
                >
                  {t('generator.sparseCancel')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

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
        disabled={generating || (mode === 'jd' ? !jd.trim() : !hasSpontaneousInput)}
        onClick={mode === 'jd' ? handleGenerate : () => handleSpontaneousGenerate(false)}
      >
        {generating ? 'Generazione in corso...' : t('generator.generate')}
      </button>
    </div>
  );
}
