import { api } from './api.js';
import { getUser, navigate } from './app.js';
import { createUploadZone } from './cv-upload.js';
import { renderGenerationStep, renderCVPreview, getSelectedStyle, getSelectedLang, renderOneTap } from './cv-generator.js';
import { renderATSPanel } from './ats-panel.js';
import { renderEditorToolbar } from './cv-editor.js';
import { renderExportButtons } from './cv-export.js';
import { renderCoverLetterPanel } from './cover-letter.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let currentProfile = null;
let profiles = [];
let formData = defaultFormData();

function defaultFormData() {
  let user = null;
  try { user = getUser(); } catch { /* module not yet initialized */ }
  return {
    label: 'CV Principale',
    personal: {
      name: (user && !user.guest && user.name) || '',
      email: (user && !user.guest && user.email) || '',
      phone: (user && !user.guest && user.phone) || '',
      location: (user && !user.guest && user.location) || '',
    },
    photo_path: null,
    experiences: [{ role: '', company: '', period: '', bullets: [''] }],
    education: [{ degree: '', school: '', period: '', grade: '' }],
    skills: [],
    languages: [{ language: '', level: '' }],
  };
}

// Shared reference so the generation step can read the latest saved profile.
export let lastSavedProfile = null;

function hasRealData() {
  return formData.experiences &&
    formData.experiences.length > 0 &&
    formData.experiences.some(e => e.role && e.role.trim() !== '');
}

// ===========================================================================
// TAB 1: "Il mio CV" (profilo)
// ===========================================================================
export async function renderProfilePage(container) {
  container.textContent = '';
  const user = getUser();

  if (!currentProfile) {
    formData = defaultFormData();
  }

  const main = document.createElement('main');
  main.className = 'dashboard-main';
  container.appendChild(main);

  if (user.guest) {
    renderGuestBanner(main);
  } else {
    await loadProfiles();
    if (!currentProfile && profiles.length > 0) {
      loadProfileIntoForm(profiles[0]);
    }
  }

  renderProfileForm(main);
}

// ---------------------------------------------------------------------------
// Profile form (tab "Il mio CV")
// ---------------------------------------------------------------------------
function renderProfileForm(container) {
  const formWrap = document.createElement('div');
  formWrap.className = 'cv-form-container';

  // Upload zone — adaptive size
  if (hasRealData()) {
    // Compact upload button
    const uploadCompact = document.createElement('div');
    uploadCompact.className = 'upload-compact card';

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn-secondary';
    uploadBtn.textContent = 'Aggiorna dati da CV';
    uploadBtn.addEventListener('click', () => {
      // Toggle full upload zone
      const existing = uploadCompact.querySelector('.upload-zone');
      if (existing) {
        existing.remove();
        return;
      }
      const zone = createUploadZone((parsedData) => {
        applyParsedData(parsedData);
        const parent = formWrap.parentNode;
        formWrap.remove();
        renderProfileForm(parent);
      });
      uploadCompact.appendChild(zone);
    });
    uploadCompact.appendChild(uploadBtn);
    formWrap.appendChild(uploadCompact);
  } else {
    // Big prominent upload zone
    const uploadSection = document.createElement('div');
    uploadSection.className = 'upload-prominent card';

    const uploadTitle = document.createElement('h3');
    uploadTitle.textContent = 'Carica il tuo CV per iniziare';
    uploadSection.appendChild(uploadTitle);

    const uploadSub = document.createElement('p');
    uploadSub.className = 'upload-prominent-sub';
    uploadSub.textContent = 'L\'AI legge il tuo CV e pre-compila tutti i campi. Puoi anche compilare manualmente.';
    uploadSection.appendChild(uploadSub);

    const zone = createUploadZone((parsedData) => {
      applyParsedData(parsedData);
      const parent = formWrap.parentNode;
      formWrap.remove();
      renderProfileForm(parent);
    });
    uploadSection.appendChild(zone);
    formWrap.appendChild(uploadSection);
  }

  renderPersonalSection(formWrap);
  renderPhotoUpload(formWrap);
  renderExperiencesSection(formWrap);
  renderEducationSection(formWrap);
  renderSkillsSection(formWrap);
  renderLanguagesSection(formWrap);
  renderProfileActions(formWrap);

  container.appendChild(formWrap);
}

