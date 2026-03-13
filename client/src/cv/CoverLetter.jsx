import { useState, useCallback } from 'react';
import { api } from '../api';
import { t } from '../strings';
import { useAuth } from '../hooks/useAuth';

function LetterResult({ letter }) {
  const [copyLabel, setCopyLabel] = useState(t('coverLetter.copy'));
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
      <button className="btn-secondary btn-sm cover-letter-copy" onClick={handleCopy}>
        {copyLabel}
      </button>
    </>
  );
}

export default function CoverLetter({ profile, generated, jobDescription, lang }) {
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
      setLetter(data.coverLetter || data);
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

      <p className="cover-letter-hint">{t('coverLetter.hint')}</p>

      <button className="btn-primary" disabled={loading} onClick={handleGenerate}>
        {loading ? t('coverLetter.generating') : t('coverLetter.generate')}
      </button>

      <div className={`cover-letter-result${letter ? ' visible' : ''}${error ? ' error' : ''}`}>
        {error && t('coverLetter.error')}
        {letter && <LetterResult letter={letter} />}
      </div>
    </div>
  );
}
