function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildCVHTML(profile, data, style, lang) {
  const isIt = lang === 'it';
  const labels = isIt
    ? { summary: 'Profilo Professionale', competencies: 'Competenze Chiave', experience: 'Esperienza Professionale', education: 'Formazione', additional: 'Lingue e Strumenti' }
    : { summary: 'Professional Summary', competencies: 'Core Competencies', experience: 'Professional Experience', education: 'Education', additional: 'Languages & Tools' };

  let html = `<div id="cv-container" data-theme="${esc(style || 'professional')}">`;

  // Header
  html += '<div class="cv-header">';
  if (profile.photo_path) {
    html += `<img class="cv-photo" src="${esc(profile.photo_path)}" alt="${esc(profile.personal?.name)}" />`;
  }
  html += '<div class="cv-header-text">';
  html += `<div class="cv-name">${esc(profile.personal?.name)}</div>`;
  html += `<div class="cv-headline">${esc(data.headline)}</div>`;
  html += '<div class="cv-contacts">';
  if (profile.personal?.email) html += `<span>${esc(profile.personal.email)}</span>`;
  if (profile.personal?.phone) html += `<span>${esc(profile.personal.phone)}</span>`;
  if (profile.personal?.location) html += `<span>${esc(profile.personal.location)}</span>`;
  html += '</div></div></div>';

  // Body
  html += '<div class="cv-body">';

  // Summary
  html += `<div class="cv-section"><div class="cv-section-title">${labels.summary}</div>`;
  html += `<div class="cv-summary">${esc(data.summary)}</div></div>`;

  // Competencies
  if (data.competencies?.length > 0) {
    html += `<div class="cv-section"><div class="cv-section-title">${labels.competencies}</div>`;
    html += '<div class="cv-competencies">';
    data.competencies.forEach((c) => { html += `<span class="cv-badge">${esc(c)}</span>`; });
    html += '</div></div>';
  }

  // Experience
  html += `<div class="cv-section"><div class="cv-section-title">${labels.experience}</div>`;
  (profile.experiences || []).forEach((exp, i) => {
    if (data.omittedExperiences?.some((o) => o.index === i)) return;
    const bullets = data.experience?.[i]?.bullets || exp.bullets || [];
    html += '<div class="cv-exp-item">';
    html += `<div class="cv-exp-header"><span class="cv-exp-role">${esc(exp.role)}</span><span class="cv-exp-period">${esc(exp.period)}</span></div>`;
    html += `<div class="cv-exp-company">${esc(exp.company)}</div>`;
    html += '<ul class="cv-exp-bullets">';
    bullets.forEach((b) => { html += `<li>${esc(b)}</li>`; });
    html += '</ul></div>';
  });
  html += '</div>';

  // Education
  html += `<div class="cv-section"><div class="cv-section-title">${labels.education}</div>`;
  (profile.education || []).forEach((edu) => {
    html += '<div class="cv-edu-item">';
    html += `<div class="cv-edu-degree">${esc(edu.degree)}</div>`;
    html += `<div class="cv-edu-school">${esc(edu.school || '')}${edu.period ? ' | ' + esc(edu.period) : ''}</div>`;
    if (edu.grade) html += `<div class="cv-edu-detail">${esc(edu.grade)}</div>`;
    html += '</div>';
  });
  html += '</div>';

  // Languages & Tools
  html += `<div class="cv-section"><div class="cv-section-title">${labels.additional}</div>`;
  html += '<div class="cv-inline-list">';
  if (profile.languages?.length > 0) {
    html += '<span>' + profile.languages.map((l) => esc(l.language) + ' (' + esc(l.level) + ')').join(' \u00B7 ') + '</span>';
  }
  if (data.skills) html += `<span> | ${esc(data.skills)}</span>`;
  html += '</div></div>';

  html += '</div></div>';
  return html;
}