// ---------------------------------------------------------------------------
// Apply parsed CV data (always overwrite)
// ---------------------------------------------------------------------------
function applyParsedData(parsedData) {
  if (parsedData.personal) {
    formData.personal = {
      name: parsedData.personal.name || '',
      email: parsedData.personal.email || '',
      phone: parsedData.personal.phone || '',
      location: parsedData.personal.location || '',
    };
  }
  if (parsedData.experiences && parsedData.experiences.length > 0) {
    formData.experiences = parsedData.experiences;
  }
  if (parsedData.education && parsedData.education.length > 0) {
    formData.education = parsedData.education;
  }
  if (parsedData.skills && parsedData.skills.length > 0) {
    formData.skills = parsedData.skills;
  }
  if (parsedData.languages && parsedData.languages.length > 0) {
    formData.languages = parsedData.languages;
  }
}

// ---------------------------------------------------------------------------
// Profile actions (save only — no "go to generation")
// ---------------------------------------------------------------------------
function renderProfileActions(container) {
  const section = document.createElement('div');
  section.className = 'form-actions';

  const user = getUser();

  if (!user.guest) {
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = 'Salva profilo';
    saveBtn.addEventListener('click', () => saveProfile(section));
    section.appendChild(saveBtn);
  }

  container.appendChild(section);
}

// ===========================================================================
// TAB 2: "Genera CV" (genera)
// ===========================================================================
export async function renderGeneraPage(container) {
  container.textContent = '';
  const user = getUser();

  const main = document.createElement('main');
  main.className = 'dashboard-main';
  container.appendChild(main);

  if (!user.guest) {
    await loadProfiles();
    if (!currentProfile && profiles.length > 0) {
      loadProfileIntoForm(profiles[0]);
    }
  }

  // Check if profile has data
  if (!hasRealData()) {
    renderEmptyProfilePrompt(main);
    return;
  }

  // Profile summary (read-only)
  renderProfileSummary(main);

  // One-tap + generation flow
  const genContainer = document.createElement('div');
  main.appendChild(genContainer);

  const profile = collectFormData();
  lastSavedProfile = profile;

  // One-tap
  const oneTapContainer = document.createElement('div');
  renderOneTap(oneTapContainer, profile, (result, jd) => {
    lastSavedProfile = collectFormData();
    showCVWithTools(main, lastSavedProfile, result, jd);
  });
  genContainer.appendChild(oneTapContainer);

  // Full generation
  renderGenerationStep(genContainer, profile, (generatedResult, jobDescription) => {
    showCVWithTools(main, profile, generatedResult, jobDescription);
  });
}

// ---------------------------------------------------------------------------
// Empty profile prompt
// ---------------------------------------------------------------------------
function renderEmptyProfilePrompt(container) {
  const card = document.createElement('div');
  card.className = 'empty-profile-prompt card';

  const title = document.createElement('h3');
  title.textContent = 'Compila prima il tuo CV';
  card.appendChild(title);

  const text = document.createElement('p');
  text.textContent = 'Per generare un CV ottimizzato, devi prima inserire le tue esperienze e competenze.';
  card.appendChild(text);

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = 'Vai a Il mio CV';
  btn.addEventListener('click', () => navigate('profilo'));
  card.appendChild(btn);

  container.appendChild(card);
}

// ---------------------------------------------------------------------------
// Profile summary (read-only, top of genera tab)
// ---------------------------------------------------------------------------
function renderProfileSummary(container) {
  const card = document.createElement('div');
  card.className = 'profile-summary card';

  const left = document.createElement('div');
  left.className = 'profile-summary-info';

  const name = document.createElement('strong');
  name.textContent = formData.personal.name || 'Profilo';
  left.appendChild(name);

  // Most recent role
  const recentExp = formData.experiences.find(e => e.role && e.role.trim());
  if (recentExp) {
    const role = document.createElement('span');
    role.className = 'profile-summary-role';
    role.textContent = recentExp.role + (recentExp.company ? ' @ ' + recentExp.company : '');
    left.appendChild(role);
  }

  const stats = document.createElement('span');
  stats.className = 'profile-summary-stats';
  const expCount = formData.experiences.filter(e => e.role && e.role.trim()).length;
  const skillCount = formData.skills.length;
  stats.textContent = `${expCount} esperienze \u00B7 ${skillCount} competenze`;
  left.appendChild(stats);

  card.appendChild(left);

  const editLink = document.createElement('button');
  editLink.className = 'btn-secondary btn-sm';
  editLink.textContent = 'Modifica';
  editLink.addEventListener('click', () => navigate('profilo'));
  card.appendChild(editLink);

  container.appendChild(card);
}

