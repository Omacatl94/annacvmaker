import { api } from './api.js';
import { handleLogout } from './auth.js';
import { getUser } from './app.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let currentProfile = null;
let profiles = [];
let formData = defaultFormData();

function defaultFormData() {
  return {
    label: 'CV Principale',
    personal: { name: '', email: '', phone: '', location: '' },
    photo_path: null,
    experiences: [{ role: '', company: '', period: '', bullets: [''] }],
    education: [{ degree: '', school: '', period: '', grade: '' }],
    skills: [],
    languages: [{ language: '', level: '' }],
  };
}

// Shared reference so the generation step can read the latest saved profile.
export let lastSavedProfile = null;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export async function renderDashboard(root) {
  root.textContent = '';
  const user = getUser();

  const dashboard = document.createElement('div');
  dashboard.className = 'dashboard';

  renderHeader(dashboard, user);

  const main = document.createElement('main');
  main.className = 'dashboard-main';
  dashboard.appendChild(main);

  root.appendChild(dashboard);

  // Load profiles then build UI
  await loadProfiles();
  renderProfileSelector(main);
  renderForm(main);
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function renderHeader(container, user) {
  const header = document.createElement('header');
  header.className = 'dashboard-header';

  const h1 = document.createElement('h1');
  h1.textContent = 'CV Maker';
  header.appendChild(h1);

  const userInfo = document.createElement('div');
  userInfo.className = 'user-info';

  const userName = document.createElement('span');
  userName.textContent = user.name || user.email;
  userInfo.appendChild(userName);

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn-secondary';
  logoutBtn.textContent = 'Logout';
  logoutBtn.addEventListener('click', handleLogout);
  userInfo.appendChild(logoutBtn);

  header.appendChild(userInfo);
  container.appendChild(header);
}

// ---------------------------------------------------------------------------
// Profile selector
// ---------------------------------------------------------------------------
function renderProfileSelector(container) {
  // Remove old selector if re-rendering
  const old = container.querySelector('.profile-selector');
  if (old) old.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'profile-selector card';

  const label = document.createElement('label');
  label.textContent = 'Profilo';
  label.style.fontWeight = '600';
  label.style.marginRight = '12px';
  wrapper.appendChild(label);

  const select = document.createElement('select');
  select.className = 'profile-select';

  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '+ Nuovo profilo';
  select.appendChild(newOpt);

  profiles.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label || `Profilo ${p.id}`;
    if (currentProfile && currentProfile.id === p.id) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    if (select.value === '__new__') {
      currentProfile = null;
      formData = defaultFormData();
    } else {
      const found = profiles.find((p) => String(p.id) === select.value);
      if (found) loadProfileIntoForm(found);
    }
    // Re-render form area
    const formContainer = container.querySelector('.cv-form-container');
    if (formContainer) {
      formContainer.remove();
      renderForm(container);
    }
  });

  wrapper.appendChild(select);

  // Insert before the form
  const formContainer = container.querySelector('.cv-form-container');
  if (formContainer) {
    container.insertBefore(wrapper, formContainer);
  } else {
    container.appendChild(wrapper);
  }
}

// ---------------------------------------------------------------------------
// Form wrapper
// ---------------------------------------------------------------------------
function renderForm(container) {
  const formWrap = document.createElement('div');
  formWrap.className = 'cv-form-container';

  renderLabelSection(formWrap);
  renderPersonalSection(formWrap);
  renderPhotoUpload(formWrap);
  renderExperiencesSection(formWrap);
  renderEducationSection(formWrap);
  renderSkillsSection(formWrap);
  renderLanguagesSection(formWrap);
  renderActions(formWrap);

  container.appendChild(formWrap);
}

// ---------------------------------------------------------------------------
// Profile Label
// ---------------------------------------------------------------------------
function renderLabelSection(container) {
  const section = createSection('Etichetta Profilo');
  section.appendChild(createInput('Nome profilo', formData.label, (v) => { formData.label = v; }));
  container.appendChild(section);
}

