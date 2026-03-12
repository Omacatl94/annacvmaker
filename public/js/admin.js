import { api } from './api.js';
import { icon } from './icons.js';

let activePanel = 'dashboard';

export function renderAdmin(container) {
  container.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'admin-page';

  // Sub-tabs
  const nav = document.createElement('nav');
  nav.className = 'admin-nav';

  const panels = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'users', label: 'Utenti' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'errors', label: 'Errori' },
  ];

  for (const p of panels) {
    const btn = document.createElement('button');
    btn.className = 'admin-tab-btn' + (activePanel === p.id ? ' active' : '');
    btn.textContent = p.label;
    btn.addEventListener('click', () => {
      activePanel = p.id;
      renderAdmin(container);
    });
    nav.appendChild(btn);
  }
  wrapper.appendChild(nav);

  const content = document.createElement('div');
  content.className = 'admin-content';
  wrapper.appendChild(content);

  container.appendChild(wrapper);

  switch (activePanel) {
    case 'dashboard': renderDashboardPanel(content); break;
    case 'users': renderUsersPanel(content); break;
    case 'audit': renderAuditPanel(content); break;
    case 'errors': renderErrorsPanel(content); break;
  }
}

// ── Dashboard Panel ──
async function renderDashboardPanel(container) {
  container.textContent = 'Caricamento...';

  try {
    const [overview, orBalance] = await Promise.all([
      api.adminOverview(),
      api.adminOpenRouter().catch(() => null),
    ]);

    container.textContent = '';

    // KPI Cards
    const kpiGrid = document.createElement('div');
    kpiGrid.className = 'admin-kpi-grid';

    const kpis = [
      { label: 'Utenti registrati', value: overview.users.total, sub: `+${overview.users.last7d} (7gg) / +${overview.users.last30d} (30gg)` },
      { label: 'Revenue totale', value: '\u20AC' + (overview.revenue.totalCents / 100).toFixed(2), sub: `\u20AC${(overview.revenue.last30dCents / 100).toFixed(2)} ultimi 30gg` },
      { label: 'CV generati', value: overview.cvs.total, sub: `${overview.cvs.last30d} ultimi 30gg` },
      { label: 'Cover letter', value: overview.coverLetters, sub: `${overview.creditsUsed} crediti usati totali` },
    ];

    if (orBalance) {
      const bal = typeof orBalance.balance === 'number' ? orBalance.balance : null;
      const usage = typeof orBalance.usage === 'number' ? orBalance.usage : null;
      kpis.push({
        label: 'OpenRouter',
        value: bal !== null ? `$${bal.toFixed(2)}` : 'N/A',
        sub: usage !== null ? `$${usage.toFixed(2)} usati` : '',
        warn: bal !== null && bal < 5,
      });
    }

    for (const kpi of kpis) {
      const card = document.createElement('div');
      card.className = 'admin-kpi-card' + (kpi.warn ? ' warn' : '');

      const label = document.createElement('div');
      label.className = 'kpi-label';
      label.textContent = kpi.label;
      card.appendChild(label);

      const value = document.createElement('div');
      value.className = 'kpi-value';
      value.textContent = kpi.value;
      card.appendChild(value);

      if (kpi.sub) {
        const sub = document.createElement('div');
        sub.className = 'kpi-sub';
        sub.textContent = kpi.sub;
        card.appendChild(sub);
      }

      kpiGrid.appendChild(card);
    }
    container.appendChild(kpiGrid);

    // Quick actions
    const actionsRow = document.createElement('div');
    actionsRow.className = 'admin-actions-row';

    const inviteBtn = document.createElement('button');
    inviteBtn.className = 'btn-primary btn-sm';
    inviteBtn.textContent = 'Genera invito';
    inviteBtn.addEventListener('click', async () => {
      inviteBtn.disabled = true;
      inviteBtn.textContent = '...';
      try {
        const { code, link } = await api.adminGenerateInvite();
        inviteBtn.textContent = 'Genera invito';
        inviteBtn.disabled = false;

        const result = document.createElement('div');
        result.className = 'admin-invite-result';

        const codeEl = document.createElement('code');
        codeEl.textContent = code;
        result.appendChild(codeEl);

        const linkEl = document.createElement('a');
        linkEl.href = link;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener';
        linkEl.textContent = link;
        linkEl.style.marginLeft = '8px';
        result.appendChild(linkEl);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-secondary btn-sm';
        copyBtn.textContent = 'Copia link';
        copyBtn.style.marginLeft = '8px';
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(link).then(() => {
            copyBtn.textContent = 'Copiato!';
            setTimeout(() => { copyBtn.textContent = 'Copia link'; }, 2000);
          });
        });
        result.appendChild(copyBtn);

        const prev = actionsRow.querySelector('.admin-invite-result');
        if (prev) prev.remove();
        actionsRow.appendChild(result);
      } catch {
        inviteBtn.textContent = 'Errore!';
        inviteBtn.disabled = false;
        setTimeout(() => { inviteBtn.textContent = 'Genera invito'; }, 2000);
      }
    });
    actionsRow.appendChild(inviteBtn);
    container.appendChild(actionsRow);

    // Invite viral loop stats
    await renderInviteStats(container);

    // Charts
    await renderTimeseriesChart(container, 'registrations', 'Registrazioni');
    await renderTimeseriesChart(container, 'revenue', 'Revenue (centesimi)');

    // Cohort table
    await renderCohortTable(container);

  } catch (err) {
    container.textContent = 'Errore: ' + err.message;
  }
}

