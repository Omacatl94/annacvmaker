import { api } from './api.js';
import { getUser, setUser, navigate } from './app.js';
import { icon } from './icons.js';
import { t } from './strings.js';

export async function renderAccount(container) {
  container.textContent = '';

  const user = getUser();
  const wrapper = document.createElement('div');
  wrapper.className = 'account-page';

  // 1. Master data
  wrapper.appendChild(renderMasterData(user));

  // 2. Preferences
  wrapper.appendChild(renderPreferences(user));

  // 3. My profiles
  wrapper.appendChild(await renderProfilesList());

  // 4. Invites
  wrapper.appendChild(renderInviteSection());

  // 5. Account info
  wrapper.appendChild(renderAccountInfo(user));

  container.appendChild(wrapper);
}

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------
function renderMasterData(user) {
  const section = document.createElement('div');
  section.className = 'account-section card';

  const h2 = document.createElement('h2');
  h2.textContent = 'I tuoi dati';
  section.appendChild(h2);

  const hint = document.createElement('small');
  hint.className = 'account-hint';
  hint.textContent = 'Questi dati vengono usati come base per ogni nuovo profilo CV.';
  section.appendChild(hint);

  const form = document.createElement('div');
  form.className = 'account-form';

  const fields = [
    { key: 'name', label: 'Nome', type: 'text', value: user.name || '' },
    { key: 'email', label: 'Email', type: 'email', value: user.email || '', disabled: true },
    { key: 'phone', label: 'Telefono', type: 'tel', value: user.phone || '' },
    { key: 'location', label: 'Località', type: 'text', value: user.location || '' },
  ];

  const inputs = {};

  for (const f of fields) {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = f.label;
    group.appendChild(label);

    const input = document.createElement('input');
    input.type = f.type;
    input.value = f.value;
    if (f.disabled) {
      input.disabled = true;
      input.style.opacity = '0.6';
    }
    group.appendChild(input);
    inputs[f.key] = input;

    form.appendChild(group);
  }

  section.appendChild(form);

  const actions = document.createElement('div');
  actions.className = 'account-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Salva modifiche';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvataggio...';
    try {
      const { user: updated } = await api.updateMe({
        name: inputs.name.value.trim(),
        phone: inputs.phone.value.trim(),
        location: inputs.location.value.trim(),
      });
      setUser({ ...getUser(), ...updated });
      showFeedback(actions, 'Salvato.', false);
    } catch (err) {
      showFeedback(actions, 'Errore: ' + err.message, true);
    }
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salva modifiche';
  });
  actions.appendChild(saveBtn);

  section.appendChild(actions);
  return section;
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------
function renderPreferences(user) {
  const section = document.createElement('div');
  section.className = 'account-section card';

  const h2 = document.createElement('h2');
  h2.textContent = 'Preferenze';
  section.appendChild(h2);

  const form = document.createElement('div');
  form.className = 'account-form';

  const prefs = user.preferences || {};

  // Language
  const langGroup = document.createElement('div');
  langGroup.className = 'form-group';
  const langLabel = document.createElement('label');
  langLabel.textContent = 'Lingua CV default';
  langGroup.appendChild(langLabel);
  const langSelect = document.createElement('select');
  const langOpts = [
    { value: 'it', text: 'Italiano' },
    { value: 'en', text: 'English' },
  ];
  for (const o of langOpts) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.text;
    langSelect.appendChild(opt);
  }
  langSelect.value = prefs.defaultLanguage || 'it';
  langGroup.appendChild(langSelect);
  form.appendChild(langGroup);

  // Style
  const styleGroup = document.createElement('div');
  styleGroup.className = 'form-group';
  const styleLabel = document.createElement('label');
  styleLabel.textContent = 'Stile CV default';
  styleGroup.appendChild(styleLabel);
  const styleSelect = document.createElement('select');
  const styleOpts = [
    { value: 'professional', text: 'Professional' },
    { value: 'modern', text: 'Modern' },
    { value: 'minimal', text: 'Minimal' },
  ];
  for (const o of styleOpts) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.text;
    styleSelect.appendChild(opt);
  }
  styleSelect.value = prefs.defaultStyle || 'professional';
  styleGroup.appendChild(styleSelect);
  form.appendChild(styleGroup);

  section.appendChild(form);

  const actions = document.createElement('div');
  actions.className = 'account-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Salva preferenze';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      const { user: updated } = await api.updateMe({
        preferences: {
          defaultLanguage: langSelect.value,
          defaultStyle: styleSelect.value,
        },
      });
      setUser({ ...getUser(), preferences: updated.preferences });
      showFeedback(actions, 'Preferenze aggiornate.', false);
    } catch (err) {
      showFeedback(actions, 'Errore: ' + err.message, true);
    }
    saveBtn.disabled = false;
  });
  actions.appendChild(saveBtn);
  section.appendChild(actions);

  return section;
}