// ---------------------------------------------------------------------------
// Personal Info
// ---------------------------------------------------------------------------
function renderPersonalSection(container) {
  const section = createSection('Informazioni Personali');

  const grid = document.createElement('div');
  grid.className = 'form-grid';

  grid.appendChild(createInput('Nome completo', formData.personal.name, (v) => { formData.personal.name = v; }));
  grid.appendChild(createInput('Email', formData.personal.email, (v) => { formData.personal.email = v; }, 'email'));
  grid.appendChild(createInput('Telefono', formData.personal.phone, (v) => { formData.personal.phone = v; }, 'tel'));
  grid.appendChild(createInput('Località', formData.personal.location, (v) => { formData.personal.location = v; }));

  section.appendChild(grid);
  container.appendChild(section);
}

// ---------------------------------------------------------------------------
// Photo Upload
// ---------------------------------------------------------------------------
function renderPhotoUpload(container) {
  const section = createSection('Foto');

  const zone = document.createElement('div');
  zone.className = 'photo-upload-zone';

  const preview = document.createElement('div');
  preview.className = 'photo-preview';

  if (formData.photo_path) {
    const img = document.createElement('img');
    img.src = formData.photo_path;
    img.alt = 'Foto profilo';
    preview.appendChild(img);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'photo-placeholder';
    placeholder.textContent = 'Clicca per caricare';
    preview.appendChild(placeholder);
  }

  zone.appendChild(preview);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const res = await api.uploadPhoto(file);
      formData.photo_path = res.path || res.url;
      // Update preview
      preview.textContent = '';
      const img = document.createElement('img');
      img.src = formData.photo_path;
      img.alt = 'Foto profilo';
      preview.appendChild(img);
    } catch (err) {
      showFeedback(section, 'Errore upload foto: ' + err.message, true);
    }
  });

  zone.addEventListener('click', () => fileInput.click());
  zone.appendChild(fileInput);

  section.appendChild(zone);
  container.appendChild(section);
}

// ---------------------------------------------------------------------------
// Experiences (dynamic)
// ---------------------------------------------------------------------------
function renderExperiencesSection(container) {
  const section = createSection('Esperienze');
  section.id = 'section-experiences';

  rebuildExperiences(section);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-secondary';
  addBtn.textContent = '+ Aggiungi esperienza';
  addBtn.style.marginTop = '8px';
  addBtn.addEventListener('click', () => {
    formData.experiences.push({ role: '', company: '', period: '', bullets: [''] });
    rebuildExperiences(section);
  });
  section.appendChild(addBtn);

  container.appendChild(section);
}

function rebuildExperiences(section) {
  // Remove old entries but keep the section title and add-btn
  section.querySelectorAll('.dynamic-entry').forEach((el) => el.remove());

  const addBtn = section.querySelector('.btn-secondary');

  formData.experiences.forEach((exp, i) => {
    const entry = document.createElement('div');
    entry.className = 'dynamic-entry card';

    const entryHeader = document.createElement('div');
    entryHeader.className = 'entry-header';

    const title = document.createElement('strong');
    title.textContent = 'Esperienza ' + (i + 1);
    entryHeader.appendChild(title);

    if (formData.experiences.length > 1) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-danger-sm';
      removeBtn.textContent = 'Rimuovi';
      removeBtn.addEventListener('click', () => {
        formData.experiences.splice(i, 1);
        rebuildExperiences(section);
      });
      entryHeader.appendChild(removeBtn);
    }

    entry.appendChild(entryHeader);

    const grid = document.createElement('div');
    grid.className = 'form-grid';
    grid.appendChild(createInput('Ruolo', exp.role, (v) => { exp.role = v; }));
    grid.appendChild(createInput('Azienda', exp.company, (v) => { exp.company = v; }));
    grid.appendChild(createInput('Periodo', exp.period, (v) => { exp.period = v; }));
    entry.appendChild(grid);

    // Bullets
    const bulletsLabel = document.createElement('label');
    bulletsLabel.textContent = 'Punti salienti';
    bulletsLabel.className = 'bullets-label';
    entry.appendChild(bulletsLabel);

    const bulletsContainer = document.createElement('div');
    bulletsContainer.className = 'bullets-container';

    exp.bullets.forEach((bullet, bi) => {
      const row = document.createElement('div');
      row.className = 'bullet-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = bullet;
      input.placeholder = 'Descrivi un risultato...';
      input.addEventListener('input', () => { exp.bullets[bi] = input.value; });
      row.appendChild(input);

      if (exp.bullets.length > 1) {
        const removeBullet = document.createElement('button');
        removeBullet.className = 'btn-danger-sm';
        removeBullet.textContent = '\u00D7';
        removeBullet.title = 'Rimuovi punto';
        removeBullet.addEventListener('click', () => {
          exp.bullets.splice(bi, 1);
          rebuildExperiences(section);
        });
        row.appendChild(removeBullet);
      }

      bulletsContainer.appendChild(row);
    });

    const addBulletBtn = document.createElement('button');
    addBulletBtn.className = 'btn-secondary btn-sm';
    addBulletBtn.textContent = '+ Aggiungi punto';
    addBulletBtn.addEventListener('click', () => {
      exp.bullets.push('');
      rebuildExperiences(section);
    });
    bulletsContainer.appendChild(addBulletBtn);

    entry.appendChild(bulletsContainer);

    if (addBtn) {
      section.insertBefore(entry, addBtn);
    } else {
      section.appendChild(entry);
    }
  });
}

