import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { buildCVHTML } from '../cv/buildCVHTML';

const STATUS_MAP = {
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

  const handleExportMemo = useCallback(() => {
    const active = items.filter((i) => i.status !== 'rejected');
    if (active.length === 0) {
      alert('Nessuna candidatura attiva da esportare.');
      return;
    }

    let text = 'CANDIDATURE ATTIVE - JobHacker\n';
    text += '='.repeat(40) + '\n\n';

    for (const item of active) {
      const date = new Date(item.created_at).toLocaleDateString('it-IT');
      const role = item.target_role || 'Ruolo non specificato';
      const company = item.target_company || 'Azienda non specificata';
      const status = STATUS_MAP[item.status]?.label || item.status;
      const score = item.ats_smart || item.ats_classic || '-';

      text += `${role} - ${company}\n`;
      text += `Data: ${date} | Stato: ${status} | ATS: ${score}\n`;
      if (item.location) text += `Sede: ${item.location}\n`;
      if (item.notes) text += `Note: ${item.notes}\n`;
      text += '-'.repeat(40) + '\n\n';
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidature-memo.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  }, [items]);

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
        <button className="btn-secondary" onClick={handleExportMemo}>
          Esporta memo
        </button>
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
            />
          ))
        )}
      </div>
    </div>
  );
}

function CandidatureCard({ item, onUpdate }) {
  const navigate = useNavigate();
  const [pdfLoading, setPdfLoading] = useState(false);
  const saveTimerRef = useRef(null);

  const role = item.target_role || 'Ruolo non specificato';
  const company = item.target_company || '';
  const date = new Date(item.created_at).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const metaParts = [date];
  if (item.ats_classic || item.ats_smart) {
    metaParts.push(`ATS: ${item.ats_smart || item.ats_classic}`);
  }
  if (item.location) metaParts.push(item.location);

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
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

  const handleOpenCV = () => {
    sessionStorage.setItem('openGeneratedCV', JSON.stringify(item));
    navigate('/genera');
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

      let layoutCSS = '';
      let themesCSS = '';
      try {
        const [lr, tr] = await Promise.all([
          fetch('/css/cv-layout.css'),
          fetch('/css/cv-themes.css'),
        ]);
        layoutCSS = await lr.text();
        themesCSS = await tr.text();
      } catch {
        /* proceed without */
      }

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

      const basename = `${(item.target_role || 'CV').replace(/\s+/g, '_')}_${(item.target_company || '').replace(/\s+/g, '_')}`;
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

  const statusColor = STATUS_MAP[item.status || 'sent']?.color || '#ccc';

  return (
    <div className="candidature-card card">
      <div className="candidature-top">
        <div className="candidature-title">
          {company ? `${role} \u2014 ${company}` : role}
        </div>
        <select
          className="status-select"
          value={item.status || 'sent'}
          onChange={handleStatusChange}
          style={{ borderColor: statusColor, color: statusColor }}
        >
          {Object.entries(STATUS_MAP).map(([val, meta]) => (
            <option key={val} value={val}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      <div className="candidature-meta">{metaParts.join(' \u00B7 ')}</div>

      <div className="candidature-notes">
        <span className="notes-label">Note: </span>
        <input
          type="text"
          className="notes-input"
          value={item.notes || ''}
          placeholder='Appunti — es. "Colloquio il 15/03, parlato con HR"'
          onChange={handleNotesChange}
        />
      </div>

      <div className="candidature-actions">
        <button className="btn-secondary btn-sm" onClick={handleOpenCV}>
          Apri CV
        </button>
        <button
          className="btn-secondary btn-sm"
          disabled={pdfLoading}
          onClick={handleDownloadPDF}
        >
          {pdfLoading ? 'Generazione...' : 'Scarica PDF'}
        </button>
      </div>
    </div>
  );
}