// ---------------------------------------------------------------------------
// Profiles list
// ---------------------------------------------------------------------------
async function renderProfilesList() {
  const section = document.createElement('div');
  section.className = 'account-section card';

  const h2 = document.createElement('h2');
  h2.textContent = 'I tuoi profili CV';
  section.appendChild(h2);

  let profiles = [];
  let generated = [];
  try {
    [profiles, generated] = await Promise.all([
      api.getProfiles().then(r => r.profiles || r || []),
      api.getGenerated(),
    ]);
  } catch { /* empty */ }

  if (profiles.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'account-empty';
    empty.textContent = 'Nessun profilo ancora. Vai su "Genera CV" per crearne uno.';
    section.appendChild(empty);
    return section;
  }

  // Count generations per profile
  const genCounts = {};
  for (const g of generated) {
    genCounts[g.profile_id] = (genCounts[g.profile_id] || 0) + 1;
  }

  const list = document.createElement('div');
  list.className = 'profiles-list';

  for (const p of profiles) {
    const item = document.createElement('div');
    item.className = 'profile-item';

    const info = document.createElement('div');
    info.className = 'profile-item-info';

    const label = document.createElement('strong');
    label.textContent = p.label || 'CV Principale';
    info.appendChild(label);

    const count = document.createElement('span');
    const n = genCounts[p.id] || 0;
    count.textContent = `${n} CV generat${n === 1 ? 'o' : 'i'}`;
    count.className = 'profile-gen-count';
    info.appendChild(count);

    item.appendChild(info);

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-secondary btn-sm';
    editBtn.textContent = 'Modifica';
    editBtn.addEventListener('click', () => navigate('genera'));
    item.appendChild(editBtn);

    list.appendChild(item);
  }

  section.appendChild(list);

  const hint = document.createElement('small');
  hint.className = 'account-hint';
  hint.textContent = 'Puoi modificarli dal tab "Genera CV".';
  section.appendChild(hint);

  return section;
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------
function renderInviteSection() {
  const section = document.createElement('div');
  section.className = 'account-section card invite-section';

  const h2 = document.createElement('h2');
  h2.textContent = t('invite.title');
  section.appendChild(h2);

  const hint = document.createElement('small');
  hint.className = 'account-hint';
  hint.textContent = t('invite.subtitle');
  section.appendChild(hint);

  const loading = document.createElement('p');
  loading.className = 'account-empty';
  loading.textContent = 'Caricamento...';
  section.appendChild(loading);

  api.getInviteStats().then(data => {
    loading.remove();

    if (!data.codes || data.codes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'account-empty';
      empty.textContent = t('invite.noInvites');
      section.appendChild(empty);
      return;
    }

    // Progress bar
    const progressWrap = document.createElement('div');
    progressWrap.className = 'invite-progress-wrap';

    const progressBar = document.createElement('div');
    progressBar.className = 'invite-progress-bar';
    const progressFill = document.createElement('div');
    progressFill.className = 'invite-progress-fill';
    progressFill.style.width = `${(data.activated / data.maxTotal) * 100}%`;
    progressBar.appendChild(progressFill);
    progressWrap.appendChild(progressBar);

    const progressText = document.createElement('span');
    progressText.className = 'invite-progress-text';
    progressText.textContent = t('invite.progress')(data.activated, data.maxTotal);
    progressWrap.appendChild(progressText);

    section.appendChild(progressWrap);

    // Invite code cards
    const list = document.createElement('div');
    list.className = 'invite-list';

    for (const code of data.codes) {
      const card = document.createElement('div');
      card.className = `invite-card invite-${code.status}`;

      const codeEl = document.createElement('span');
      codeEl.className = 'invite-code';
      codeEl.textContent = code.code;
      card.appendChild(codeEl);

      if (code.status === 'available') {
        const statusEl = document.createElement('span');
        statusEl.className = 'invite-status';
        statusEl.textContent = t('invite.available');
        card.appendChild(statusEl);

        const actions = document.createElement('div');
        actions.className = 'invite-actions';

        const shareLink = `https://jobhacker.it/?invite=${code.code}`;
        const whatsappText = `${shareLink}\nmetti l'annuncio, esce il CV. passa i filtri.\n— JH 🦝`;
        const waBtn = document.createElement('a');
        waBtn.href = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
        waBtn.target = '_blank';
        waBtn.rel = 'noopener';
        waBtn.className = 'btn-primary btn-sm';
        waBtn.textContent = t('invite.whatsapp');
        actions.appendChild(waBtn);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-secondary btn-sm';
        copyBtn.textContent = t('invite.copyLink');
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(shareLink).then(() => {
            copyBtn.textContent = t('invite.copied');
            setTimeout(() => { copyBtn.textContent = t('invite.copyLink'); }, 2000);
          });
        });
        actions.appendChild(copyBtn);

        card.appendChild(actions);
      } else if (code.status === 'claimed') {
        const info = document.createElement('span');
        info.className = 'invite-invitee';
        info.textContent = code.inviteeName || code.inviteeEmail || '...';
        card.appendChild(info);

        const statusEl = document.createElement('span');
        statusEl.className = 'invite-status pending';
        statusEl.textContent = t('invite.claimed');
        card.appendChild(statusEl);
      } else if (code.status === 'activated') {
        const info = document.createElement('span');
        info.className = 'invite-invitee';
        info.textContent = code.inviteeName || code.inviteeEmail || '...';
        card.appendChild(info);

        const statusEl = document.createElement('span');
        statusEl.className = 'invite-status active';
        statusEl.textContent = t('invite.activated');
        card.appendChild(statusEl);
      }

      list.appendChild(card);
    }

    section.appendChild(list);

    // Credits earned
    if (data.creditsEarned > 0) {
      const earned = document.createElement('div');
      earned.className = 'invite-earned';
      earned.textContent = `${data.creditsEarned} crediti guadagnati dagli inviti`;
      section.appendChild(earned);
    }
  }).catch(() => {
    loading.textContent = 'Errore nel caricamento.';
  });

  return section;
}