// ── Invite Viral Loop Stats ──
async function renderInviteStats(container) {
  const section = document.createElement('div');
  section.className = 'admin-chart-section';

  const h3 = document.createElement('h3');
  h3.textContent = 'Viral Loop';
  section.appendChild(h3);

  try {
    const data = await api.adminInviteStats();

    // KPI row for invite metrics
    const grid = document.createElement('div');
    grid.className = 'admin-kpi-grid';

    const inviteKpis = [
      { label: 'Codici totali', value: data.codes.total, sub: `${data.codes.available} disponibili` },
      { label: 'Claimed', value: data.codes.claimed, sub: `${data.rates.claimRate}% claim rate` },
      { label: 'Attivati', value: data.codes.activated, sub: `${data.rates.activationRate}% activation rate` },
      { label: 'k (viral coeff)', value: data.rates.k, sub: data.rates.k >= 1 ? 'Crescita virale!' : 'Sotto soglia virale', warn: data.rates.k < 0.5 },
      { label: 'Tempo medio attivazione', value: data.avgActivationHours ? `${data.avgActivationHours}h` : '—', sub: 'dalla claim al primo CV' },
      { label: 'Batch 2 sbloccati', value: data.users.batch2, sub: 'utenti con 3/3 attivati' },
      { label: 'Waitlist', value: data.waitlist.total, sub: `${data.waitlist.invited} invitati` },
      { label: 'Utenti attivi', value: data.users.active, sub: `${data.users.waitlist} in attesa` },
    ];

    for (const kpi of inviteKpis) {
      const card = document.createElement('div');
      card.className = 'admin-kpi-card' + (kpi.warn ? ' warn' : '');

      const label = document.createElement('div');
      label.className = 'kpi-label';
      label.textContent = kpi.label;
      card.appendChild(label);

      const value = document.createElement('div');
      value.className = 'kpi-value';
      value.textContent = kpi.value;
      card.appendChild(value);

      if (kpi.sub) {
        const sub = document.createElement('div');
        sub.className = 'kpi-sub';
        sub.textContent = kpi.sub;
        card.appendChild(sub);
      }

      grid.appendChild(card);
    }
    section.appendChild(grid);

    // Recent claims table
    if (data.recentClaims && data.recentClaims.length > 0) {
      const tableTitle = document.createElement('h4');
      tableTitle.textContent = 'Ultimi inviti usati';
      tableTitle.style.marginTop = '16px';
      section.appendChild(tableTitle);

      const table = document.createElement('table');
      table.className = 'admin-table';

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      for (const col of ['Codice', 'Invitante', 'Invitato', 'Claimed', 'Attivato']) {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
      }
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (const claim of data.recentClaims) {
        const tr = document.createElement('tr');

        const tdCode = document.createElement('td');
        const codeEl = document.createElement('code');
        codeEl.textContent = claim.code;
        tdCode.appendChild(codeEl);
        tr.appendChild(tdCode);

        const tdOwner = document.createElement('td');
        tdOwner.textContent = claim.owner_name || claim.owner_email || 'Admin';
        tr.appendChild(tdOwner);

        const tdInvitee = document.createElement('td');
        tdInvitee.textContent = claim.invitee_name || claim.invitee_email || '—';
        tr.appendChild(tdInvitee);

        const tdClaimed = document.createElement('td');
        tdClaimed.textContent = claim.claimed_at ? new Date(claim.claimed_at).toLocaleDateString('it-IT') : '—';
        tr.appendChild(tdClaimed);

        const tdActivated = document.createElement('td');
        tdActivated.textContent = claim.activated ? '✓' : '—';
        if (claim.activated) tdActivated.style.color = 'var(--color-accent)';
        tr.appendChild(tdActivated);

        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      section.appendChild(table);
    }

  } catch {
    const err = document.createElement('p');
    err.className = 'kpi-sub';
    err.textContent = 'Errore nel caricamento invite stats.';
    section.appendChild(err);
  }

  container.appendChild(section);
}

// ── Timeseries Chart (Canvas) ──
async function renderTimeseriesChart(container, metric, title) {
  const section = document.createElement('div');
  section.className = 'admin-chart-section';

  const h3 = document.createElement('h3');
  h3.textContent = title;
  section.appendChild(h3);

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 250;
  canvas.className = 'admin-chart';
  section.appendChild(canvas);

  container.appendChild(section);

  // Fetch last 90 days
  const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  try {
    const res = await api.adminTimeseries({ metric, from, to });
    drawLineChart(canvas, res.data, title);
  } catch {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#718096';
    ctx.fillText('Dati non disponibili', 20, 130);
  }
}

function drawLineChart(canvas, data, title) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const pad = { top: 20, right: 20, bottom: 40, left: 60 };

  ctx.clearRect(0, 0, W, H);

  if (!data.length) {
    ctx.fillStyle = '#718096';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('Nessun dato', W / 2 - 40, H / 2);
    return;
  }

  // Fill missing dates
  const filled = fillDates(data);
  const values = filled.map(d => d.value);
  const maxVal = Math.max(...values, 1);

  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
  }

  // Y-axis labels
  ctx.fillStyle = '#718096';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    const val = Math.round(maxVal * (1 - i / 4));
    ctx.fillText(val, pad.left - 8, y + 4);
  }

  // X-axis labels (every ~15 days)
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(filled.length / 6));
  for (let i = 0; i < filled.length; i += step) {
    const x = pad.left + (i / (filled.length - 1)) * chartW;
    ctx.fillText(filled[i].date.slice(5), x, H - 10);
  }

  // Data line
  ctx.strokeStyle = '#00E676';
  ctx.lineWidth = 2;
  ctx.beginPath();
  filled.forEach((d, i) => {
    const x = pad.left + (i / (filled.length - 1)) * chartW;
    const y = pad.top + chartH - (d.value / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Area fill
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#00E676';
  ctx.lineTo(pad.left + chartW, pad.top + chartH);
  ctx.lineTo(pad.left, pad.top + chartH);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Projection (dashed line, 30 days)
  if (filled.length >= 14) {
    const recent = filled.slice(-30);
    const projection = linearProjection(recent, 90);
    if (projection.length > 0) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.4)';
      ctx.beginPath();
      const lastX = pad.left + chartW;
      const lastY = pad.top + chartH - (filled[filled.length - 1].value / maxVal) * chartH;
      ctx.moveTo(lastX, lastY);
      const projVal = Math.max(0, projection[projection.length - 1].value);
      const projY = pad.top + chartH - (Math.min(projVal, maxVal * 1.5) / (maxVal * 1.5)) * chartH;
      ctx.lineTo(lastX + 30, projY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function fillDates(data) {
  if (!data.length) return [];
  const map = {};
  for (const d of data) map[d.date] = d.value;

  const start = new Date(data[0].date);
  const end = new Date(data[data.length - 1].date);
  const result = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, value: map[key] || 0 });
  }
  return result;
}

function linearProjection(data, days) {
  const n = data.length;
  if (n < 2) return [];
  const sumX = data.reduce((s, _, i) => s + i, 0);
  const sumY = data.reduce((s, d) => s + d.value, 0);
  const sumXY = data.reduce((s, d, i) => s + i * d.value, 0);
  const sumX2 = data.reduce((s, _, i) => s + i * i, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const result = [];
  for (let i = 0; i < days; i++) {
    result.push({ day: n + i, value: Math.round(intercept + slope * (n + i)) });
  }
  return result;
}

// ── Cohort Table ──
async function renderCohortTable(container) {
  const section = document.createElement('div');
  section.className = 'admin-section';

  const h3 = document.createElement('h3');
  h3.textContent = 'Retention per coorte';
  section.appendChild(h3);

  try {
    const res = await api.adminCohort();
    const cohorts = res.cohorts;
    const months = Object.keys(cohorts).sort();
    if (months.length === 0) {
      section.appendChild(Object.assign(document.createElement('p'), { textContent: 'Nessun dato' }));
      container.appendChild(section);
      return;
    }

    const allMonths = new Set();
    for (const m of months) {
      allMonths.add(m);
      for (const am of Object.keys(cohorts[m].months)) allMonths.add(am);
    }
    const sortedMonths = [...allMonths].sort();

    const table = document.createElement('table');
    table.className = 'admin-table cohort-table';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.appendChild(Object.assign(document.createElement('th'), { textContent: 'Coorte' }));
    headerRow.appendChild(Object.assign(document.createElement('th'), { textContent: 'Size' }));
    for (const m of sortedMonths) {
      headerRow.appendChild(Object.assign(document.createElement('th'), { textContent: m.slice(5) }));
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    for (const cohort of months) {
      const row = document.createElement('tr');
      row.appendChild(Object.assign(document.createElement('td'), { textContent: cohort }));
      row.appendChild(Object.assign(document.createElement('td'), { textContent: cohorts[cohort].size }));

      for (const m of sortedMonths) {
        const td = document.createElement('td');
        const active = cohorts[cohort].months[m] || 0;
        const pct = cohorts[cohort].size > 0 ? Math.round((active / cohorts[cohort].size) * 100) : 0;
        td.textContent = active > 0 ? `${pct}%` : '-';
        td.className = pct > 50 ? 'cohort-high' : pct > 20 ? 'cohort-mid' : 'cohort-low';
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    section.appendChild(table);
  } catch (err) {
    section.appendChild(Object.assign(document.createElement('p'), { textContent: 'Errore: ' + err.message }));
  }

  container.appendChild(section);
}

// ── Users Panel ──
async function renderUsersPanel(container) {
  container.textContent = '';

  const controls = document.createElement('div');
  controls.className = 'admin-controls';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Cerca per email o nome...';
  searchInput.className = 'admin-search';
  controls.appendChild(searchInput);

  container.appendChild(controls);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'admin-table-wrap';
  container.appendChild(tableWrap);

  let currentOffset = 0;
  const pageSize = 25;

  async function loadUsers(search, offset) {
    tableWrap.textContent = 'Caricamento...';
    try {
      const params = { limit: pageSize, offset, sort: 'created_at', order: 'desc' };
      if (search) params.search = search;
      const res = await api.adminUsers(params);
      renderUsersTable(tableWrap, res.users, res.total, offset, pageSize, (newOffset) => {
        currentOffset = newOffset;
        loadUsers(searchInput.value.trim(), currentOffset);
      });
    } catch (err) {
      tableWrap.textContent = 'Errore: ' + err.message;
    }
  }

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentOffset = 0;
      loadUsers(searchInput.value.trim(), 0);
    }, 400);
  });

  loadUsers('', 0);
}

function renderUsersTable(container, users, total, offset, pageSize, onPageChange) {
  container.textContent = '';

  const table = document.createElement('table');
  table.className = 'admin-table';

  const thead = document.createElement('thead');
  const hRow = document.createElement('tr');
  for (const col of ['Email', 'Nome', 'Crediti', 'CV generati', 'Spesa', 'Ultimo login', 'Registrato']) {
    hRow.appendChild(Object.assign(document.createElement('th'), { textContent: col }));
  }
  thead.appendChild(hRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const u of users) {
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';

    row.appendChild(Object.assign(document.createElement('td'), { textContent: u.email }));
    row.appendChild(Object.assign(document.createElement('td'), { textContent: u.name || '-' }));

    const creditsTd = document.createElement('td');
    creditsTd.className = 'credits-cell';
    const creditsSpan = document.createElement('span');
    creditsSpan.textContent = u.credits;
    creditsTd.appendChild(creditsSpan);
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-sm admin-edit-credits';
    editBtn.textContent = 'Modifica';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showCreditEditor(creditsTd, u, creditsSpan);
    });
    creditsTd.appendChild(editBtn);
    row.appendChild(creditsTd);

    row.appendChild(Object.assign(document.createElement('td'), { textContent: u.cvs_generated }));
    row.appendChild(Object.assign(document.createElement('td'), { textContent: '\u20AC' + (+u.total_spent_cents / 100).toFixed(2) }));
    row.appendChild(Object.assign(document.createElement('td'), { textContent: u.last_login ? new Date(u.last_login).toLocaleDateString('it-IT') : '-' }));
    row.appendChild(Object.assign(document.createElement('td'), { textContent: new Date(u.created_at).toLocaleDateString('it-IT') }));

    // Expandable detail
    row.addEventListener('click', () => toggleUserDetail(tbody, row, u));

    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  container.appendChild(table);

  // Pagination
  const totalPages = Math.ceil(total / pageSize);
  const currentPage = Math.floor(offset / pageSize) + 1;

  if (totalPages > 1) {
    const pag = document.createElement('div');
    pag.className = 'admin-pagination';
    pag.textContent = `Pagina ${currentPage} di ${totalPages} (${total} utenti)`;

    if (offset > 0) {
      const prev = document.createElement('button');
      prev.className = 'btn-sm';
      prev.textContent = '\u2190 Precedente';
      prev.addEventListener('click', () => onPageChange(offset - pageSize));
      pag.prepend(prev);
    }
    if (offset + pageSize < total) {
      const next = document.createElement('button');
      next.className = 'btn-sm';
      next.textContent = 'Successiva \u2192';
      next.addEventListener('click', () => onPageChange(offset + pageSize));
      pag.appendChild(next);
    }

    container.appendChild(pag);
  }
}