// ===========================================================================
// Guest banner
// ===========================================================================
function renderGuestBanner(container) {
  const banner = document.createElement('div');
  banner.className = 'guest-banner card';

  const warnIcon = document.createElement('span');
  warnIcon.textContent = '\u26A0';
  banner.appendChild(warnIcon);

  const text = document.createElement('span');
  text.textContent = 'Stai provando come ospite. I dati non vengono salvati.';
  banner.appendChild(text);

  const link = document.createElement('button');
  link.className = 'guest-banner-link';
  link.textContent = 'Accedi per non perderli';
  link.addEventListener('click', () => {
    window.location.href = '/api/auth/google';
  });
  banner.appendChild(link);

  container.appendChild(banner);
}

// ===========================================================================
// Generation flow — post-generation tools
// ===========================================================================

function showCVWithTools(main, profile, data, jobDescription) {
  main.textContent = '';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn-secondary';
  backBtn.style.marginBottom = '16px';
  backBtn.textContent = '\u2190 Nuova generazione';
  backBtn.addEventListener('click', () => navigate('genera'));
  main.appendChild(backBtn);

  // Auto-save for registered users, or show registration prompt for guests
  const user = getUser();
  if (!user.guest && profile.id) {
    autoSaveGenerated(profile, data, jobDescription).catch(() => {});
  } else if (user.guest) {
    const regBanner = document.createElement('div');
    regBanner.className = 'register-prompt card';
    const title = document.createElement('strong');
    title.textContent = 'Vuoi salvare le candidature e ottenere CV extra?';
    regBanner.appendChild(title);
    const desc = document.createElement('p');
    desc.textContent = 'Registrati per tracciare i CV generati, accedere al link referral e sbloccare generazioni bonus.';
    regBanner.appendChild(desc);
    const regBtn = document.createElement('button');
    regBtn.className = 'btn-primary btn-sm';
    regBtn.textContent = 'Registrati gratis';
    regBtn.addEventListener('click', () => {
      window.location.hash = '#login';
      import('./app.js').then(m => m.default?.());
    });
    regBanner.appendChild(regBtn);
    main.appendChild(regBanner);
  }

  // Editor toolbar
  const toolbarContainer = document.createElement('div');
  main.appendChild(toolbarContainer);
  renderEditorToolbar(toolbarContainer, profile, () => {
    const existingAts = main.querySelector('.ats-panel');
    if (existingAts) {
      existingAts.textContent = '';
      renderATSPanel(existingAts, profile, jobDescription, (optimizedData) => {
        renderCVPreview(previewContainer, profile, optimizedData, getSelectedStyle());
      });
    }
  });

  // CV preview
  const previewContainer = document.createElement('div');
  previewContainer.className = 'cv-preview-wrapper';
  main.appendChild(previewContainer);
  renderCVPreview(previewContainer, profile, data, getSelectedStyle());

  // Export buttons
  const exportContainer = document.createElement('div');
  main.appendChild(exportContainer);
  renderExportButtons(exportContainer, profile);

  // ATS scoring
  const atsContainer = document.createElement('div');
  main.appendChild(atsContainer);
  renderATSPanel(atsContainer, profile, jobDescription, (optimizedData) => {
    renderCVPreview(previewContainer, profile, optimizedData, getSelectedStyle());
  });

  // Cover letter
  const clContainer = document.createElement('div');
  main.appendChild(clContainer);
  renderCoverLetterPanel(clContainer, profile, data, jobDescription);
}

async function autoSaveGenerated(profile, data, jobDescription) {
  await api.saveGenerated({
    profile_id: profile.id,
    job_description: jobDescription || '',
    target_role: data.target_role || data.targetRole || data.roleTitle || '',
    target_company: data.target_company || data.targetCompany || data.companyName || '',
    language: getSelectedLang(),
    style: getSelectedStyle(),
    generated_data: { ...data, _profile: profile },
    ats_classic: data.ats_classic || null,
    ats_smart: data.ats_smart || null,
  });
}

