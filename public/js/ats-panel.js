import { api } from './api.js';
import {
  getGeneratedData,
  setGeneratedData,
  getSelectedLang,
  getSelectedStyle,
  renderCVPreview,
} from './cv-generator.js';

// ─── Italian stopwords for client-side fallback ───
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

// ─── Simple stemmer (strips common Italian/English suffixes) ───
function stem(word) {
  return word
    .replace(/(mente|zione|zioni|ità|ismo|ista|isti|izzare|izzazione|abile|ibili|ando|endo|ato|ata|ati|ate|uto|uta|uti|ute|ire|are|ere|ing|tion|sion|ness|ment|able|ible|ful|less|ous|ive|ity|ly|ed|er|es|en|al|ial|ual|ing|s)$/i, '');
}

// ─── Client-side fallback scorer ───
function computeATSScore(jdText, cvText) {
  const tokenize = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9àèéìòùç\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !STOPWORDS.has(t));

  const jdTokens = [...new Set(tokenize(jdText))];
  const cvLower = cvText.toLowerCase();
  const cvTokens = new Set(tokenize(cvText));

  const keywords = jdTokens.map((term) => {
    // exact substring
    if (cvLower.includes(term)) {
      return { term, match: 'exact' };
    }
    // token match
    if (cvTokens.has(term)) {
      return { term, match: 'exact' };
    }
    // stem match
    const termStem = stem(term);
    if (termStem.length >= 3) {
      for (const ct of cvTokens) {
        if (stem(ct) === termStem) {
          return { term, match: 'semantic' };
        }
      }
    }
    return { term, match: 'missing' };
  });

  const exact = keywords.filter((k) => k.match === 'exact').length;
  const semantic = keywords.filter((k) => k.match === 'semantic').length;
  const total = keywords.length || 1;

  const kwScore = Math.round(((exact + semantic * 0.6) / total) * 100);
  const structureScore = 70; // static fallback
  const experienceScore = 65;
  const educationScore = 60;
  const softSkillsScore = 55;

  function buildScores(kw) {
    const t = Math.round(
      kw * 0.4 +
      experienceScore * 0.25 +
      educationScore * 0.15 +
      structureScore * 0.1 +
      softSkillsScore * 0.1
    );
    return {
      keywords: kw,
      experience: experienceScore,
      education: educationScore,
      structure: structureScore,
      soft_skills: softSkillsScore,
      total: Math.min(t, 100),
    };
  }

  return {
    keywords,
    classic: buildScores(kwScore),
    smart: buildScores(Math.min(kwScore + 8, 100)),
    tip: 'Analisi locale di fallback: aggiungi le keyword mancanti per migliorare il punteggio.',
  };
}

// ─── SVG Gauge builder ───
function createGauge(score, label, id) {
  const CIRCUMFERENCE = 2 * Math.PI * 19; // r=19 → ~119.38
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  let strokeColor = '#38a169'; // green
  if (score < 60) strokeColor = '#e53e3e';
  else if (score < 80) strokeColor = '#d69e2e';

  const wrapper = document.createElement('div');
  wrapper.className = 'ats-gauge';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 44 44');
  svg.setAttribute('width', '60');
  svg.setAttribute('height', '60');

  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', '22');
  bgCircle.setAttribute('cy', '22');
  bgCircle.setAttribute('r', '19');
  bgCircle.setAttribute('fill', 'none');
  bgCircle.setAttribute('stroke', '#eee');
  bgCircle.setAttribute('stroke-width', '4');
  svg.appendChild(bgCircle);

  const fgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fgCircle.id = id;
  fgCircle.setAttribute('cx', '22');
  fgCircle.setAttribute('cy', '22');
  fgCircle.setAttribute('r', '19');
  fgCircle.setAttribute('fill', 'none');
  fgCircle.setAttribute('stroke', strokeColor);
  fgCircle.setAttribute('stroke-width', '4');
  fgCircle.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));
  fgCircle.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE)); // start full
  fgCircle.setAttribute('stroke-linecap', 'round');
  fgCircle.setAttribute('transform', 'rotate(-90 22 22)');
  fgCircle.style.transition = 'stroke-dashoffset 0.8s ease';
  svg.appendChild(fgCircle);

  // Center text
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '22');
  text.setAttribute('y', '24');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-size', '11');
  text.setAttribute('font-weight', '700');
  text.setAttribute('fill', '#2d3748');
  text.textContent = String(score);
  svg.appendChild(text);

  wrapper.appendChild(svg);

  const labelEl = document.createElement('span');
  labelEl.className = 'ats-gauge-label';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  // Animate after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fgCircle.setAttribute('stroke-dashoffset', String(offset));
    });
  });

  return wrapper;
}