function showCreditEditor(td, user, creditsSpan) {
  const existing = td.querySelector('.credit-editor');
  if (existing) { existing.remove(); return; }

  const editor = document.createElement('div');
  editor.className = 'credit-editor';

  const input = document.createElement('input');
  input.type = 'number';
  input.value = user.credits;
  input.min = 0;
  editor.appendChild(input);

  const reasonInput = document.createElement('input');
  reasonInput.type = 'text';
  reasonInput.placeholder = 'Motivo';
  editor.appendChild(reasonInput);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-sm btn-primary';
  saveBtn.textContent = 'Salva';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      await api.adminUpdateCredits(user.id, { credits: +input.value, reason: reasonInput.value });
      user.credits = +input.value;
      creditsSpan.textContent = input.value;
      editor.remove();
    } catch (err) {
      alert('Errore: ' + err.message);
      saveBtn.disabled = false;
    }
  });
  editor.appendChild(saveBtn);

  td.appendChild(editor);
  input.focus();
}

async function toggleUserDetail(tbody, row, user) {
  const existing = row.nextElementSibling;
  if (existing && existing.classList.contains('user-detail-row')) {
    existing.remove();
    return;
  }

  const detailRow = document.createElement('tr');
  detailRow.className = 'user-detail-row';
  const td = document.createElement('td');
  td.colSpan = 7;
  td.textContent = 'Caricamento...';
  detailRow.appendChild(td);
  row.after(detailRow);

  try {
    const res = await api.adminUserDetail(user.id);
    td.textContent = '';

    // Purchases
    if (res.purchases.length > 0) {
      const h4 = document.createElement('h4');
      h4.textContent = 'Acquisti';
      td.appendChild(h4);
      for (const p of res.purchases) {
        const line = document.createElement('div');
        line.textContent = `${new Date(p.created_at).toLocaleDateString('it-IT')} \u2014 ${p.tier} (${p.credits_added} crediti, \u20AC${(p.amount_cents / 100).toFixed(2)})`;
        td.appendChild(line);
      }
    }

    // Recent usage
    if (res.usage.length > 0) {
      const h4 = document.createElement('h4');
      h4.textContent = 'Uso crediti recente';
      h4.style.marginTop = '12px';
      td.appendChild(h4);
      for (const u of res.usage.slice(0, 10)) {
        const line = document.createElement('div');
        line.textContent = `${new Date(u.created_at).toLocaleDateString('it-IT')} \u2014 ${u.action} (-${u.credits_consumed})`;
        td.appendChild(line);
      }
    }

    if (res.purchases.length === 0 && res.usage.length === 0) {
      td.textContent = 'Nessuna attivita\' registrata.';
    }
  } catch (err) {
    td.textContent = 'Errore: ' + err.message;
  }
}

