import { useState, useCallback } from 'react';
import { api } from '../api';
import { t } from '../strings';
import { track } from '../analytics';

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
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-zA-Z0-9_ -]/g, '') // only allowed chars
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

export default function ExportButtons({ profile, lang, generated }) {
  const [pdfState, setPdfState] = useState('idle');

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

  const pdfLabel =
    pdfState === 'loading' ? t('export.pdfLoading') :
    pdfState === 'error' ? t('export.errorPdf') :
    t('export.pdf');

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
    </div>
  );
}
