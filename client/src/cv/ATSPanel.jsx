import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../api';
import { t } from '../strings';
import { track } from '../analytics';

// ── Italian stopwords for client-side fallback ──
const STOPWORDS = new Set([
  'il','lo','la','i','gli','le','un','uno','una','di','del','della','dei',
  'degli','delle','a','al','alla','ai','alle','da','dal','dalla','dai',
  'dalle','in','nel','nella','nei','nelle','con','su','sul','sulla','sui',
  'sulle','per','tra','fra','che','non','si','ci','ne','se','ma','ed','o',
  'e','come','anche','più','questo','questa','quello','quella','sono','essere',
  'ha','hanno','è','era','stato','the','and','or','of','to','in','for','on',
  'with','at','by','from','as','is','was','are','were','be','been','an','a',
  'it','its','has','had','do','does','not','but','if','so','all','can','will',
  'no','than','other','into','about','which','their','then','them','these',
  'some','her','his','she','he','we','you','they',
]);

function stem(word) {
  return word.replace(
    /(mente|zione|zioni|ità|ismo|ista|isti|izzare|izzazione|abile|ibili|ando|endo|ato|ata|ati|ate|uto|uta|uti|ute|ire|are|ere|ing|tion|sion|ness|ment|able|ible|ful|less|ous|ive|ity|ly|ed|er|es|en|al|ial|ual|ing|s)$/i,
    ''
  );
}

function computeATSScore(jdText, cvText) {
  const tokenize = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9àèéìòùç\s]/g, ' ')
      .split(/\s+/)
      .filter((tok) => tok.length >= 2 && !STOPWORDS.has(tok));

  const jdTokens = [...new Set(tokenize(jdText))];
  const cvLower = cvText.toLowerCase();
  const cvTokens = new Set(tokenize(cvText));

  const keywords = jdTokens.map((term) => {
    if (cvLower.includes(term)) return { term, match: 'exact' };
    if (cvTokens.has(term)) return { term, match: 'exact' };
    const termStem = stem(term);
    if (termStem.length >= 3) {
      for (const ct of cvTokens) {
        if (stem(ct) === termStem) return { term, match: 'semantic' };
      }
    }
    return { term, match: 'missing' };
  });

  const exact = keywords.filter((k) => k.match === 'exact').length;
  const semantic = keywords.filter((k) => k.match === 'semantic').length;
  const total = keywords.length || 1;
  const kwScore = Math.round(((exact + semantic * 0.6) / total) * 100);
  const structureScore = 70;
  const experienceScore = 65;
  const educationScore = 60;
  const softSkillsScore = 55;

  function buildScores(kw) {
    const tot = Math.round(kw * 0.4 + experienceScore * 0.25 + educationScore * 0.15 + structureScore * 0.1 + softSkillsScore * 0.1);
    return { keywords: kw, experience: experienceScore, education: educationScore, structure: structureScore, soft_skills: softSkillsScore, total: Math.min(tot, 100) };
  }

  return {
    keywords,
    classic: buildScores(kwScore),
    smart: buildScores(Math.min(kwScore + 8, 100)),
    tip: t('ats.fallbackTip'),
  };
}

// ── SVG Gauge ──
function Gauge({ score, label, id }) {
  const CIRCUMFERENCE = 2 * Math.PI * 19;
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  let strokeColor = '#00E676';
  if (score < 60) strokeColor = '#EF5350';
  else if (score < 80) strokeColor = '#FFB300';

  const circleRef = useRef(null);

  useEffect(() => {
    // Animate after paint
    const el = circleRef.current;
    if (!el) return;
    el.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.setAttribute('stroke-dashoffset', String(offset));
      });
    });
  }, [score, offset]);

  return (
    <div className="ats-gauge">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="60" height="60">
        <circle cx="22" cy="22" r="19" fill="none" stroke="#2A2A2A" strokeWidth="4" />
        <circle
          ref={circleRef}
          id={id}
          cx="22" cy="22" r="19"
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeDasharray={String(CIRCUMFERENCE)}
          strokeDashoffset={String(CIRCUMFERENCE)}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x="22" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#F5F5F5">
          {score}
        </text>
      </svg>
      <span className="ats-gauge-label">{label}</span>
    </div>
  );
}

// ── Grade Badge ──
function GradeBadge({ score }) {
  if (score >= 80) return <span className="ats-grade strong">STRONG</span>;
  if (score >= 60) return <span className="ats-grade moderate">MODERATE</span>;
  return <span className="ats-grade weak">WEAK</span>;
}

