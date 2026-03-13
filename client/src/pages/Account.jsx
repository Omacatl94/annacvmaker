import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { t } from '../strings';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';

export default function Account() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="account-page">
      <MasterData user={user} setUser={setUser} />
      <Preferences user={user} setUser={setUser} />
      <ProfilesList />
      <InviteSection />
      <AccountInfo user={user} navigate={navigate} />
    </div>
  );
}

// -- Feedback helper component
function Feedback({ message, isError }) {
  if (!message) return null;
  return (
    <div className={`account-feedback ${isError ? 'error' : 'success'}`}>
      {message}
    </div>
  );
}

function useFeedback() {
  const [fb, setFb] = useState(null);
  const show = useCallback((message, isError) => {
    setFb({ message, isError });
    setTimeout(() => setFb(null), 3000);
  }, []);
  return [fb, show];
}

// -- Master Data
function MasterData({ user, setUser }) {
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [location, setLocation] = useState(user?.location || '');
  const [saving, setSaving] = useState(false);
  const [fb, showFb] = useFeedback();

  const handleSave = async () => {
    setSaving(true);
    try {
      const { user: updated } = await api.updateMe({
        name: name.trim(),
        phone: phone.trim(),
        location: location.trim(),
      });
      setUser((prev) => ({ ...prev, ...updated }));
      showFb('Salvato.', false);
    } catch (err) {
      showFb('Errore: ' + err.message, true);
    }
    setSaving(false);
  };

  return (
    <div className="account-section card">
      <h2>I tuoi dati</h2>
      <small className="account-hint">
        Questi dati vengono usati come base per ogni nuovo profilo CV.
      </small>
      <div className="account-form">
        <div className="form-group">
          <label>Nome</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
        </div>
        <div className="form-group">
          <label>Telefono</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Localit&agrave;</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      <div className="account-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Salvataggio...' : 'Salva modifiche'}
        </button>
        <Feedback {...fb} />
      </div>
    </div>
  );
}

// -- Preferences
function Preferences({ user, setUser }) {
  const prefs = user?.preferences || {};
  const [lang, setLang] = useState(prefs.defaultLanguage || 'it');
  const [style, setStyle] = useState(prefs.defaultStyle || 'professional');
  const [saving, setSaving] = useState(false);
  const [fb, showFb] = useFeedback();

  const handleSave = async () => {
    setSaving(true);
    try {
      const { user: updated } = await api.updateMe({
        preferences: { defaultLanguage: lang, defaultStyle: style },
      });
      setUser((prev) => ({ ...prev, preferences: updated.preferences }));
      showFb('Preferenze aggiornate.', false);
    } catch (err) {
      showFb('Errore: ' + err.message, true);
    }
    setSaving(false);
  };

  return (
    <div className="account-section card">
      <h2>Preferenze</h2>
      <div className="account-form">
        <div className="form-group">
          <label>Lingua CV default</label>
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="form-group">
          <label>Stile CV default</label>
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="professional">Professional</option>
            <option value="modern">Modern</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>
      </div>
      <div className="account-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>
          Salva preferenze
        </button>
        <Feedback {...fb} />
      </div>
    </div>
  );
}

// -- Profiles List
function ProfilesList() {
  const [profiles, setProfiles] = useState([]);
  const [genCounts, setGenCounts] = useState({});
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [profResult, generated] = await Promise.all([
          api.getProfiles().then((r) => r.profiles || r || []),
          api.getGenerated(),
        ]);
        if (cancelled) return;
        setProfiles(profResult);
        const counts = {};
        for (const g of generated) {
          counts[g.profile_id] = (counts[g.profile_id] || 0) + 1;
        }
        setGenCounts(counts);
      } catch {
        /* empty */
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!loaded) return null;

  return (
    <div className="account-section card">
      <h2>I tuoi profili CV</h2>
      {profiles.length === 0 ? (
        <p className="account-empty">
          Nessun profilo ancora. Vai su &quot;Genera CV&quot; per crearne uno.
        </p>
      ) : (
        <>
          <div className="profiles-list">
            {profiles.map((p) => {
              const n = genCounts[p.id] || 0;
              return (
                <div className="profile-item" key={p.id}>
                  <div className="profile-item-info">
                    <strong>{p.label || 'CV Principale'}</strong>
                    <span className="profile-gen-count">
                      {n} CV generat{n === 1 ? 'o' : 'i'}
                    </span>
                  </div>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => navigate('/genera')}
                  >
                    Modifica
                  </button>
                </div>
              );
            })}
          </div>
          <small className="account-hint">
            Puoi modificarli dal tab &quot;Genera CV&quot;.
          </small>
        </>
      )}
    </div>
  );
}