// ---------------------------------------------------------------------------
// Education (dynamic)
// ---------------------------------------------------------------------------
function renderEducationSection(container) {
  const section = createSection('Formazione');
  section.id = 'section-education';

  rebuildEducation(section);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-secondary';
  addBtn.textContent = '+ Aggiungi formazione';
  addBtn.style.marginTop = '8px';
  addBtn.addEventListener('click', () => {
    formData.education.push({ degree: '', school: '', period: '', grade: '' });
    rebuildEducation(section);
  });
  section.appendChild(addBtn);

  container.appendChild(section);
}

function rebuildEducation(section) {
  section.querySelectorAll('.dynamic-entry').forEach((el) => el.remove());
  const addBtn = section.querySelector('.btn-secondary');

  formData.education.forEach((edu, i) => {
    const entry = document.createElement('div');
    entry.className = 'dynamic-entry card';

    const entryHeader = document.createElement('div');
    entryHeader.className = 'entry-header';

    const title = document.createElement('strong');
    title.textContent = 'Formazione ' + (i + 1);
    entryHeader.appendChild(title);

    if (formData.education.length > 1) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-danger-sm';
      removeBtn.textContent = 'Rimuovi';
      removeBtn.addEventListener('click', () => {
        formData.education.splice(i, 1);
        rebuildEducation(section);
      });
      entryHeader.appendChild(removeBtn);
    }

    entry.appendChild(entryHeader);

    const grid = document.createElement('div');
    grid.className = 'form-grid';
    grid.appendChild(createInput('Titolo di studio', edu.degree, (v) => { edu.degree = v; }));
    grid.appendChild(createInput('Istituto', edu.school, (v) => { edu.school = v; }));
    grid.appendChild(createInput('Periodo', edu.period, (v) => { edu.period = v; }));
    grid.appendChild(createInput('Voto', edu.grade, (v) => { edu.grade = v; }));
    entry.appendChild(grid);

    if (addBtn) {
      section.insertBefore(entry, addBtn);
    } else {
      section.appendChild(entry);
    }
  });
}