// ── Audit Panel ──
async function renderAuditPanel(container) {
  container.textContent = '';

  const controls = document.createElement('div');
  controls.className = 'admin-controls';

  const actionSelect = document.createElement('select');
  actionSelect.className = 'admin-filter-select';
  const actions = ['', 'login_google', 'login_linkedin', 'login_guest', 'register_google', 'register_linkedin', 'logout', 'admin_credit_change'];
  for (const a of actions) {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a || 'Tutte le azioni';
    actionSelect.appendChild(opt);
  }
  controls.appendChild(actionSelect);

  container.appendChild(controls);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'admin-table-wrap';
  container.appendChild(tableWrap);

  async function loadAudit() {
    tableWrap.textContent = 'Caricamento...';
    try {
      const params = { limit: 50 };
      if (actionSelect.value) params.action = actionSelect.value;
      const res = await api.adminAudit(params);
      renderLogTable(tableWrap, res.logs, ['Data', 'Utente', 'Azione', 'IP'], (log) => [
        new Date(log.created_at).toLocaleString('it-IT'),
        log.user_email || log.user_id?.slice(0, 8) || '-',
        log.action,
        log.ip || '-',
      ]);
    } catch (err) {
      tableWrap.textContent = 'Errore: ' + err.message;
    }
  }

  actionSelect.addEventListener('change', loadAudit);
  loadAudit();
}

