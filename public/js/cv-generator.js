import { api } from './api.js';

let generatedData = null;
let selectedStyle = 'professional';
let selectedLang = 'it';

export function getGeneratedData() { return generatedData; }
export function setGeneratedData(data) { generatedData = data; }
export function getSelectedStyle() { return selectedStyle; }
export function getSelectedLang() { return selectedLang; }

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
  jdLabel.textContent = 'Job Description (incolla qui l\'annuncio)';
  jdGroup.appendChild(jdLabel);
  const jdInput = document.createElement('textarea');
  jdInput.className = 'jd-textarea';
  jdInput.placeholder = 'Incolla qui la job description del ruolo per cui ti candidi...';
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
      status.textContent = 'Inserisci una job description.';
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
      setProgress(10, 'Analisi della job description...');
      await sleep(400);
      setProgress(30, 'Invio richiesta a Claude Opus...');

      const result = await api.generate({
        profile,
        jobDescription: jd,
        language: selectedLang,
        style: selectedStyle,
      });

      setProgress(80, 'Rendering del CV...');
      await sleep(300);

      generatedData = result;

      setProgress(100, 'CV generato con successo!');
      await sleep(500);

      progressContainer.style.display = 'none';
      status.textContent = 'CV generato con successo!';
      status.className = 'generation-status success';

      if (onGenerated) onGenerated(result, jd);

    } catch (err) {
      progressContainer.style.display = 'none';
      status.textContent = 'Errore: ' + err.message;
      status.className = 'generation-status error';
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
    emailSpan.textContent = '\u2709 ' + profile.personal.email;
    contacts.appendChild(emailSpan);
  }
  if (profile.personal.phone) {
    const phoneSpan = document.createElement('span');
    phoneSpan.textContent = '\u260E ' + profile.personal.phone;
    contacts.appendChild(phoneSpan);
  }
  if (profile.personal.location) {
    const locSpan = document.createElement('span');
    locSpan.textContent = '\u25CB ' + profile.personal.location;
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