// ---------------------------------------------------------------------------
// Skills (tag input)
// ---------------------------------------------------------------------------
function renderSkillsSection(container) {
  const section = createSection('Competenze');

  const tagsOuter = document.createElement('div');
  tagsOuter.className = 'tags-container';

  const renderTags = () => {
    // Clear everything except the input
    tagsOuter.querySelectorAll('.tag').forEach((t) => t.remove());

    // Re-insert tags before the input
    const input = tagsOuter.querySelector('.tag-input');
    formData.skills.forEach((skill, i) => {
      const tag = document.createElement('span');
      tag.className = 'tag';

      const text = document.createElement('span');
      text.textContent = skill;
      tag.appendChild(text);

      const remove = document.createElement('span');
      remove.className = 'tag-remove';
      remove.textContent = '\u00D7';
      remove.addEventListener('click', () => {
        formData.skills.splice(i, 1);
        renderTags();
      });
      tag.appendChild(remove);

      tagsOuter.insertBefore(tag, input);
    });
  };

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tag-input';
  input.placeholder = 'Digita una competenza e premi Invio';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value.trim();
      if (val && !formData.skills.includes(val)) {
        formData.skills.push(val);
        input.value = '';
        renderTags();
      }
    }
  });

  tagsOuter.appendChild(input);
  renderTags();

  section.appendChild(tagsOuter);
  container.appendChild(section);
}

// ---------------------------------------------------------------------------
// Languages (dynamic)
// ---------------------------------------------------------------------------
function renderLanguagesSection(container) {
  const section = createSection('Lingue');
  section.id = 'section-languages';

  rebuildLanguages(section);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-secondary';
  addBtn.textContent = '+ Aggiungi lingua';
  addBtn.style.marginTop = '8px';
  addBtn.addEventListener('click', () => {
    formData.languages.push({ language: '', level: '' });
    rebuildLanguages(section);
  });
  section.appendChild(addBtn);

  container.appendChild(section);
}