// ── Errors Panel ──
async function renderErrorsPanel(container) {
  container.textContent = '';

  const controls = document.createElement('div');
  controls.className = 'admin-controls';

  const levelSelect = document.createElement('select');
  levelSelect.className = 'admin-filter-select';
  for (const l of ['', 'error', 'warn', 'fatal']) {
    const opt = document.createElement('option');
    opt.value = l;
    opt.textContent = l || 'Tutti i livelli';
    levelSelect.appendChild(opt);
  }
  controls.appendChild(levelSelect);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Cerca nel messaggio...';
  searchInput.className = 'admin-search';
  controls.appendChild(searchInput);

  container.appendChild(controls);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'admin-table-wrap';
  container.appendChild(tableWrap);

  async function loadErrors() {
    tableWrap.textContent = 'Caricamento...';
    try {
      const params = { limit: 50 };
      if (levelSelect.value) params.level = levelSelect.value;
      if (searchInput.value.trim()) params.search = searchInput.value.trim();
      const res = await api.adminErrors(params);
      renderErrorTable(tableWrap, res.errors);
    } catch (err) {
      tableWrap.textContent = 'Errore: ' + err.message;
    }
  }

  levelSelect.addEventListener('change', loadErrors);
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadErrors, 400);
  });

  loadErrors();
}