// ===========================================================================
// Save profile
// ===========================================================================
async function saveProfile(feedbackContainer) {
  const data = collectFormData();
  try {
    const targetId = currentProfile?.id || (profiles.length > 0 ? profiles[0].id : null);
    if (targetId) {
      const result = await api.updateProfile(targetId, data);
      currentProfile = result.profile || result;
    } else {
      const result = await api.createProfile(data);
      currentProfile = result.profile || result;
    }
    lastSavedProfile = currentProfile;
    await loadProfiles();
    showFeedback(feedbackContainer, 'Profilo salvato.', false);
  } catch (err) {
    showFeedback(feedbackContainer, 'Errore: ' + err.message, true);
  }
}

// ===========================================================================
// Load profiles from API
// ===========================================================================
async function loadProfiles() {
  try {
    const res = await api.getProfiles();
    profiles = res.profiles || res || [];
  } catch {
    profiles = [];
  }
}

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

function collectFormData() {
  return JSON.parse(JSON.stringify(formData));
}

// ===========================================================================
// Form sections (shared)
// ===========================================================================

function renderPersonalSection(container) {
  const section = createSection('Informazioni Personali');
  const grid = document.createElement('div');
  grid.className = 'form-grid';
  grid.appendChild(createInput('Nome completo', formData.personal.name, (v) => { formData.personal.name = v; }));
  grid.appendChild(createInput('Email', formData.personal.email, (v) => { formData.personal.email = v; }, 'email'));
  grid.appendChild(createInput('Telefono', formData.personal.phone, (v) => { formData.personal.phone = v; }, 'tel'));
  grid.appendChild(createInput('Localita\u0300', formData.personal.location, (v) => { formData.personal.location = v; }));
  section.appendChild(grid);
  container.appendChild(section);
}

function renderPhotoUpload(container) {
  const section = createSection('Foto');
  const zone = document.createElement('div');
  zone.className = 'photo-upload-zone';

  const preview = document.createElement('div');
  preview.className = 'photo-preview';

  function updatePhotoPreview(path) {
    preview.textContent = '';
    preview.className = 'photo-preview';
    if (path) {
      const img = document.createElement('img');
      img.src = path;
      img.alt = 'Foto profilo';
      preview.appendChild(img);
      const label = document.createElement('span');
      label.className = 'photo-placeholder';
      label.textContent = 'Sostituisci foto';
      preview.appendChild(label);
    } else {
      preview.classList.add('photo-preview--empty');
      const placeholder = document.createElement('span');
      placeholder.className = 'photo-placeholder';
      placeholder.textContent = 'Carica una foto';
      preview.appendChild(placeholder);
    }
  }
  updatePhotoPreview(formData.photo_path);
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
      updatePhotoPreview(formData.photo_path);
      if (currentProfile && currentProfile.id) {
        api.updateProfile(currentProfile.id, { photo_path: formData.photo_path }).catch(() => {});
        showFeedback(section, 'Foto salvata.', false);
      } else {
        showFeedback(section, 'Foto caricata. Salva il profilo per non perderla.', false);
      }
    } catch (err) {
      showFeedback(section, 'Errore upload foto: ' + err.message, true);
    }
  });

  zone.addEventListener('click', () => fileInput.click());
  zone.appendChild(fileInput);
  section.appendChild(zone);
  container.appendChild(section);
}

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
      input.placeholder = 'Cosa hai fatto di concreto...';
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

function renderSkillsSection(container) {
  const section = createSection('Competenze');

  const tagsOuter = document.createElement('div');
  tagsOuter.className = 'tags-container';

  const renderTags = () => {
    tagsOuter.querySelectorAll('.tag').forEach((t) => t.remove());
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
  input.placeholder = 'Scrivi una competenza e premi Invio';
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

// ===========================================================================
// Helpers — DOM builders
// ===========================================================================
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
    o.textContent = opt || '\u2014 Seleziona \u2014';
    if (opt === value) o.selected = true;
    select.appendChild(o);
  });
  select.addEventListener('change', () => onChange(select.value));
  group.appendChild(select);
  return group;
}

function showFeedback(container, message, isError) {
  const old = container.querySelector('.feedback-msg');
  if (old) old.remove();
  const msg = document.createElement('div');
  msg.className = 'feedback-msg' + (isError ? ' feedback-error' : ' feedback-success');
  msg.textContent = message;
  container.appendChild(msg);
  setTimeout(() => { if (msg.parentNode) msg.remove(); }, 4000);
}
