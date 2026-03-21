import { useState, useCallback } from 'react';
import { api } from '../api';
import { t } from '../strings';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';

export function buildLetterHTML(letter, name) {
  const paragraphs = Array.isArray(letter.body) ? letter.body : [letter.body];
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
@page { margin: 0; }
body { margin: 40px 50px; font-family: Inter, sans-serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; }
.subject { font-size: 14pt; font-weight: 600; margin-bottom: 20px; }
.greeting { margin-bottom: 16px; }
p { margin-bottom: 12px; }
.closing { margin-top: 24px; }
.signature { margin-top: 8px; font-weight: 600; }
</style></head><body>
${letter.subject ? `<div class="subject">${letter.subject}</div>` : ''}
${letter.greeting ? `<p class="greeting">${letter.greeting}</p>` : ''}
${paragraphs.map(p => `<p>${p}</p>`).join('')}
${letter.closing ? `<p class="closing">${letter.closing}</p>` : ''}
${letter.signature ? `<p class="signature">${letter.signature}</p>` : ''}
</body></html>`;
}

export async function downloadLetterPDF(letter, name) {
  const html = buildLetterHTML(letter, name);
  const sanitize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_ -]/g, '').replace(/\s+/g, '_');
  const basename = `Lettera_${sanitize(name || 'presentazione')}`;
  const blob = await api.exportPDF(html, basename);
  const pdfBlob = new Blob([blob], { type: 'application/pdf' });
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = basename + '.pdf';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

function LetterResult({ letter, name }) {
  const [copyLabel, setCopyLabel] = useState(t('coverLetter.copy'));
  const [pdfLoading, setPdfLoading] = useState(false);
  const paragraphs = Array.isArray(letter.body) ? letter.body : [letter.body];

  const handleCopy = useCallback(() => {
    const text = [
      letter.subject,
      '',
      letter.greeting,
      '',
      ...paragraphs,
      '',
      letter.closing,
      letter.signature,
    ]
      .filter(Boolean)
      .join('\n\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel(t('coverLetter.copied'));
      setTimeout(() => setCopyLabel(t('coverLetter.copy')), 2000);
    });
  }, [letter, paragraphs]);

  return (
    <>
      {letter.subject && (
        <div className="cover-letter-subject">{letter.subject}</div>
      )}
      {letter.greeting && (
        <p className="cover-letter-greeting">{letter.greeting}</p>
      )}
      <div className="cover-letter-body">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {letter.closing && (
        <p className="cover-letter-closing">{letter.closing}</p>
      )}
      {letter.signature && (
        <p className="cover-letter-signature">{letter.signature}</p>
      )}
      <div className="cover-letter-actions">
        <button className="btn-secondary btn-sm" onClick={handleCopy}>
          {copyLabel}
        </button>
        <button
          className="btn-secondary btn-sm"
          disabled={pdfLoading}
          onClick={async () => {
            setPdfLoading(true);
            try { await downloadLetterPDF(letter, name); } catch { /* silent */ }
            setPdfLoading(false);
          }}
        >
          <Icon name="download" size={14} /> {pdfLoading ? '...' : 'PDF'}
        </button>
      </div>
    </>
  );
}

export default function CoverLetter({ profile, generated, jobDescription, lang, onLetterGenerated }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [letter, setLetter] = useState(null);
  const [error, setError] = useState(false);

  // Don't show for guests or without a job description
  if (!user || user.guest) return null;
  if (!jobDescription) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(false);
    setLetter(null);

    try {
      const data = await api.coverLetter({
        profile,
        jobDescription,
        generatedData: generated,
        language: generated?._language || lang || 'it',
      });
      const letterData = data.coverLetter || data;
      setLetter(letterData);
      if (onLetterGenerated) onLetterGenerated(letterData);
    } catch (err) {
      if (err.message === 'Crediti insufficienti' || err.message === 'Limite giornaliero raggiunto') {
        // Pricing modal would be triggered at a higher level
        setLoading(false);
        return;
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cover-letter-panel">
      <div className="cover-letter-header">
        <h3>{t('coverLetter.title')}</h3>
        <span className="cover-letter-cost">{t('coverLetter.cost')}</span>
      </div>

      {!letter && (
        <>
          <p className="cover-letter-hint">{t('coverLetter.hint')}</p>
          <button className="btn-primary" disabled={loading} onClick={handleGenerate}>
            {loading ? t('coverLetter.generating') : t('coverLetter.generate')}
          </button>
        </>
      )}

      <div className={`cover-letter-result${letter ? ' visible' : ''}${error ? ' error' : ''}`}>
        {error && t('coverLetter.error')}
        {letter && <LetterResult letter={letter} name={profile?.personal?.name} />}
      </div>
    </div>
  );
}
