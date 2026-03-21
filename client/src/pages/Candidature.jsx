import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { buildCVHTML } from '../cv/buildCVHTML';
import { downloadLetterPDF } from '../cv/CoverLetter';
import Icon from '../components/Icon';
import layoutCSS from '../../css/cv-layout.css?raw';
import themesCSS from '../../css/cv-themes.css?raw';

// Pipeline stages — sequential (except rejected, reachable from any)
const PIPELINE = [
  { key: 'generated',    label: 'Generato',    color: '#9E9E9E', icon: 'file-text',    prompt: null },
  { key: 'sent',         label: 'Inviato',     color: '#00E676', icon: 'send',         prompt: 'Dove hai inviato il CV? Via email, portale, LinkedIn?' },
  { key: 'phone_screen', label: 'Chiamata',    color: '#42A5F5', icon: 'phone',        prompt: 'Come \u00E8 andata la chiamata? Che impressione hai avuto?' },
  { key: 'interview',    label: 'Colloquio',   color: '#7C4DFF', icon: 'users',        prompt: 'Com\u0027\u00E8 andato il colloquio? Quante persone c\u0027erano?' },
  { key: 'negotiation',  label: 'Trattativa',  color: '#FFB300', icon: 'handshake',    prompt: 'Che proposta ti hanno fatto? Come ti sembra?' },
  { key: 'hired',        label: 'Assunto!',    color: '#00E676', icon: 'trophy',       prompt: 'Congratulazioni! Quando inizi?' },
];

const REJECTED = { key: 'rejected', label: 'Scartato', color: '#EF5350', icon: 'x-circle', prompt: 'Ti hanno dato un feedback? Cosa puoi migliorare?' };

const ALL_STATUSES = [...PIPELINE, REJECTED];
const STATUS_MAP = Object.fromEntries(ALL_STATUSES.map(s => [s.key, s]));

function getPipelineIndex(status) {
  const idx = PIPELINE.findIndex(s => s.key === status);
  return idx >= 0 ? idx : -1;
}

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
  const [raccoonPrompt, setRaccoonPrompt] = useState(null);

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

  const currentStatus = item.status || 'generated';
  const currentMeta = STATUS_MAP[currentStatus] || STATUS_MAP.generated;
  const pipelineIndex = getPipelineIndex(currentStatus);
  const isRejected = currentStatus === 'rejected';

  const handleStatusChange = async (newStatus) => {
    if (newStatus === currentStatus) return;

    const meta = STATUS_MAP[newStatus];
    const now = new Date();
    const timestamp = now.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const logEntry = `[${timestamp}] ${meta.label}`;

    // Auto-log in notes
    const existingNotes = item.notes || '';
    const newNotes = existingNotes ? `${existingNotes}\n${logEntry}` : logEntry;

    try {
      await api.updateGenerated(item.id, { status: newStatus, notes: newNotes });
      onUpdate(item.id, { status: newStatus, notes: newNotes });
    } catch {
      return;
    }

    // Show raccoon prompt if available
    if (meta.prompt) {
      setRaccoonPrompt({ status: newStatus, prompt: meta.prompt });
    }
  };

  const handleRaccoonSubmit = async (text) => {
    if (!text.trim()) {
      setRaccoonPrompt(null);
      return;
    }
    const meta = STATUS_MAP[raccoonPrompt.status];
    const updatedNotes = (item.notes || '') + `\n  \u2192 ${text.trim()}`;
    try {
      await api.updateGenerated(item.id, { notes: updatedNotes });
      onUpdate(item.id, { notes: updatedNotes });
    } catch { /* silent */ }
    setRaccoonPrompt(null);
  };

  const handleNotesChange = (e) => {
    const val = e.target.value;
    onUpdate(item.id, { notes: val });
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api.updateGenerated(item.id, { notes: val });
      } catch { /* silent */ }
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
    if (!confirm(`Eliminare "${label}"? L'azione \u00E8 irreversibile.`)) return;
    setDeleting(true);
    try {
      await api.deleteGenerated(item.id);
      onDelete(item.id);
    } catch {
      alert('Errore durante l\'eliminazione.');
      setDeleting(false);
    }
  };

  return (
    <div className="candidature-card card">
      {/* Pipeline stepper */}
      <div className="pipeline-stepper">
        <div className="pipeline-track">
          <div
            className="pipeline-fill"
            style={{
              width: isRejected ? '100%' : `${(pipelineIndex / (PIPELINE.length - 1)) * 100}%`,
              background: currentMeta.color,
            }}
          />
        </div>
        <div className="pipeline-steps">
          {PIPELINE.map((step, i) => {
            const isActive = step.key === currentStatus;
            const isPast = !isRejected && i < pipelineIndex;
            return (
              <button
                key={step.key}
                className={`pipeline-step${isActive ? ' active' : ''}${isPast ? ' past' : ''}`}
                onClick={() => handleStatusChange(step.key)}
                title={step.label}
                style={{ '--step-color': step.color }}
              >
                <span className="pipeline-dot">
                  <Icon name={step.icon} size={12} />
                </span>
                <span className="pipeline-label">{step.label}</span>
              </button>
            );
          })}
        </div>
        {/* Rejected button separate */}
        <button
          className={`pipeline-rejected${isRejected ? ' active' : ''}`}
          onClick={() => handleStatusChange('rejected')}
          title="Scartato"
        >
          <Icon name="x-circle" size={14} />
        </button>
      </div>

      {/* Raccoon prompt */}
      {raccoonPrompt && (
        <RaccoonPrompt
          prompt={raccoonPrompt.prompt}
          onSubmit={handleRaccoonSubmit}
          onSkip={() => setRaccoonPrompt(null)}
        />
      )}

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

      {/* Notes (collapsible) */}
      <NotesField notes={item.notes || ''} onChange={handleNotesChange} />
    </div>
  );
}

