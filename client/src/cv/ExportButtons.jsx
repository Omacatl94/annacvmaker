import { useState, useCallback } from 'react';
import { api } from '../api';
import { t } from '../strings';
import { track } from '../analytics';
import { useAuth } from '../hooks/useAuth';

const BADGE_CSS = `
.jh-badge{position:fixed;bottom:12px;right:12px;background:#6c63ff;color:#fff;font-family:system-ui,sans-serif;font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;opacity:.7;pointer-events:none;z-index:9999}
`;
const BADGE_HTML = '<div class="jh-badge">Creato con JobHacker</div>';

let _hasPurchased = null;

async function hasPurchased() {
  if (_hasPurchased !== null) return _hasPurchased;
  try {
    const balance = await api.getBalance();
    _hasPurchased = !!balance.hasPurchased;
  } catch {
    _hasPurchased = false;
  }
  return _hasPurchased;
}

function sanitizeFilename(str) {
  return str
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80);
}

function sanitizeText(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildFilename(profile, generated) {
  const name = sanitizeFilename(profile.personal?.name || 'CV');
  const role = sanitizeFilename(generated.target_role || generated.targetRole || generated.roleTitle || '');
  const company = sanitizeFilename(generated.target_company || generated.targetCompany || generated.companyName || '');
  let filename = name + '_CV';
  if (role) filename += '_' + role;
  if (company) filename += '_' + company;
  return filename;
}

async function buildFullHTML(profile, lang) {
  const cvContainer = document.getElementById('cv-container');
  if (!cvContainer) return null;

  let layoutCSS = '';
  let themesCSS = '';
  try {
    const [layoutRes, themesRes] = await Promise.all([
      fetch('/css/cv-layout.css'),
      fetch('/css/cv-themes.css'),
    ]);
    layoutCSS = await layoutRes.text();
    themesCSS = await themesRes.text();
  } catch { /* proceed without inlined CSS */ }

  const cvHTML = cvContainer.outerHTML;
  const showBadge = !(await hasPurchased());
  const badgeStyle = showBadge ? BADGE_CSS : '';
  const badgeTag = showBadge ? BADGE_HTML : '';

  return `<!DOCTYPE html>
<html lang="${lang || 'it'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV - ${sanitizeText(profile.personal?.name || 'CV')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lato:wght@400;700&display=swap" rel="stylesheet">
  <style>
@page { margin: 0; }
body { margin: 0; padding: 0; background: #fff; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
#cv-container { min-height: auto; box-shadow: none; margin: 0; }
${layoutCSS}
${themesCSS}
${badgeStyle}
  </style>
</head>
<body>
${cvHTML}
${badgeTag}
</body>
</html>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

export default function ExportButtons({ profile, style, lang, generated }) {
  const { user } = useAuth();
  const [pdfState, setPdfState] = useState('idle'); // idle | loading | error
  const [saveState, setSaveState] = useState('idle'); // idle | loading | saved | error

  const handleHTMLDownload = useCallback(async () => {
    if (!generated) return;
    const fullHTML = await buildFullHTML(profile, lang);
    if (!fullHTML) return;

    const filename = buildFilename(profile, generated) + '.html';
    const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, filename);
  }, [profile, lang, generated]);

  const handlePDFExport = useCallback(async () => {
    if (!generated) return;

    setPdfState('loading');
    try {
      const fullHTML = await buildFullHTML(profile, lang);
      if (!fullHTML) {
        setPdfState('idle');
        return;
      }

      const basename = buildFilename(profile, generated);
      track('cv_exported_pdf');

      const blob = await api.exportPDF(fullHTML, basename);
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      downloadBlob(pdfBlob, basename + '.pdf');

      setPdfState('idle');
    } catch {
      setPdfState('error');
      setTimeout(() => setPdfState('idle'), 2000);
    }
  }, [profile, lang, generated]);

  const handleSaveDB = useCallback(async () => {
    if (!generated || !profile.id) return;

    setSaveState('loading');
    try {
      await api.saveGenerated({
        profile_id: profile.id,
        job_description: generated.job_description || generated.jobDescription || '',
        target_role: generated.target_role || generated.targetRole || '',
        target_company: generated.target_company || generated.targetCompany || '',
        language: lang,
        style,
        generated_data: generated,
        ats_keyword_score: generated.ats_keyword_score || null,
        ats_format_score: generated.ats_format_score || null,
        ats_overall_score: generated.ats_overall_score || null,
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 2000);
    }
  }, [profile, style, lang, generated]);

  const pdfLabel =
    pdfState === 'loading' ? t('export.pdfLoading') :
    pdfState === 'error' ? t('export.errorPdf') :
    t('export.pdf');

  const saveLabel =
    saveState === 'loading' ? t('export.saving') :
    saveState === 'saved' ? t('export.saved') :
    saveState === 'error' ? t('export.errorSave') :
    t('export.saveDb');

  return (
    <div className="export-buttons">
      <button
        className="btn-download"
        disabled={pdfState === 'loading'}
        onClick={handlePDFExport}
      >
        {pdfLabel}
      </button>

      <button className="btn-print" onClick={handleHTMLDownload}>
        {t('export.html')}
      </button>

      {user && !user.guest && (
        <button
          className="btn-save-db"
          disabled={saveState === 'loading'}
          onClick={handleSaveDB}
        >
          {saveLabel}
        </button>
      )}
    </div>
  );
}