// ── Keyword Tags ──
function KeywordTags({ keywords, extractedKeywords, checkboxRefs }) {
  const targetedTerms = new Set(
    (extractedKeywords?.keywords || []).map((k) => k.term.toLowerCase())
  );

  return (
    <div className="ats-keywords">
      <h4>Keywords</h4>
      <div className="ats-keywords-list">
        {keywords.map((kw, i) => {
          const isTargeted = targetedTerms.has(kw.term.toLowerCase());
          return (
            <label
              key={i}
              className={`ats-kw-tag ${kw.match}${isTargeted ? ' kw-targeted' : ''}`}
            >
              {(kw.match === 'semantic' || kw.match === 'missing') && (
                <input
                  type="checkbox"
                  defaultChecked
                  ref={(el) => {
                    if (el && checkboxRefs) {
                      checkboxRefs.current.push({ el, term: kw.term, match: kw.match });
                    }
                  }}
                />
              )}
              <span>{kw.term}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Breakdown Table ──
function BreakdownTable({ scores }) {
  const dimensions = [
    { name: 'Keywords', weight: '40%', key: 'keywords' },
    { name: 'Experience', weight: '25%', key: 'experience' },
    { name: 'Education', weight: '15%', key: 'education' },
    { name: 'Structure', weight: '10%', key: 'structure' },
    { name: 'Soft Skills', weight: '10%', key: 'soft_skills' },
  ];

  return (
    <table className="ats-breakdown">
      <thead>
        <tr>
          {['Dimensione', 'Peso', 'Classic', 'Smart'].map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dimensions.map((dim) => (
          <tr key={dim.key}>
            <td>{dim.name}</td>
            <td>{dim.weight}</td>
            <td>{scores.classic[dim.key]}</td>
            <td>{scores.smart[dim.key]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Changelog ──
function Changelog({ changes }) {
  return (
    <div className="ats-changelog">
      <h4>Modifiche applicate</h4>
      {(!changes || changes.length === 0) ? (
        <p>Nessuna modifica applicata.</p>
      ) : (
        changes.map((change, i) => (
          <div key={i} className="ats-changelog-item">
            <div className="ats-changelog-field">{change.field || 'Campo'}</div>
            <div className="ats-changelog-before">
              <strong>Prima: </strong><span>{change.before || ''}</span>
            </div>
            <div className="ats-changelog-after">
              <strong>Dopo: </strong><span>{change.after || ''}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Results View ──
function ResultsView({ result, profile, jobDescription, extractedKeywords, onOptimized }) {
  const [optimizing, setOptimizing] = useState(false);
  const [changelog, setChangelog] = useState(null);
  const [currentResult, setCurrentResult] = useState(result);
  const checkboxRefs = useRef([]);

  // Reset refs on re-render
  checkboxRefs.current = [];

  const avgScore = Math.round((currentResult.classic.total + currentResult.smart.total) / 2);

  const handleOptimize = useCallback(async () => {
    setOptimizing(true);

    const missingKeywords = [];
    const semanticKeywords = [];
    const exactKeywords = currentResult.keywords
      .filter((k) => k.match === 'exact')
      .map((k) => k.term);

    checkboxRefs.current.forEach(({ el, term, match }) => {
      if (el.checked) {
        if (match === 'missing') missingKeywords.push(term);
        else if (match === 'semantic') semanticKeywords.push(term);
      }
    });

    try {
      const cvEl = document.getElementById('cv-container');
      const optimized = await api.optimize({
        generatedData: null, // will be synced from server/context
        profile,
        jobDescription,
        language: 'it',
        missingKeywords,
        semanticKeywords,
        exactKeywords,
      });

      const newData = optimized.updatedData || optimized.data || optimized;
      setChangelog(optimized.changes || []);

      // Re-score
      const cvText = cvEl ? cvEl.innerText : '';
      let reResult;
      try {
        reResult = await api.atsScore({ cvText, jobDescription });
      } catch {
        reResult = computeATSScore(jobDescription, cvText);
      }
      setCurrentResult(reResult);
      track('ats_optimized');

      if (onOptimized) onOptimized(newData);
    } catch (err) {
      setChangelog(null);
    } finally {
      setOptimizing(false);
    }
  }, [currentResult, profile, jobDescription, onOptimized]);

  return (
    <>
      {/* Gauges */}
      <div className="ats-gauges">
        <Gauge score={currentResult.classic.total} label="Classic" id="gauge-classic" />
        <Gauge score={currentResult.smart.total} label="Smart" id="gauge-smart" />
      </div>

      <GradeBadge score={avgScore} />
      <BreakdownTable scores={currentResult} />
      <KeywordTags
        keywords={currentResult.keywords}
        extractedKeywords={extractedKeywords}
        checkboxRefs={checkboxRefs}
      />

      {currentResult.tip && (
        <div className="ats-tip">
          <strong>Tip: </strong>
          <span>{currentResult.tip}</span>
        </div>
      )}

      {extractedKeywords && (
        <div className="ats-targeted-banner">
          {t('ats.targetBanner')}
        </div>
      )}

      <button
        className="btn-primary ats-optimize-btn"
        disabled={optimizing}
        onClick={handleOptimize}
      >
        {optimizing
          ? t('ats.optimizeLoading')
          : extractedKeywords
            ? t('ats.refineBtn')
            : t('ats.optimizeBtn')}
      </button>

      {changelog && <Changelog changes={changelog} />}
    </>
  );
}

// ── Main ATS Panel ──
export default function ATSPanel({ profile, jobDescription, onOptimized, onScored, extractedKeywords }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setResult(null);

    const cvEl = document.getElementById('cv-container');
    const cvText = cvEl ? cvEl.innerText : '';

    let atsResult;
    try {
      atsResult = await api.atsScore({ cvText, jobDescription });
    } catch {
      atsResult = computeATSScore(jobDescription, cvText);
    }

    track('ats_scored', { classic: atsResult.classic.total, smart: atsResult.smart.total });
    setResult(atsResult);
    setLoading(false);
    if (onScored) onScored(atsResult.classic.total, atsResult.smart.total);
  }, [jobDescription, onScored]);

  return (
    <div className="ats-panel">
      {!result && !loading && (
        <button className="btn-primary" onClick={runAnalysis}>
          {t('ats.runBtn')}
        </button>
      )}

      {loading && (
        <div className="ats-loading">
          <div className="upload-spinner" />
          <span>{t('ats.loading')}</span>
        </div>
      )}

      {result && (
        <div className="ats-results">
          <ResultsView
            result={result}
            profile={profile}
            jobDescription={jobDescription}
            extractedKeywords={extractedKeywords}
            onOptimized={onOptimized}
          />
        </div>
      )}
    </div>
  );
}