// ---------------------------------------------------------------------------
// Account info + danger zone
// ---------------------------------------------------------------------------
function renderAccountInfo(user) {
  const section = document.createElement('div');
  section.className = 'account-section card';

  const h2 = document.createElement('h2');
  h2.textContent = 'Account';
  section.appendChild(h2);

  const info = document.createElement('div');
  info.className = 'account-info-grid';

  // OAuth providers
  const providers = document.createElement('div');
  providers.className = 'account-providers';

  const provLabel = document.createElement('span');
  provLabel.textContent = 'Collegato con: ';
  providers.appendChild(provLabel);

  const googleBadge = document.createElement('span');
  googleBadge.className = 'provider-badge ' + (user.googleLinked ? 'linked' : 'unlinked');
  googleBadge.appendChild(icon(user.googleLinked ? 'check' : 'x', { size: 14 }));
  googleBadge.appendChild(document.createTextNode(' Google'));
  providers.appendChild(googleBadge);

  const linkedinBadge = document.createElement('span');
  linkedinBadge.className = 'provider-badge ' + (user.linkedinLinked ? 'linked' : 'unlinked');
  linkedinBadge.appendChild(icon(user.linkedinLinked ? 'check' : 'x', { size: 14 }));
  linkedinBadge.appendChild(document.createTextNode(' LinkedIn'));
  providers.appendChild(linkedinBadge);

  info.appendChild(providers);

  // Member since
  const since = document.createElement('div');
  since.className = 'account-since';
  const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '\u2014';
  since.textContent = `Membro dal ${date}`;
  info.appendChild(since);

  section.appendChild(info);

  // Data export (GDPR)
  const exportSection = document.createElement('div');
  exportSection.className = 'account-actions';
  exportSection.style.marginTop = '16px';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn-secondary';
  exportBtn.textContent = 'Scarica i miei dati';
  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true;
    exportBtn.textContent = 'Preparazione...';
    try {
      const data = await api.exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jobhacker-data-export.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    } catch (err) {
      showFeedback(exportSection, 'Errore: ' + err.message, true);
    }
    exportBtn.disabled = false;
    exportBtn.textContent = 'Scarica i miei dati';
  });
  exportSection.appendChild(exportBtn);

  const exportHint = document.createElement('small');
  exportHint.className = 'account-hint';
  exportHint.textContent = 'Scarica tutti i tuoi dati in formato JSON (GDPR Art. 20).';
  exportSection.appendChild(exportHint);

  section.appendChild(exportSection);

  // Danger zone
  const danger = document.createElement('div');
  danger.className = 'account-danger';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-danger';
  deleteBtn.textContent = 'Elimina account';
  deleteBtn.addEventListener('click', () => {
    if (!confirm('Sicuro? Tutti i profili e le candidature vengono eliminati per sempre.')) return;
    if (!confirm('Ultima conferma. Non si torna indietro.')) return;
    api.deleteMe().then(() => {
      navigate();
    }).catch(err => {
      alert('Errore: ' + err.message);
    });
  });
  danger.appendChild(deleteBtn);
  section.appendChild(danger);

  return section;
}

// ---------------------------------------------------------------------------
// Feedback helper
// ---------------------------------------------------------------------------
function showFeedback(container, message, isError) {
  let el = container.querySelector('.account-feedback');
  if (!el) {
    el = document.createElement('div');
    el.className = 'account-feedback';
    container.appendChild(el);
  }
  el.textContent = message;
  el.className = 'account-feedback ' + (isError ? 'error' : 'success');
  setTimeout(() => el.remove(), 3000);
}