// ─── Grade badge ───
function createGradeBadge(score) {
  const badge = document.createElement('span');
  if (score >= 80) {
    badge.className = 'ats-grade strong';
    badge.textContent = 'STRONG';
  } else if (score >= 60) {
    badge.className = 'ats-grade moderate';
    badge.textContent = 'MODERATE';
  } else {
    badge.className = 'ats-grade weak';
    badge.textContent = 'WEAK';
  }
  return badge;
}

// ─── Keyword tags ───
function buildKeywordTags(keywords) {
  const container = document.createElement('div');
  container.className = 'ats-keywords';

  const title = document.createElement('h4');
  title.textContent = 'Keywords';
  container.appendChild(title);

  const tagsWrap = document.createElement('div');
  tagsWrap.className = 'ats-keywords-list';

  keywords.forEach((kw) => {
    const tag = document.createElement('label');
    tag.className = 'ats-kw-tag ' + kw.match;

    if (kw.match === 'semantic' || kw.match === 'missing') {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.dataset.term = kw.term;
      cb.dataset.match = kw.match;
      tag.appendChild(cb);
    }

    const span = document.createElement('span');
    span.textContent = kw.term;
    tag.appendChild(span);

    tagsWrap.appendChild(tag);
  });

  container.appendChild(tagsWrap);
  return container;
}

// ─── Dimension breakdown table ───
function buildBreakdownTable(scores) {
  const dimensions = [
    { name: 'Keywords', weight: '40%', key: 'keywords' },
    { name: 'Experience', weight: '25%', key: 'experience' },
    { name: 'Education', weight: '15%', key: 'education' },
    { name: 'Structure', weight: '10%', key: 'structure' },
    { name: 'Soft Skills', weight: '10%', key: 'soft_skills' },
  ];

  const table = document.createElement('table');
  table.className = 'ats-breakdown';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Dimensione', 'Peso', 'Classic', 'Smart'].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  dimensions.forEach((dim) => {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.textContent = dim.name;
    tr.appendChild(tdName);

    const tdWeight = document.createElement('td');
    tdWeight.textContent = dim.weight;
    tr.appendChild(tdWeight);

    const tdClassic = document.createElement('td');
    tdClassic.textContent = scores.classic[dim.key];
    tr.appendChild(tdClassic);

    const tdSmart = document.createElement('td');
    tdSmart.textContent = scores.smart[dim.key];
    tr.appendChild(tdSmart);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}

// ─── Changelog panel ───
function buildChangelog(changes) {
  const panel = document.createElement('div');
  panel.className = 'ats-changelog';

  const title = document.createElement('h4');
  title.textContent = 'Modifiche applicate';
  panel.appendChild(title);

  if (!changes || changes.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'Nessuna modifica applicata.';
    panel.appendChild(empty);
    return panel;
  }

  changes.forEach((change) => {
    const item = document.createElement('div');
    item.className = 'ats-changelog-item';

    const fieldLabel = document.createElement('div');
    fieldLabel.className = 'ats-changelog-field';
    fieldLabel.textContent = change.field || 'Campo';
    item.appendChild(fieldLabel);

    const beforeDiv = document.createElement('div');
    beforeDiv.className = 'ats-changelog-before';
    const beforeLabel = document.createElement('strong');
    beforeLabel.textContent = 'Prima: ';
    beforeDiv.appendChild(beforeLabel);
    const beforeText = document.createElement('span');
    beforeText.textContent = change.before || '';
    beforeDiv.appendChild(beforeText);
    item.appendChild(beforeDiv);

    const afterDiv = document.createElement('div');
    afterDiv.className = 'ats-changelog-after';
    const afterLabel = document.createElement('strong');
    afterLabel.textContent = 'Dopo: ';
    afterDiv.appendChild(afterLabel);
    const afterText = document.createElement('span');
    afterText.textContent = change.after || '';
    afterDiv.appendChild(afterText);
    item.appendChild(afterDiv);

    panel.appendChild(item);
  });

  return panel;
}

// ─── Tip display ───
function buildTip(tipText) {
  const tip = document.createElement('div');
  tip.className = 'ats-tip';
  const icon = document.createElement('strong');
  icon.textContent = 'Tip: ';
  tip.appendChild(icon);
  const span = document.createElement('span');
  span.textContent = tipText;
  tip.appendChild(span);
  return tip;
}

// ─── Main export ───
export function renderATSPanel(container, profile, jobDescription, onOptimized) {
  container.textContent = '';

  const panel = document.createElement('div');
  panel.className = 'ats-panel';

  // Initial button
  const analyzeBtn = document.createElement('button');
  analyzeBtn.className = 'btn-primary';
  analyzeBtn.textContent = 'Analisi ATS';
  panel.appendChild(analyzeBtn);

  const resultsArea = document.createElement('div');
  resultsArea.className = 'ats-results';
  panel.appendChild(resultsArea);

  analyzeBtn.addEventListener('click', () => runAnalysis(resultsArea, profile, jobDescription, onOptimized));

  container.appendChild(panel);
}