// -- Invite Section
function InviteSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getInviteStats()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="account-section card invite-section">
      <h2>{t('invite.title')}</h2>
      <small className="account-hint">{t('invite.subtitle')}</small>
      {loading && <p className="account-empty">Caricamento...</p>}
      {error && <p className="account-empty">Errore nel caricamento.</p>}
      {!loading && !error && data && <InviteContent data={data} />}
    </div>
  );
}

// ── Raccoon Communiqués ──
// Each invite code maps to a unique message, like an Anonymous leak

const COMMUNIQUES = [
  'Sapevi che il 75% dei CV viene scartato da un algoritmo prima che un umano lo veda? Io uso questo tool: incollo l\'annuncio e mi genera un CV che passa quei filtri. Ti mando l\'invito, provalo.',
  'Ho trovato un tool che ti fa il CV su misura per ogni annuncio in 30 secondi. Incolli la job description e lui adatta tutto. Lo sto usando per le mie candidature, ti giro l\'accesso.',
  'Ti giro l\'invito a JobHacker. \u00C8 un generatore di CV che legge l\'annuncio e ottimizza il tuo profilo per passare i filtri automatici delle aziende. A me ha svoltato, provalo.',
  'Sai quei CV che mandi e non ti risponde mai nessuno? Spesso il problema \u00E8 che un software li scarta prima che un recruiter li veda. Questo tool sistema la cosa. Ti mando l\'invito.',
  'Un recruiter guarda il tuo CV per 7 secondi. Sette. Questo tool mette le cose giuste nei posti giusti per quei 7 secondi. Lo uso io, ti mando l\'accesso.',
  'Ti passo l\'invito a un tool che uso per candidarmi. Incolli l\'annuncio, lui analizza cosa cercano e ti genera un CV mirato. Fa anche la cover letter. Gratis con l\'invito.',
  'Ho scoperto questo tool per i CV. La cosa figa \u00E8 che prima di generare il CV ti dice quanto sei compatibile con l\'annuncio, cos\u00EC sai subito se vale la pena candidarti. Ti giro l\'accesso.',
  'Se stai cercando lavoro (o pensi di farlo), ti mando l\'invito a JobHacker. Genera CV ottimizzati per ogni annuncio. Io ci ho fatto tutte le ultime candidature.',
  'Ogni annuncio ha le sue keyword e il suo formato ideale. Questo tool le legge dall\'annuncio e le mette nel CV al posto giusto. Non \u00E8 magia, \u00E8 AI. Ti mando il link.',
  'Ti giro un invito per JobHacker. In pratica: incolli un annuncio di lavoro, lui prende il tuo profilo e genera un CV su misura per quella posizione. Funziona bene, provalo.',
  'Mandare lo stesso CV a 50 aziende non funziona. Questo tool ti fa un CV diverso per ogni annuncio, ottimizzato per i filtri. Lo uso da un po\', te lo consiglio. Ecco l\'invito.',
  'Se ti interessa, ti passo l\'accesso a JobHacker. \u00C8 un tool AI che genera CV mirati: analizzi l\'annuncio, vedi la compatibilit\u00E0 col tuo profilo, e generi il CV in un click.',
];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getCommunique(code) {
  return COMMUNIQUES[hashCode(code) % COMMUNIQUES.length];
}

function buildShareMessage(code) {
  const message = getCommunique(code);
  const link = `https://jobhacker.it/?invite=${code}`;
  return `${message}\n\n${link}\n\n\uD83E\uDD9D`;
}

