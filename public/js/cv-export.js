import { api } from './api.js';
import {
  getGeneratedData,
  getSelectedLang,
  getSelectedStyle,
} from './cv-generator.js';
import { isEditing, saveIfEditing } from './cv-editor.js';

/**
 * Renders export buttons (Download HTML, Print, Save to DB) below the CV.
 * @param {HTMLElement} container — element to append buttons to
 * @param {Object} profile — the CV profile data
 */
export function renderExportButtons(container, profile) {
  const wrapper = document.createElement('div');
  wrapper.className = 'export-buttons';

  // --- Download HTML ---
  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'btn-download';
  downloadBtn.textContent = 'Scarica HTML';
  downloadBtn.addEventListener('click', () => handleDownload(profile));
  wrapper.appendChild(downloadBtn);

  // --- Print ---
  const printBtn = document.createElement('button');
  printBtn.className = 'btn-print';
  printBtn.textContent = 'Stampa';
  printBtn.addEventListener('click', () => handlePrint());
  wrapper.appendChild(printBtn);

  // --- Save to DB ---
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-save-db';
  saveBtn.textContent = 'Salva nel database';
  saveBtn.addEventListener('click', () => handleSaveDB(saveBtn, profile));
  wrapper.appendChild(saveBtn);

  container.appendChild(wrapper);
}

// ---------------------------------------------------------------------------
// Download standalone HTML
// ---------------------------------------------------------------------------
async function handleDownload(profile) {
  // If editing, save first
  if (isEditing()) {
    saveIfEditing(null);
  }

  const cvContainer = document.getElementById('cv-container');
  if (!cvContainer) return;

  const generatedData = getGeneratedData();
  if (!generatedData) return;

  // Fetch CSS files to inline them
  let layoutCSS = '';
  let themesCSS = '';
  try {
    const [layoutRes, themesRes] = await Promise.all([
      fetch('/css/cv-layout.css'),
      fetch('/css/cv-themes.css'),
    ]);
    layoutCSS = await layoutRes.text();
    themesCSS = await themesRes.text();
  } catch {
    // If fetch fails, proceed without inlined CSS
  }

  const cvHTML = cvContainer.outerHTML;

  const pageCSS = '@page { size: A4 portrait; margin: 0; }';
  const colorAdjust = `
    body { margin: 0; padding: 0; background: #fff; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  `;

  const fullHTML = `<!DOCTYPE html>
<html lang="${getSelectedLang() || 'it'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV - ${sanitizeText(profile.personal?.name || 'CV')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lato:wght@400;700&display=swap" rel="stylesheet">
  <style>
${pageCSS}
${colorAdjust}
${layoutCSS}
${themesCSS}
  </style>
</head>
<body>
${cvHTML}
</body>
</html>`;

  // Build filename: {Name}_CV_{Role}_{Company}.html
  const name = sanitizeFilename(profile.personal?.name || 'CV');
  const role = sanitizeFilename(generatedData.target_role || generatedData.targetRole || '');
  const company = sanitizeFilename(generatedData.target_company || generatedData.targetCompany || '');
  let filename = name + '_CV';
  if (role) filename += '_' + role;
  if (company) filename += '_' + company;
  filename += '.html';

  // Download via Blob
  const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------------
function handlePrint() {
  if (isEditing()) {
    saveIfEditing(null);
  }
  window.print();
}

// ---------------------------------------------------------------------------
// Save to DB
// ---------------------------------------------------------------------------
async function handleSaveDB(btn, profile) {
  if (isEditing()) {
    saveIfEditing(null);
  }

  const generatedData = getGeneratedData();
  if (!generatedData) return;

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Salvataggio...';

  try {
    await api.saveGenerated({
      profile_id: profile.id,
      job_description: generatedData.job_description || generatedData.jobDescription || '',
      target_role: generatedData.target_role || generatedData.targetRole || '',
      target_company: generatedData.target_company || generatedData.targetCompany || '',
      language: getSelectedLang(),
      style: getSelectedStyle(),
      generated_data: generatedData,
      ats_keyword_score: generatedData.ats_keyword_score || null,
      ats_format_score: generatedData.ats_format_score || null,
      ats_overall_score: generatedData.ats_overall_score || null,
    });
    btn.textContent = 'Salvato!';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
  } catch (err) {
    btn.textContent = 'Errore!';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitize a string for use in a filename: remove unsafe chars, replace spaces with underscores */
function sanitizeFilename(str) {
  return str
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80);
}

/** Escape text for safe insertion into an HTML attribute context (title tag) */
function sanitizeText(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
