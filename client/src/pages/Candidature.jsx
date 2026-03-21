import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { buildCVHTML } from '../cv/buildCVHTML';
import { downloadLetterPDF } from '../cv/CoverLetter';
import Icon from '../components/Icon';
import layoutCSS from '../../css/cv-layout.css?raw';
import themesCSS from '../../css/cv-themes.css?raw';

const STATUS_MAP = {
  generated: { label: 'Generato', color: '#9E9E9E' },
  sent: { label: 'Inviato', color: '#00E676' },
  waiting: { label: 'In attesa', color: '#FFB300' },
  interview: { label: 'Colloquio', color: '#42A5F5' },
  rejected: { label: 'Rifiutato', color: '#EF5350' },
};

export default function Candidature() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getGenerated()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const filtered = search.trim()
    ? items.filter((i) => {
        const q = search.toLowerCase();
        return (
          (i.target_role || '').toLowerCase().includes(q) ||
          (i.target_company || '').toLowerCase().includes(q) ||
          (i.notes || '').toLowerCase().includes(q)
        );
      })
    : items;

  if (!loaded) return null;

  return (
    <div className="candidature-page">
      <div className="candidature-header">
        <input
          type="text"
          className="candidature-search"
          placeholder="Cerca per azienda o ruolo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="candidature-list">
        {items.length === 0 ? (
          <p className="candidature-empty">
            Nessuna candidatura ancora. Genera il primo CV dal tab &quot;Genera CV&quot; per iniziare.
          </p>
        ) : filtered.length === 0 ? (
          <p className="candidature-empty">Nessun risultato trovato.</p>
        ) : (
          filtered.map((item) => (
            <CandidatureCard
              key={item.id}
              item={item}
              onUpdate={(id, updates) => {
                setItems((prev) =>
                  prev.map((it) => (it.id === id ? { ...it, ...updates } : it))
                );
              }}
              onDelete={(id) => {
                setItems((prev) => prev.filter((it) => it.id !== id));
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CandidatureCard({ item, onUpdate, onDelete }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [letterLoading, setLetterLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const coverLetter = typeof item.cover_letter_data === 'string'
    ? JSON.parse(item.cover_letter_data)
    : item.cover_letter_data;
  const saveTimerRef = useRef(null);

  const role = item.target_role || 'Ruolo non specificato';
  const company = item.target_company || '';
  const date = new Date(item.created_at).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
  });

  const handleStatusChange = async (newStatus) => {
    try {
      await api.updateGenerated(item.id, { status: newStatus });
      onUpdate(item.id, { status: newStatus });
    } catch {
      /* silent */
    }
  };

  const handleNotesChange = (e) => {
    const val = e.target.value;
    onUpdate(item.id, { notes: val });
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api.updateGenerated(item.id, { notes: val });
      } catch {
        /* silent */
      }
    }, 800);
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const data =
        typeof item.generated_data === 'string'
          ? JSON.parse(item.generated_data)
          : item.generated_data;
      const profile = data._profile;
      if (!profile) throw new Error('Profilo non disponibile per questo CV');

      const cvHTML = buildCVHTML(profile, data, item.style || 'professional', item.language || 'it');

      // layoutCSS and themesCSS imported at top via ?raw

      const fullHTML =
        '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lato:wght@400;700&display=swap" rel="stylesheet">' +
        '<style>@page{size:A4;margin:0}body{margin:0;padding:0;background:#fff}' +
        '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
        layoutCSS +
        themesCSS +
        '</style></head><body>' +
        cvHTML +
        '</body></html>';

      const sanitize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_ -]/g, '').replace(/\s+/g, '_');
      const basename = `${sanitize(item.target_role || 'CV')}_${sanitize(item.target_company || '')}`;
      const blob = await api.exportPDF(fullHTML, basename);
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = basename + '.pdf';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    } catch (err) {
      alert('Errore PDF: ' + err.message);
    }
    setPdfLoading(false);
  };

  const handleDelete = async () => {
    const label = item.target_role || 'questa candidatura';
    if (!confirm(`Eliminare "${label}"? L'azione è irreversibile.`)) return;
    setDeleting(true);
    try {
      await api.deleteGenerated(item.id);
      onDelete(item.id);
    } catch {
      alert('Errore durante l\'eliminazione.');
      setDeleting(false);
    }
  };

  const currentStatus = item.status || 'generated';
  const statusColor = STATUS_MAP[currentStatus]?.color || '#ccc';

  const statusKeys = Object.keys(STATUS_MAP);
  const activeIndex = statusKeys.indexOf(currentStatus);

  return (
    <div className="candidature-card card">
      {/* Status stepper timeline */}
      <div className="status-stepper">
        {statusKeys.map((key, i) => {
          const meta = STATUS_MAP[key];
          const isActive = key === currentStatus;
          const isPast = i < activeIndex;
          return (
            <button
              key={key}
              className={`stepper-step${isActive ? ' active' : ''}${isPast ? ' past' : ''}`}
              onClick={() => handleStatusChange(key)}
              title={meta.label}
              style={{ '--step-color': meta.color }}
            >
              <span className="stepper-dot" />
              <span className="stepper-label">{meta.label}</span>
            </button>
          );
        })}
        <div className="stepper-track">
          <div
            className="stepper-fill"
            style={{
              width: `${(activeIndex / (statusKeys.length - 1)) * 100}%`,
              background: statusColor,
            }}
          />
        </div>
      </div>

      {/* Title + actions row */}
      <div className="candidature-top">
        <div className="candidature-title">
          {company ? `${role} \u2014 ${company}` : role}
        </div>
        <div className="candidature-top-right">
          <span className="candidature-date">{date}</span>
          <div className="candidature-icon-actions">
            <button
              className="icon-action"
              title="Scarica CV (PDF)"
              aria-label="Scarica CV PDF"
              disabled={pdfLoading}
              onClick={handleDownloadPDF}
            >
              <Icon name={pdfLoading ? 'clock' : 'download'} size={20} />
            </button>
            {coverLetter && (
              <button
                className="icon-action"
                title="Scarica lettera (PDF)"
                aria-label="Scarica lettera PDF"
                disabled={letterLoading}
                onClick={async () => {
                  setLetterLoading(true);
                  try { await downloadLetterPDF(coverLetter, item.target_role || 'presentazione'); } catch { /* silent */ }
                  setLetterLoading(false);
                }}
              >
                <Icon name={letterLoading ? 'clock' : 'mail'} size={20} />
              </button>
            )}
            <button
              className="icon-action icon-action-danger"
              title="Elimina"
              aria-label="Elimina candidatura"
              disabled={deleting}
              onClick={handleDelete}
            >
              <Icon name="trash" size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="candidature-notes">
        <input
          type="text"
          className="notes-input"
          value={item.notes || ''}
          placeholder='Appunti — es. "Colloquio il 15/03, parlato con HR"'
          onChange={handleNotesChange}
        />
      </div>
    </div>
  );
}