function renderErrorTable(container, errors) {
  container.textContent = '';

  if (errors.length === 0) {
    container.textContent = 'Nessun errore. Bene cosi\'.';
    return;
  }

  const table = document.createElement('table');
  table.className = 'admin-table';

  const thead = document.createElement('thead');
  const hRow = document.createElement('tr');
  for (const col of ['Data', 'Level', 'Endpoint', 'Messaggio', 'Utente', 'Status']) {
    hRow.appendChild(Object.assign(document.createElement('th'), { textContent: col }));
  }
  thead.appendChild(hRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const err of errors) {
    const row = document.createElement('tr');
    row.className = 'error-row level-' + err.level;
    row.style.cursor = err.stack ? 'pointer' : 'default';

    row.appendChild(Object.assign(document.createElement('td'), { textContent: new Date(err.created_at).toLocaleString('it-IT') }));

    const levelTd = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'level-badge level-' + err.level;
    badge.textContent = err.level;
    levelTd.appendChild(badge);
    row.appendChild(levelTd);

    row.appendChild(Object.assign(document.createElement('td'), { textContent: err.endpoint || '-' }));
    row.appendChild(Object.assign(document.createElement('td'), { textContent: (err.message || '').substring(0, 100) }));
    row.appendChild(Object.assign(document.createElement('td'), { textContent: err.user_email || '-' }));
    row.appendChild(Object.assign(document.createElement('td'), { textContent: err.status_code || '-' }));

    if (err.stack) {
      row.addEventListener('click', () => {
        const existing = row.nextElementSibling;
        if (existing && existing.classList.contains('stack-row')) {
          existing.remove();
          return;
        }
        const stackRow = document.createElement('tr');
        stackRow.className = 'stack-row';
        const td = document.createElement('td');
        td.colSpan = 6;
        const pre = document.createElement('pre');
        pre.className = 'stack-trace';
        pre.textContent = err.stack;
        td.appendChild(pre);
        stackRow.appendChild(td);
        row.after(stackRow);
      });
    }

    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderLogTable(container, logs, columns, mapRow) {
  container.textContent = '';

  if (logs.length === 0) {
    container.textContent = 'Nessun log.';
    return;
  }

  const table = document.createElement('table');
  table.className = 'admin-table';

  const thead = document.createElement('thead');
  const hRow = document.createElement('tr');
  for (const col of columns) {
    hRow.appendChild(Object.assign(document.createElement('th'), { textContent: col }));
  }
  thead.appendChild(hRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const log of logs) {
    const row = document.createElement('tr');
    const cells = mapRow(log);
    for (const cell of cells) {
      row.appendChild(Object.assign(document.createElement('td'), { textContent: cell }));
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}