// ── Notes Field (collapsible) ──

function NotesField({ notes, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const lines = (notes || '').split('\n').filter(Boolean);
  const hasNotes = lines.length > 0;
  const preview = hasNotes ? lines[lines.length - 1] : '';

  return (
    <div className="candidature-notes">
      {!expanded ? (
        <div className="notes-collapsed" onClick={() => setExpanded(true)}>
          <Icon name="edit" size={14} />
          <span className="notes-preview">
            {hasNotes ? preview : 'Appunti...'}
          </span>
          {lines.length > 1 && (
            <span className="notes-count">+{lines.length - 1}</span>
          )}
        </div>
      ) : (
        <>
          <textarea
            className="notes-input notes-textarea"
            value={notes}
            placeholder="Il diario della tua candidatura appare qui..."
            onChange={onChange}
            rows={Math.max(3, lines.length + 1)}
            autoFocus
          />
          <button className="notes-collapse-btn" onClick={() => setExpanded(false)}>
            Chiudi
          </button>
        </>
      )}
    </div>
  );
}

// ── Raccoon Prompt Component ──

function RaccoonPrompt({ prompt, onSubmit, onSkip }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    onSubmit(text);
    setText('');
  };

  return (
    <div className="raccoon-prompt">
      <img src="/img/mascot/avatar.webp" alt="" className="raccoon-prompt-avatar" />
      <div className="raccoon-prompt-body">
        <p className="raccoon-prompt-text">{prompt}</p>
        <div className="raccoon-prompt-form">
          <input
            ref={inputRef}
            type="text"
            className="raccoon-prompt-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Scrivi qui..."
          />
          <button className="btn-sm btn-primary" onClick={handleSubmit}>
            <Icon name="send" size={14} />
          </button>
          <button className="btn-sm" onClick={onSkip}>
            Salta
          </button>
        </div>
      </div>
    </div>
  );
}
