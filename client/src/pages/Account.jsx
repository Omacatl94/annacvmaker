import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';

export default function Account() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [hash]);

  return (
    <div className="account-page">
      <MasterData user={user} setUser={setUser} />
      <Preferences user={user} setUser={setUser} />
      <ProfilesList />
      <AccountInfo user={user} navigate={navigate} logout={logout} />
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

// -- Account Info + Danger Zone
function AccountInfo({ user, navigate, logout }) {
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

      {user?.role === 'admin' && (
        <div style={{ marginTop: 16 }}>
          <button className="btn-secondary" onClick={() => navigate('/admin')}>
            Pannello Admin
          </button>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn-secondary" onClick={async () => { await logout(); navigate('/'); }}>
          Esci
        </button>
      </div>

      {user?.role !== 'admin' && (
        <div className="account-danger">
          <button className="btn-danger" onClick={handleDelete}>
            Elimina account
          </button>
        </div>
      )}
    </div>
  );
}