function rebuildLanguages(section) {
  section.querySelectorAll('.dynamic-entry').forEach((el) => el.remove());
  const addBtn = section.querySelector('.btn-secondary');

  const levels = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Madrelingua'];

  formData.languages.forEach((lang, i) => {
    const entry = document.createElement('div');
    entry.className = 'dynamic-entry card';

    const entryHeader = document.createElement('div');
    entryHeader.className = 'entry-header';

    const title = document.createElement('strong');
    title.textContent = 'Lingua ' + (i + 1);
    entryHeader.appendChild(title);

    if (formData.languages.length > 1) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-danger-sm';
      removeBtn.textContent = 'Rimuovi';
      removeBtn.addEventListener('click', () => {
        formData.languages.splice(i, 1);
        rebuildLanguages(section);
      });
      entryHeader.appendChild(removeBtn);
    }

    entry.appendChild(entryHeader);

    const grid = document.createElement('div');
    grid.className = 'form-grid';
    grid.appendChild(createInput('Lingua', lang.language, (v) => { lang.language = v; }));
    grid.appendChild(createSelect('Livello', levels, lang.level, (v) => { lang.level = v; }));
    entry.appendChild(grid);

    if (addBtn) {
      section.insertBefore(entry, addBtn);
    } else {
      section.appendChild(entry);
    }
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function renderActions(container) {
  const section = document.createElement('div');
  section.className = 'form-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Salva Profilo';
  saveBtn.addEventListener('click', () => saveProfile(section));

  const continueBtn = document.createElement('button');
  continueBtn.className = 'btn-primary';
  continueBtn.style.marginLeft = '12px';
  continueBtn.textContent = 'Continua alla generazione';
  continueBtn.addEventListener('click', () => {
    // Store the current form data as lastSavedProfile for the generation step
    lastSavedProfile = collectFormData();
    showFeedback(section, 'Dati pronti per la generazione.', false);
  });

  section.appendChild(saveBtn);
  section.appendChild(continueBtn);

  container.appendChild(section);
}

// ---------------------------------------------------------------------------
// Save profile
// ---------------------------------------------------------------------------
async function saveProfile(feedbackContainer) {
  const data = collectFormData();
  try {
    let result;
    if (currentProfile && currentProfile.id) {
      result = await api.updateProfile(currentProfile.id, data);
    } else {
      result = await api.createProfile(data);
    }
    // Refresh profiles list
    currentProfile = result.profile || result;
    lastSavedProfile = currentProfile;
    await loadProfiles();

    // Re-render selector to reflect updated list
    const main = feedbackContainer.closest('.dashboard-main');
    if (main) renderProfileSelector(main);

    showFeedback(feedbackContainer, 'Profilo salvato con successo!', false);
  } catch (err) {
    showFeedback(feedbackContainer, 'Errore: ' + err.message, true);
  }
}

// ---------------------------------------------------------------------------
// Load profiles from API
// ---------------------------------------------------------------------------
async function loadProfiles() {
  try {
    const res = await api.getProfiles();
    profiles = res.profiles || res || [];
  } catch {
    profiles = [];
  }
}

// ---------------------------------------------------------------------------
// Load a profile into formData
// ---------------------------------------------------------------------------
function loadProfileIntoForm(profile) {
  currentProfile = profile;
  const d = profile.data || profile;
  formData = {
    label: d.label || profile.label || 'CV Principale',
    personal: { ...{ name: '', email: '', phone: '', location: '' }, ...(d.personal || {}) },
    photo_path: d.photo_path || null,
    experiences: Array.isArray(d.experiences) && d.experiences.length
      ? d.experiences.map((e) => ({
          role: e.role || '',
          company: e.company || '',
          period: e.period || '',
          bullets: Array.isArray(e.bullets) && e.bullets.length ? [...e.bullets] : [''],
        }))
      : [{ role: '', company: '', period: '', bullets: [''] }],
    education: Array.isArray(d.education) && d.education.length
      ? d.education.map((e) => ({
          degree: e.degree || '',
          school: e.school || '',
          period: e.period || '',
          grade: e.grade || '',
        }))
      : [{ degree: '', school: '', period: '', grade: '' }],
    skills: Array.isArray(d.skills) ? [...d.skills] : [],
    languages: Array.isArray(d.languages) && d.languages.length
      ? d.languages.map((l) => ({ language: l.language || '', level: l.level || '' }))
      : [{ language: '', level: '' }],
  };
}

// ---------------------------------------------------------------------------
// Collect current formData snapshot
// ---------------------------------------------------------------------------
function collectFormData() {
  return JSON.parse(JSON.stringify(formData));
}

// ---------------------------------------------------------------------------
// Helpers — DOM builders
// ---------------------------------------------------------------------------
function createSection(titleText) {
  const section = document.createElement('section');
  section.className = 'form-section card';

  const h2 = document.createElement('h2');
  h2.className = 'section-title';
  h2.textContent = titleText;
  section.appendChild(h2);

  return section;
}

function createInput(labelText, value, onChange, type) {
  const group = document.createElement('div');
  group.className = 'form-group';

  const label = document.createElement('label');
  label.textContent = labelText;
  group.appendChild(label);

  const input = document.createElement('input');
  input.type = type || 'text';
  input.value = value || '';
  input.addEventListener('input', () => onChange(input.value));
  group.appendChild(input);

  return group;
}

function createTextarea(labelText, value, onChange) {
  const group = document.createElement('div');
  group.className = 'form-group';

  const label = document.createElement('label');
  label.textContent = labelText;
  group.appendChild(label);

  const textarea = document.createElement('textarea');
  textarea.value = value || '';
  textarea.addEventListener('input', () => onChange(textarea.value));
  group.appendChild(textarea);

  return group;
}

function createSelect(labelText, options, value, onChange) {
  const group = document.createElement('div');
  group.className = 'form-group';

  const label = document.createElement('label');
  label.textContent = labelText;
  group.appendChild(label);

  const select = document.createElement('select');
  options.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt || '— Seleziona —';
    if (opt === value) o.selected = true;
    select.appendChild(o);
  });
  select.addEventListener('change', () => onChange(select.value));
  group.appendChild(select);

  return group;
}

function showFeedback(container, message, isError) {
  // Remove existing feedback
  const old = container.querySelector('.feedback-msg');
  if (old) old.remove();

  const msg = document.createElement('div');
  msg.className = 'feedback-msg' + (isError ? ' feedback-error' : ' feedback-success');
  msg.textContent = message;
  container.appendChild(msg);

  setTimeout(() => { if (msg.parentNode) msg.remove(); }, 4000);
}
