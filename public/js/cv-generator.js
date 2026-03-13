import { api } from './api.js';
import { icon } from './icons.js';
import { track } from './analytics.js';

let generatedData = null;
let selectedStyle = 'professional';
let selectedLang = 'it';
let extractedKeywords = null;

export function getGeneratedData() { return generatedData; }
export function setGeneratedData(data) { generatedData = data; }
export function getSelectedStyle() { return selectedStyle; }
export function getSelectedLang() { return selectedLang; }
export function getExtractedKeywords() { return extractedKeywords; }
export function setExtractedKeywords(kw) { extractedKeywords = kw; }

/**
 * Renders the generation step: JD input, style picker, generate button.
 * @param {HTMLElement} container
 * @param {Object} profile - The CV profile data
 * @param {Function} onGenerated - Called when CV is generated successfully
 */
export function renderGenerationStep(container, profile, onGenerated) {
  container.textContent = '';

  const section = document.createElement('div');
  section.className = 'generation-step';

  // Title
  const title = document.createElement('h2');
  title.textContent = 'Genera il tuo CV';
  section.appendChild(title);

  // Job Description textarea
  const jdGroup = document.createElement('div');
  jdGroup.className = 'form-group';
  const jdLabel = document.createElement('label');
  jdLabel.textContent = 'Incolla l\'annuncio';
  jdGroup.appendChild(jdLabel);
  const jdInput = document.createElement('textarea');
  jdInput.className = 'jd-textarea';
  jdInput.placeholder = 'Incolla qui la job description. Piu\' e\' dettagliata, meglio lavora l\'AI.';
  jdInput.style.minHeight = '200px';
  jdGroup.appendChild(jdInput);
  section.appendChild(jdGroup);

  // Language selector
  const langGroup = document.createElement('div');
  langGroup.className = 'lang-selector';
  const langLabel = document.createElement('label');
  langLabel.textContent = 'Lingua CV:';
  langGroup.appendChild(langLabel);

  ['it', 'en'].forEach(lang => {
    const btn = document.createElement('button');
    btn.className = 'lang-btn' + (lang === selectedLang ? ' active' : '');
    btn.textContent = lang === 'it' ? 'Italiano' : 'English';
    btn.addEventListener('click', () => {
      selectedLang = lang;
      langGroup.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    langGroup.appendChild(btn);
  });
  section.appendChild(langGroup);

  // Style selector (3 theme previews)
  const styleGroup = document.createElement('div');
  styleGroup.className = 'style-selector';
  const styleLabel = document.createElement('label');
  styleLabel.textContent = 'Stile CV:';
  styleGroup.appendChild(styleLabel);

  const stylesRow = document.createElement('div');
  stylesRow.className = 'styles-row';

  const styles = [
    { id: 'professional', name: 'Professional', font: 'Georgia, serif', color: '#0d7377' },
    { id: 'modern', name: 'Modern', font: 'Inter, sans-serif', color: '#1e3a5f' },
    { id: 'minimal', name: 'Minimal', font: 'Lato, sans-serif', color: '#333333' },
  ];

  styles.forEach(style => {
    const preview = document.createElement('div');
    preview.className = 'style-preview' + (style.id === selectedStyle ? ' active' : '');

    // Mini mockup
    const mockHeader = document.createElement('div');
    mockHeader.className = 'style-mock-header';
    mockHeader.style.background = style.color;
    preview.appendChild(mockHeader);

    const mockBody = document.createElement('div');
    mockBody.className = 'style-mock-body';
    // Lines
    for (let i = 0; i < 4; i++) {
      const line = document.createElement('div');
      line.className = 'style-mock-line';
      if (i === 0) line.style.borderColor = style.color;
      mockBody.appendChild(line);
    }
    preview.appendChild(mockBody);

    const label = document.createElement('span');
    label.className = 'style-label';
    label.textContent = style.name;
    label.style.fontFamily = style.font;
    preview.appendChild(label);

    preview.addEventListener('click', () => {
      selectedStyle = style.id;
      stylesRow.querySelectorAll('.style-preview').forEach(p => p.classList.remove('active'));
      preview.classList.add('active');
    });

    stylesRow.appendChild(preview);
  });
  styleGroup.appendChild(stylesRow);
  section.appendChild(styleGroup);

  // Fit Score card (appears after JD is filled)
  const fitScoreCard = document.createElement('div');
  fitScoreCard.className = 'fit-score-card';
  fitScoreCard.style.display = 'none';
  section.appendChild(fitScoreCard);

  // Debounced fit score fetch — fires on JD blur or paste
  let fitScoreTimer = null;
  let lastJdChecked = '';
  function triggerFitScore() {
    const jd = jdInput.value.trim();
    if (!jd || jd.length < 80 || jd === lastJdChecked) return;
    lastJdChecked = jd;

    clearTimeout(fitScoreTimer);
    fitScoreTimer = setTimeout(async () => {
      fitScoreCard.style.display = 'block';
      fitScoreCard.className = 'fit-score-card loading';
      fitScoreCard.textContent = 'Analisi compatibilita\' in corso...';

      try {
        const result = await api.fitScore({ profile, jobDescription: jd, language: selectedLang });
        track('fit_score', { score: result.score });
        renderFitScore(fitScoreCard, result);
      } catch {
        fitScoreCard.style.display = 'none';
      }
    }, 800);
  }
  jdInput.addEventListener('blur', triggerFitScore);
  jdInput.addEventListener('paste', () => setTimeout(triggerFitScore, 100));

  // Progress bar
  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-container';
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  const progressFill = document.createElement('div');
  progressFill.className = 'progress-bar-fill';
  progressBar.appendChild(progressFill);
  progressContainer.appendChild(progressBar);
  const progressStep = document.createElement('div');
  progressStep.className = 'progress-step';
  progressContainer.appendChild(progressStep);
  section.appendChild(progressContainer);

  // Status
  const status = document.createElement('div');
  status.className = 'generation-status';
  section.appendChild(status);

  // Generate button
  const generateBtn = document.createElement('button');
  generateBtn.className = 'btn-primary btn-generate';
  generateBtn.textContent = 'Genera CV';
  generateBtn.addEventListener('click', async () => {
    const jd = jdInput.value.trim();
    if (!jd) {
      status.textContent = 'Serve l\'annuncio. Incolla la job description qui sopra.';
      status.className = 'generation-status error';
      return;
    }

    generateBtn.disabled = true;
    status.textContent = '';
    status.className = 'generation-status';

    function setProgress(pct, text) {
      progressContainer.style.display = 'block';
      progressFill.style.width = pct + '%';
      progressStep.textContent = text;
    }

    try {
      // === PHASE 1: Extract keywords (Haiku — fast & cheap) ===
      setProgress(10, 'Analizziamo l\'annuncio...');
      const kwResult = await api.extractKeywords({
        jobDescription: jd,
        language: selectedLang,
      });
      extractedKeywords = kwResult;
      track('keywords_extracted', { count: (kwResult.keywords || []).length });
      setProgress(20, 'Keyword individuate. Seleziona quelle da incorporare.');

      // === PHASE 2: Keyword review (user interaction) ===
      progressContainer.style.display = 'none';
      await showKeywordReview(section, kwResult, async (selectedKw) => {
        // === PHASE 3: Generate with target keywords ===
        setProgress(30, 'Costruiamo il tuo CV con le keyword target...');

        const result = await api.generate({
          profile,
          jobDescription: jd,
          language: selectedLang,
          style: selectedStyle,
          targetKeywords: selectedKw,
        });

        setProgress(80, 'Quasi fatto...');
        await sleep(300);

        generatedData = result;
        track('cv_generated', { language: selectedLang, style: selectedStyle, targeted: true });

        setProgress(100, 'CV pronto.');
        await sleep(500);

        progressContainer.style.display = 'none';
        status.textContent = 'CV pronto. Vediamo come se la cava con l\'ATS.';
        status.className = 'generation-status success';

        if (onGenerated) onGenerated(result, jd);
      }, async () => {
        // "Salta" fallback — generate without target keywords
        setProgress(30, 'Costruiamo il tuo CV...');
        extractedKeywords = null;

        const result = await api.generate({
          profile,
          jobDescription: jd,
          language: selectedLang,
          style: selectedStyle,
        });

        setProgress(80, 'Quasi fatto...');
        await sleep(300);

        generatedData = result;
        track('cv_generated', { language: selectedLang, style: selectedStyle, targeted: false });

        setProgress(100, 'CV pronto.');
        await sleep(500);

        progressContainer.style.display = 'none';
        status.textContent = 'CV pronto. Vediamo come se la cava con l\'ATS.';
        status.className = 'generation-status success';

        if (onGenerated) onGenerated(result, jd);
      });

    } catch (err) {
      progressContainer.style.display = 'none';
      if (err.message === 'Crediti insufficienti' || err.message === 'Limite giornaliero raggiunto') {
        const { showPricingModal } = await import('./pricing.js');
        status.textContent = err.message === 'Limite giornaliero raggiunto'
          ? 'Limite giornaliero raggiunto. Condividi il tuo link referral per ottenere crediti extra!'
          : 'Crediti esauriti. Ricarica per continuare.';
        status.className = 'generation-status error';
        showPricingModal();
      } else {
        status.textContent = 'Qualcosa non ha funzionato. ' + err.message;
        status.className = 'generation-status error';
      }
    } finally {
      generateBtn.disabled = false;
    }
  });
  section.appendChild(generateBtn);

  container.appendChild(section);
}

/**
 * Renders the CV preview from generated data.
 * Adapted from legacy/index.html buildCVHTML() (lines 1128-1210).
 * Uses safe DOM construction (createElement/textContent) instead of innerHTML.
 */
export function renderCVPreview(container, profile, data, style) {
  container.textContent = '';

  const cvWrapper = document.createElement('div');
  cvWrapper.id = 'cv-container';
  cvWrapper.setAttribute('data-theme', style || selectedStyle);

  // === HEADER ===
  const header = document.createElement('div');
  header.className = 'cv-header';

  if (profile.photo_path) {
    const photo = document.createElement('img');
    photo.className = 'cv-photo';
    photo.src = profile.photo_path;
    photo.alt = profile.personal.name;
    header.appendChild(photo);
  }

  const headerText = document.createElement('div');
  headerText.className = 'cv-header-text';

  const name = document.createElement('div');
  name.className = 'cv-name';
  name.textContent = profile.personal.name;
  headerText.appendChild(name);

  const headline = document.createElement('div');
  headline.className = 'cv-headline';
  headline.setAttribute('data-field', 'headline');
  headline.textContent = data.headline;
  headerText.appendChild(headline);

  const contacts = document.createElement('div');
  contacts.className = 'cv-contacts';
  if (profile.personal.email) {
    const emailSpan = document.createElement('span');
    emailSpan.appendChild(icon('mail', { size: 14 }));
    emailSpan.appendChild(document.createTextNode(' ' + profile.personal.email));
    contacts.appendChild(emailSpan);
  }
  if (profile.personal.phone) {
    const phoneSpan = document.createElement('span');
    phoneSpan.appendChild(icon('phone', { size: 14 }));
    phoneSpan.appendChild(document.createTextNode(' ' + profile.personal.phone));
    contacts.appendChild(phoneSpan);
  }
  if (profile.personal.location) {
    const locSpan = document.createElement('span');
    locSpan.appendChild(icon('map-pin', { size: 14 }));
    locSpan.appendChild(document.createTextNode(' ' + profile.personal.location));
    contacts.appendChild(locSpan);
  }
  headerText.appendChild(contacts);
  header.appendChild(headerText);
  cvWrapper.appendChild(header);

  // === BODY ===
  const body = document.createElement('div');
  body.className = 'cv-body';

  const isIt = (selectedLang === 'it');
  const labels = isIt
    ? { summary: 'Profilo Professionale', competencies: 'Competenze Chiave', experience: 'Esperienza Professionale', education: 'Formazione', additional: 'Lingue e Strumenti' }
    : { summary: 'Professional Summary', competencies: 'Core Competencies', experience: 'Professional Experience', education: 'Education', additional: 'Languages & Tools' };

  // Summary section
  const summarySection = document.createElement('div');
  summarySection.className = 'cv-section';
  const summaryTitle = document.createElement('div');
  summaryTitle.className = 'cv-section-title';
  summaryTitle.textContent = labels.summary;
  summarySection.appendChild(summaryTitle);
  const summaryText = document.createElement('div');
  summaryText.className = 'cv-summary';
  summaryText.setAttribute('data-field', 'summary');
  summaryText.textContent = data.summary;
  summarySection.appendChild(summaryText);
  body.appendChild(summarySection);

  // Competencies section
  if (data.competencies && data.competencies.length > 0) {
    const compSection = document.createElement('div');
    compSection.className = 'cv-section';
    const compTitle = document.createElement('div');
    compTitle.className = 'cv-section-title';
    compTitle.textContent = labels.competencies;
    compSection.appendChild(compTitle);
    const compContainer = document.createElement('div');
    compContainer.className = 'cv-competencies';
    data.competencies.forEach((comp, i) => {
      const badge = document.createElement('span');
      badge.className = 'cv-badge';
      badge.setAttribute('data-field', `comp-${i}`);
      badge.textContent = comp;
      compContainer.appendChild(badge);
    });
    compSection.appendChild(compContainer);
    body.appendChild(compSection);
  }

  // Experience section
  const expSection = document.createElement('div');
  expSection.className = 'cv-section';
  const expTitle = document.createElement('div');
  expTitle.className = 'cv-section-title';
  expTitle.textContent = labels.experience;
  expSection.appendChild(expTitle);

  profile.experiences.forEach((exp, i) => {
    // Skip if omitted by AI
    if (data.omittedExperiences && data.omittedExperiences.some(o => o.index === i)) return;

    const expItem = document.createElement('div');
    expItem.className = 'cv-exp-item';

    const expHeader = document.createElement('div');
    expHeader.className = 'cv-exp-header';
    const role = document.createElement('span');
    role.className = 'cv-exp-role';
    role.textContent = exp.role;
    expHeader.appendChild(role);
    const period = document.createElement('span');
    period.className = 'cv-exp-period';
    period.textContent = exp.period;
    expHeader.appendChild(period);

    expItem.appendChild(expHeader);

    const company = document.createElement('div');
    company.className = 'cv-exp-company';
    company.textContent = exp.company;
    expItem.appendChild(company);

    const bullets = document.createElement('ul');
    bullets.className = 'cv-exp-bullets';
    const adaptedBullets = data.experience[i] ? data.experience[i].bullets : exp.bullets;
    (adaptedBullets || []).forEach((b, bi) => {
      const li = document.createElement('li');
      li.setAttribute('data-field', `exp-${i}-${bi}`);
      li.textContent = b;
      bullets.appendChild(li);
    });
    expItem.appendChild(bullets);

    expSection.appendChild(expItem);
  });
  body.appendChild(expSection);

  // Education section
  const eduSection = document.createElement('div');
  eduSection.className = 'cv-section';
  const eduTitle = document.createElement('div');
  eduTitle.className = 'cv-section-title';
  eduTitle.textContent = labels.education;
  eduSection.appendChild(eduTitle);

  profile.education.forEach(edu => {
    const eduItem = document.createElement('div');
    eduItem.className = 'cv-edu-item';
    const degree = document.createElement('div');
    degree.className = 'cv-edu-degree';
    degree.textContent = edu.degree;
    eduItem.appendChild(degree);
    const school = document.createElement('div');
    school.className = 'cv-edu-school';
    school.textContent = (edu.school || '') + (edu.period ? ' | ' + edu.period : '');
    eduItem.appendChild(school);
    if (edu.grade) {
      const grade = document.createElement('div');
      grade.className = 'cv-edu-detail';
      grade.textContent = edu.grade;
      eduItem.appendChild(grade);
    }
    eduSection.appendChild(eduItem);
  });
  body.appendChild(eduSection);

  // Languages & Tools section
  const addSection = document.createElement('div');
  addSection.className = 'cv-section';
  const addTitle = document.createElement('div');
  addTitle.className = 'cv-section-title';
  addTitle.textContent = labels.additional;
  addSection.appendChild(addTitle);

  const addList = document.createElement('div');
  addList.className = 'cv-inline-list';

  // Languages
  if (profile.languages && profile.languages.length > 0) {
    const langText = profile.languages
      .map(l => l.language + ' (' + l.level + ')')
      .join(' \u00B7 ');
    const langSpan = document.createElement('span');
    langSpan.textContent = langText;
    addList.appendChild(langSpan);
  }

  // Skills
  if (data.skills) {
    const skillsSpan = document.createElement('span');
    skillsSpan.setAttribute('data-field', 'skills');
    skillsSpan.textContent = ' | ' + data.skills;
    addList.appendChild(skillsSpan);
  }

  addSection.appendChild(addList);
  body.appendChild(addSection);

  cvWrapper.appendChild(body);
  container.appendChild(cvWrapper);
}

/**
 * Shows an interactive keyword review panel.
 * User can check/uncheck keywords before generation.
 * @param {HTMLElement} container - parent to append panel to
 * @param {Object} kwResult - { keywords, roleTitle, domain }
 * @param {Function} onConfirm - called with selected keywords array
 * @param {Function} onSkip - called when user skips keyword targeting
 */
function showKeywordReview(container, kwResult, onConfirm, onSkip) {
  return new Promise((resolve) => {
    // Remove any existing review panel
    const existing = container.querySelector('.keyword-review-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.className = 'keyword-review-panel card';

    // Header
    const header = document.createElement('div');
    header.className = 'kw-review-header';
    const title = document.createElement('h3');
    title.textContent = 'Keyword dall\'annuncio';
    header.appendChild(title);
    if (kwResult.roleTitle) {
      const subtitle = document.createElement('span');
      subtitle.className = 'kw-review-subtitle';
      subtitle.textContent = kwResult.roleTitle + (kwResult.domain ? ' — ' + kwResult.domain : '');
      header.appendChild(subtitle);
    }
    panel.appendChild(header);

    const desc = document.createElement('p');
    desc.className = 'kw-review-desc';
    desc.textContent = 'Queste sono le keyword che l\'ATS cerchera\' nel tuo CV. Deseleziona quelle che non ti rappresentano.';
    panel.appendChild(desc);

    // Group keywords by priority
    const groups = { high: [], medium: [], low: [] };
    (kwResult.keywords || []).forEach(kw => {
      if (groups[kw.priority]) groups[kw.priority].push(kw);
      else groups.medium.push(kw);
    });

    const groupLabels = {
      high: { label: 'Must-have', cssClass: 'kw-priority-high' },
      medium: { label: 'Nice-to-have', cssClass: 'kw-priority-medium' },
      low: { label: 'Opzionali', cssClass: 'kw-priority-low' },
    };

    Object.entries(groups).forEach(([priority, keywords]) => {
      if (keywords.length === 0) return;

      const group = document.createElement('div');
      group.className = 'kw-priority-group';

      const groupLabel = document.createElement('div');
      groupLabel.className = 'kw-group-label ' + groupLabels[priority].cssClass;
      groupLabel.textContent = groupLabels[priority].label + ' (' + keywords.length + ')';
      group.appendChild(groupLabel);

      const tagsWrap = document.createElement('div');
      tagsWrap.className = 'kw-tags-wrap';

      keywords.forEach(kw => {
        const tag = document.createElement('label');
        tag.className = 'kw-review-tag ' + groupLabels[priority].cssClass;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = priority !== 'low'; // high and medium checked by default
        cb.dataset.term = kw.term;
        cb.dataset.priority = kw.priority;
        cb.dataset.category = kw.category;
        tag.appendChild(cb);

        const span = document.createElement('span');
        span.textContent = kw.term;
        tag.appendChild(span);

        const catBadge = document.createElement('small');
        catBadge.className = 'kw-cat-badge';
        catBadge.textContent = kw.category;
        tag.appendChild(catBadge);

        tagsWrap.appendChild(tag);
      });

      group.appendChild(tagsWrap);
      panel.appendChild(group);
    });

    // Actions
    const actions = document.createElement('div');
    actions.className = 'kw-review-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-primary';
    confirmBtn.textContent = 'Conferma e genera';
    confirmBtn.addEventListener('click', () => {
      const selected = [];
      panel.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        selected.push({
          term: cb.dataset.term,
          priority: cb.dataset.priority,
          category: cb.dataset.category,
        });
      });
      panel.remove();
      onConfirm(selected).then(resolve);
    });
    actions.appendChild(confirmBtn);

    const skipLink = document.createElement('button');
    skipLink.className = 'btn-secondary';
    skipLink.textContent = 'Salta (genera senza target)';
    skipLink.addEventListener('click', () => {
      panel.remove();
      onSkip().then(resolve);
    });
    actions.appendChild(skipLink);

    panel.appendChild(actions);
    container.appendChild(panel);
  });
}

function renderFitScore(card, result) {
  card.textContent = '';
  card.className = 'fit-score-card';

  const scoreCircle = document.createElement('div');
  scoreCircle.className = 'fit-score-circle';
  const score = Math.round(result.score || 0);

  // Color based on score
  let scoreClass = 'poor';
  if (score >= 80) scoreClass = 'strong';
  else if (score >= 60) scoreClass = 'decent';
  else if (score >= 40) scoreClass = 'partial';
  scoreCircle.classList.add('fit-' + scoreClass);

  const scoreNum = document.createElement('span');
  scoreNum.className = 'fit-score-num';
  scoreNum.textContent = score;
  scoreCircle.appendChild(scoreNum);

  const scoreLabel = document.createElement('span');
  scoreLabel.className = 'fit-score-label';
  scoreLabel.textContent = '/100';
  scoreCircle.appendChild(scoreLabel);
  card.appendChild(scoreCircle);

  const info = document.createElement('div');
  info.className = 'fit-score-info';

  const summary = document.createElement('p');
  summary.className = 'fit-score-summary';
  summary.textContent = result.summary || '';
  info.appendChild(summary);

  if (result.strengths && result.strengths.length > 0) {
    const strengths = document.createElement('div');
    strengths.className = 'fit-score-list strengths';
    const sLabel = document.createElement('strong');
    sLabel.textContent = 'Punti di forza: ';
    strengths.appendChild(sLabel);
    strengths.appendChild(document.createTextNode(result.strengths.join(' \u00B7 ')));
    info.appendChild(strengths);
  }

  if (result.gaps && result.gaps.length > 0) {
    const gaps = document.createElement('div');
    gaps.className = 'fit-score-list gaps';
    const gLabel = document.createElement('strong');
    gLabel.textContent = 'Gap: ';
    gaps.appendChild(gLabel);
    gaps.appendChild(document.createTextNode(result.gaps.join(' \u00B7 ')));
    info.appendChild(gaps);
  }

  card.appendChild(info);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * One-Tap generation: paste JD → generate CV in one click, no keyword review.
 * For users who already have a complete profile.
 * @param {HTMLElement} container
 * @param {Object} profile - The CV profile data (must have experiences)
 * @param {Function} onGenerated - Called with (result, jd) on success
 */
export function renderOneTap(container, profile, onGenerated) {
  const section = document.createElement('div');
  section.className = 'one-tap-section';

  // Title
  const title = document.createElement('h3');
  title.textContent = 'Genera CV per un nuovo annuncio';
  section.appendChild(title);

  // Hint
  const hint = document.createElement('p');
  hint.className = 'one-tap-hint';
  hint.textContent = 'Incolla un annuncio e genera il CV in un click. Usa il tuo profilo attuale.';
  section.appendChild(hint);

  // JD textarea
  const jdInput = document.createElement('textarea');
  jdInput.className = 'jd-textarea';
  jdInput.placeholder = 'Incolla qui la job description...';
  jdInput.style.minHeight = '120px';
  section.appendChild(jdInput);

  // Language selector
  let otLang = 'it';
  const langRow = document.createElement('div');
  langRow.className = 'one-tap-options';

  ['it', 'en'].forEach(lang => {
    const btn = document.createElement('button');
    btn.className = 'lang-btn' + (lang === otLang ? ' active' : '');
    btn.textContent = lang === 'it' ? 'IT' : 'EN';
    btn.addEventListener('click', () => {
      otLang = lang;
      langRow.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    langRow.appendChild(btn);
  });
  section.appendChild(langRow);

  // Progress bar
  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-container';
  progressContainer.style.display = 'none';
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  const progressFill = document.createElement('div');
  progressFill.className = 'progress-bar-fill';
  progressBar.appendChild(progressFill);
  progressContainer.appendChild(progressBar);
  const progressStep = document.createElement('div');
  progressStep.className = 'progress-step';
  progressContainer.appendChild(progressStep);
  section.appendChild(progressContainer);

  // Status
  const status = document.createElement('div');
  status.className = 'generation-status';
  section.appendChild(status);

  // Generate button
  const generateBtn = document.createElement('button');
  generateBtn.className = 'btn-primary btn-generate';
  generateBtn.textContent = 'Genera CV';
  generateBtn.addEventListener('click', async () => {
    const jd = jdInput.value.trim();
    if (!jd) {
      status.textContent = 'Incolla un annuncio prima di generare.';
      status.className = 'generation-status error';
      return;
    }

    generateBtn.disabled = true;
    status.textContent = '';
    status.className = 'generation-status';

    function setProgress(pct, text) {
      progressContainer.style.display = 'block';
      progressFill.style.width = pct + '%';
      progressStep.textContent = text;
    }

    try {
      // Phase 1: extract keywords
      setProgress(10, 'Analizziamo l\'annuncio...');
      const kwResult = await api.extractKeywords({
        jobDescription: jd,
        language: otLang,
      });
      extractedKeywords = kwResult;

      // Auto-select ALL keywords (no review step)
      const allKeywords = (kwResult.keywords || []).map(kw => ({
        term: kw.term,
        priority: kw.priority,
        category: kw.category,
      }));

      // Phase 2: generate with all keywords
      setProgress(30, 'Costruiamo il tuo CV...');
      const result = await api.generate({
        profile,
        jobDescription: jd,
        language: otLang,
        style: selectedStyle,
        targetKeywords: allKeywords,
      });

      setProgress(80, 'Quasi fatto...');
      await sleep(300);

      generatedData = result;
      track('cv_generated', { language: otLang, style: selectedStyle, oneTap: true });

      setProgress(100, 'CV pronto.');
      await sleep(500);

      progressContainer.style.display = 'none';
      status.textContent = '';

      if (onGenerated) onGenerated(result, jd);
    } catch (err) {
      progressContainer.style.display = 'none';
      if (err.message === 'Crediti insufficienti' || err.message === 'Limite giornaliero raggiunto') {
        const { showPricingModal } = await import('./pricing.js');
        status.textContent = err.message === 'Limite giornaliero raggiunto'
          ? 'Limite giornaliero raggiunto. Condividi il tuo link referral per ottenere crediti extra!'
          : 'Crediti esauriti. Ricarica per continuare.';
        status.className = 'generation-status error';
        showPricingModal();
      } else {
        status.textContent = 'Qualcosa non ha funzionato. ' + err.message;
        status.className = 'generation-status error';
      }
    } finally {
      generateBtn.disabled = false;
    }
  });
  section.appendChild(generateBtn);

  container.appendChild(section);
}
