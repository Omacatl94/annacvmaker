import { api } from './api.js';
import { navigate } from './app.js';

const STATUS_MAP = {
  sent: { label: 'Inviato', color: '#00E676' },
  waiting: { label: 'In attesa', color: '#FFB300' },
  interview: { label: 'Colloquio', color: '#42A5F5' },
  rejected: { label: 'Rifiutato', color: '#EF5350' },
};

export async function renderCandidature(container) {
  container.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'candidature-page';

  // Header bar
  const headerBar = document.createElement('div');
  headerBar.className = 'candidature-header';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'candidature-search';
  searchInput.placeholder = 'Cerca per azienda o ruolo...';
  headerBar.appendChild(searchInput);

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn-secondary';
  exportBtn.textContent = 'Esporta memo';
  headerBar.appendChild(exportBtn);

  wrapper.appendChild(headerBar);

  // List container
  const listEl = document.createElement('div');
  listEl.className = 'candidature-list';
  wrapper.appendChild(listEl);

  container.appendChild(wrapper);

  // Load data
  let items = [];
  try {
    items = await api.getGenerated();
  } catch { /* empty */ }

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'candidature-empty';
    empty.textContent = 'Nessuna candidatura ancora. Genera il primo CV dal tab "Genera CV" per iniziare.';
    listEl.appendChild(empty);
    return;
  }

  function renderList(filtered) {
    listEl.textContent = '';
    for (const item of filtered) {
      listEl.appendChild(buildCard(item));
    }
  }

  renderList(items);

  // Search
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) { renderList(items); return; }
    const filtered = items.filter(i =>
      (i.target_role || '').toLowerCase().includes(q) ||
      (i.target_company || '').toLowerCase().includes(q) ||
      (i.notes || '').toLowerCase().includes(q)
    );
    renderList(filtered);
  });

  // Export memo
  exportBtn.addEventListener('click', () => exportMemo(items));
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
function buildCard(item) {
  const card = document.createElement('div');
  card.className = 'candidature-card card';

  // Top row: role + company + status
  const topRow = document.createElement('div');
  topRow.className = 'candidature-top';

  const title = document.createElement('div');
  title.className = 'candidature-title';
  const role = item.target_role || 'Ruolo non specificato';
  const company = item.target_company || '';
  title.textContent = company ? `${role} \u2014 ${company}` : role;
  topRow.appendChild(title);

  const statusBadge = buildStatusSelect(item);
  topRow.appendChild(statusBadge);

  card.appendChild(topRow);

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'candidature-meta';

  const date = new Date(item.created_at).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const parts = [date];
  if (item.ats_classic || item.ats_smart) {
    const score = item.ats_smart || item.ats_classic;
    parts.push(`ATS: ${score}`);
  }
  if (item.location) parts.push(item.location);
  meta.textContent = parts.join(' \u00b7 ');
  card.appendChild(meta);

  // Notes
  const notesRow = document.createElement('div');
  notesRow.className = 'candidature-notes';

  const notesLabel = document.createElement('span');
  notesLabel.className = 'notes-label';
  notesLabel.textContent = 'Note: ';
  notesRow.appendChild(notesLabel);

  const notesInput = document.createElement('input');
  notesInput.type = 'text';
  notesInput.className = 'notes-input';
  notesInput.value = item.notes || '';
  notesInput.placeholder = 'Appunti — es. "Colloquio il 15/03, parlato con HR"';

  let saveTimer;
  notesInput.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await api.updateGenerated(item.id, { notes: notesInput.value });
        item.notes = notesInput.value;
      } catch { /* silent */ }
    }, 800);
  });
  notesRow.appendChild(notesInput);
  card.appendChild(notesRow);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'candidature-actions';

  const openBtn = document.createElement('button');
  openBtn.className = 'btn-secondary btn-sm';
  openBtn.textContent = 'Apri CV';
  openBtn.addEventListener('click', () => {
    // Store in sessionStorage for the generator to pick up
    sessionStorage.setItem('openGeneratedCV', JSON.stringify(item));
    navigate('genera');
  });
  actions.appendChild(openBtn);

  const pdfBtn = document.createElement('button');
  pdfBtn.className = 'btn-secondary btn-sm';
  pdfBtn.textContent = 'Scarica PDF';
  pdfBtn.addEventListener('click', async () => {
    pdfBtn.disabled = true;
    pdfBtn.textContent = 'Generazione...';
    try {
      const data = typeof item.generated_data === 'string' ? JSON.parse(item.generated_data) : item.generated_data;
      const profile = data._profile;
      if (!profile) throw new Error('Profilo non disponibile per questo CV');

      // Render CV in a hidden container
      const { renderCVPreview } = await import('./cv-generator.js');
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);
      renderCVPreview(tempDiv, profile, data, item.style || 'professional');

      // Get HTML and CSS
      const cvHTML = tempDiv.querySelector('#cv-container').outerHTML;
      document.body.removeChild(tempDiv);

      let layoutCSS = '', themesCSS = '';
      try {
        const [lr, tr] = await Promise.all([fetch('/css/cv-layout.css'), fetch('/css/cv-themes.css')]);
        layoutCSS = await lr.text();
        themesCSS = await tr.text();
      } catch { /* proceed without */ }

      const fullHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
        + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lato:wght@400;700&display=swap" rel="stylesheet">'
        + '<style>@page{size:A4;margin:0}body{margin:0;padding:0;background:#fff}'
        + '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'
        + layoutCSS + themesCSS + '</style></head><body>' + cvHTML + '</body></html>';

      const fname = `${(item.target_role || 'CV').replace(/\s+/g, '_')}_${(item.target_company || '').replace(/\s+/g, '_')}.pdf`;
      const blob = await api.exportPDF(fullHTML, fname);
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    } catch (err) {
      alert('Errore PDF: ' + err.message);
    }
    pdfBtn.disabled = false;
    pdfBtn.textContent = 'Scarica PDF';
  });
  actions.appendChild(pdfBtn);

  card.appendChild(actions);
  return card;
}

// ---------------------------------------------------------------------------
// Status select
// ---------------------------------------------------------------------------
function buildStatusSelect(item) {
  const select = document.createElement('select');
  select.className = 'status-select';

  for (const [val, meta] of Object.entries(STATUS_MAP)) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = meta.label;
    select.appendChild(opt);
  }
  select.value = item.status || 'sent';
  select.style.borderColor = STATUS_MAP[select.value]?.color || '#ccc';
  select.style.color = STATUS_MAP[select.value]?.color || '#333';

  select.addEventListener('change', async () => {
    try {
      await api.updateGenerated(item.id, { status: select.value });
      item.status = select.value;
      select.style.borderColor = STATUS_MAP[select.value]?.color || '#ccc';
      select.style.color = STATUS_MAP[select.value]?.color || '#333';
    } catch { /* silent */ }
  });

  return select;
}

// ---------------------------------------------------------------------------
// Export memo (simple text download)
// ---------------------------------------------------------------------------
function exportMemo(items) {
  const active = items.filter(i => i.status !== 'rejected');
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
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}