async function runAnalysis(resultsArea, profile, jobDescription, onOptimized) {
  resultsArea.textContent = '';

  // Loading indicator
  const loading = document.createElement('div');
  loading.className = 'ats-loading';
  const spinner = document.createElement('div');
  spinner.className = 'upload-spinner';
  loading.appendChild(spinner);
  const loadingText = document.createElement('span');
  loadingText.textContent = 'Analisi in corso...';
  loading.appendChild(loadingText);
  resultsArea.appendChild(loading);

  const cvEl = document.getElementById('cv-container');
  const cvText = cvEl ? cvEl.innerText : '';

  let result;
  try {
    result = await api.atsScore({ cvText, jobDescription });
  } catch (err) {
    // Client-side fallback
    result = computeATSScore(jobDescription, cvText);
  }

  resultsArea.textContent = '';
  renderResults(resultsArea, result, profile, jobDescription, onOptimized);
}

function renderResults(container, result, profile, jobDescription, onOptimized) {
  // Gauges row
  const gaugesRow = document.createElement('div');
  gaugesRow.className = 'ats-gauges';
  gaugesRow.appendChild(createGauge(result.classic.total, 'Classic', 'gauge-classic'));
  gaugesRow.appendChild(createGauge(result.smart.total, 'Smart', 'gauge-smart'));
  container.appendChild(gaugesRow);

  // Grade badge (based on smart score)
  const avgScore = Math.round((result.classic.total + result.smart.total) / 2);
  container.appendChild(createGradeBadge(avgScore));

  // Breakdown table
  container.appendChild(buildBreakdownTable(result));

  // Keyword tags
  const kwContainer = buildKeywordTags(result.keywords);
  container.appendChild(kwContainer);

  // Tip
  if (result.tip) {
    container.appendChild(buildTip(result.tip));
  }

  // Optimize button
  const optimizeBtn = document.createElement('button');
  optimizeBtn.className = 'btn-primary ats-optimize-btn';
  optimizeBtn.textContent = 'Ottimizza ATS';
  container.appendChild(optimizeBtn);

  // Changelog area
  const changelogArea = document.createElement('div');
  container.appendChild(changelogArea);

  optimizeBtn.addEventListener('click', () =>
    runOptimize(optimizeBtn, kwContainer, changelogArea, container, result, profile, jobDescription, onOptimized)
  );
}

async function runOptimize(btn, kwContainer, changelogArea, resultsArea, atsResult, profile, jobDescription, onOptimized) {
  btn.disabled = true;
  btn.textContent = 'Ottimizzazione...';

  // Gather checked keywords
  const checkboxes = kwContainer.querySelectorAll('input[type="checkbox"]');
  const missingKeywords = [];
  const semanticKeywords = [];
  const exactKeywords = atsResult.keywords
    .filter((k) => k.match === 'exact')
    .map((k) => k.term);

  checkboxes.forEach((cb) => {
    if (cb.checked) {
      if (cb.dataset.match === 'missing') {
        missingKeywords.push(cb.dataset.term);
      } else if (cb.dataset.match === 'semantic') {
        semanticKeywords.push(cb.dataset.term);
      }
    }
  });

  const generatedData = getGeneratedData();
  const language = getSelectedLang();

  try {
    const optimized = await api.optimize({
      generatedData,
      profile,
      jobDescription,
      language,
      missingKeywords,
      semanticKeywords,
      exactKeywords,
    });

    // Update generated data — server returns { updatedData, changes, skipped }
    const newData = optimized.updatedData || optimized.data || optimized;
    setGeneratedData(newData);

    // Re-render CV preview
    const previewContainer = document.getElementById('cv-container');
    if (previewContainer && previewContainer.parentElement) {
      renderCVPreview(previewContainer.parentElement, profile, newData, getSelectedStyle());
    }

    // Show changelog
    changelogArea.textContent = '';
    changelogArea.appendChild(buildChangelog(optimized.changes || []));

    // Re-score
    btn.textContent = 'Ri-analisi...';
    await reScore(resultsArea, profile, jobDescription, onOptimized);

    if (onOptimized) onOptimized(newData);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Ottimizza ATS';
    const errMsg = document.createElement('div');
    errMsg.className = 'feedback-error';
    errMsg.textContent = 'Errore ottimizzazione: ' + err.message;
    changelogArea.textContent = '';
    changelogArea.appendChild(errMsg);
  }
}

async function reScore(resultsArea, profile, jobDescription, onOptimized) {
  const cvEl = document.getElementById('cv-container');
  const cvText = cvEl ? cvEl.innerText : '';

  let result;
  try {
    result = await api.atsScore({ cvText, jobDescription });
  } catch (err) {
    result = computeATSScore(jobDescription, cvText);
  }

  resultsArea.textContent = '';
  renderResults(resultsArea, result, profile, jobDescription, onOptimized);
}