function InviteContent({ data }) {
  const [copiedCode, setCopiedCode] = useState(null);
  const [expandedCode, setExpandedCode] = useState(null);

  if (!data.codes || data.codes.length === 0) {
    return <p className="account-empty">{t('invite.noInvites')}</p>;
  }

  const progressFn = t('invite.progress');
  const progressText = typeof progressFn === 'function'
    ? progressFn(data.activated, data.maxTotal)
    : `${data.activated}/${data.maxTotal}`;

  return (
    <>
      <div className="invite-progress-wrap">
        <div className="invite-progress-bar">
          <div
            className="invite-progress-fill"
            style={{ width: `${(data.activated / data.maxTotal) * 100}%` }}
          />
        </div>
        <span className="invite-progress-text">{progressText}</span>
      </div>

      <div className="invite-list">
        {data.codes.map((code) => {
          const shareMessage = buildShareMessage(code.code);
          const communiqueText = getCommunique(code.code);
          const isExpanded = expandedCode === code.code;

          return (
            <div className={`invite-card invite-${code.status}`} key={code.code}>
              <span className="invite-code">{code.code}</span>

              {code.status === 'available' && (
                <>
                  <span className="invite-status">{t('invite.available')}</span>

                  {/* Communiqué preview */}
                  <div
                    className="communique-preview"
                    onClick={() => setExpandedCode(isExpanded ? null : code.code)}
                  >
                    <span className="communique-raccoon">{'\uD83E\uDD9D'}</span>
                    <span className="communique-snippet">
                      {isExpanded ? communiqueText : communiqueText.slice(0, 60) + '...'}
                    </span>
                    <span className="communique-toggle">{isExpanded ? '\u25B2' : '\u25BC'}</span>
                  </div>

                  <div className="invite-actions">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary btn-sm"
                    >
                      {t('invite.whatsapp')}
                    </a>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(shareMessage).then(() => {
                          setCopiedCode(code.code);
                          setTimeout(() => setCopiedCode(null), 2000);
                        });
                      }}
                    >
                      {copiedCode === code.code ? t('invite.copied') : t('invite.copyLink')}
                    </button>
                  </div>
                </>
              )}

              {code.status === 'claimed' && (
                <>
                  <span className="invite-invitee">
                    {code.inviteeName || code.inviteeEmail || '...'}
                  </span>
                  <span className="invite-status pending">{t('invite.claimed')}</span>
                </>
              )}

              {code.status === 'activated' && (
                <>
                  <span className="invite-invitee">
                    {code.inviteeName || code.inviteeEmail || '...'}
                  </span>
                  <span className="invite-status active">{t('invite.activated')}</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {data.creditsEarned > 0 && (
        <div className="invite-earned">
          {data.creditsEarned} crediti guadagnati dagli inviti
        </div>
      )}
    </>
  );
}

// -- Account Info + Danger Zone
function AccountInfo({ user, navigate }) {
  const [exporting, setExporting] = useState(false);
  const [fb, showFb] = useFeedback();

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await api.exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jobhacker-data-export.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    } catch (err) {
      showFb('Errore: ' + err.message, true);
    }
    setExporting(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Sicuro? Tutti i profili e le candidature vengono eliminati per sempre.')) return;
    if (!window.confirm('Ultima conferma. Non si torna indietro.')) return;
    try {
      await api.deleteMe();
      navigate('/');
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  const memberDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '\u2014';

  return (
    <div className="account-section card">
      <h2>Account</h2>
      <div className="account-info-grid">
        <div className="account-providers">
          <span>Collegato con: </span>
          <span className={`provider-badge ${user?.googleLinked ? 'linked' : 'unlinked'}`}>
            <Icon name={user?.googleLinked ? 'check' : 'x'} size={14} /> Google
          </span>
          <span className={`provider-badge ${user?.linkedinLinked ? 'linked' : 'unlinked'}`}>
            <Icon name={user?.linkedinLinked ? 'check' : 'x'} size={14} /> LinkedIn
          </span>
        </div>
        <div className="account-since">Membro dal {memberDate}</div>
      </div>

      <div className="account-actions" style={{ marginTop: 16 }}>
        <button className="btn-secondary" disabled={exporting} onClick={handleExport}>
          {exporting ? 'Preparazione...' : 'Scarica i miei dati'}
        </button>
        <small className="account-hint">
          Scarica tutti i tuoi dati in formato JSON (GDPR Art. 20).
        </small>
        <Feedback {...fb} />
      </div>

      <div className="account-danger">
        <button className="btn-danger" onClick={handleDelete}>
          Elimina account
        </button>
      </div>
    </div>
  );
}
