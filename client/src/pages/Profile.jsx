import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { t } from '../strings';
import { useAuth } from '../hooks/useAuth';
import UploadZone from '../components/UploadZone';
import ProfileForm from '../cv/ProfileForm';

function defaultFormData(user) {
  return {
    label: 'CV Principale',
    personal: {
      name: (user && !user.guest && user.name) || '',
      email: (user && !user.guest && user.email) || '',
      phone: (user && !user.guest && user.phone) || '',
      location: (user && !user.guest && user.location) || '',
    },
    photo_path: null,
    experiences: [{ role: '', company: '', period: '', bullets: [''] }],
    education: [{ degree: '', school: '', period: '', grade: '' }],
    skills: [],
    languages: [{ language: '', level: '' }],
  };
}

function hasRealData(formData) {
  return (
    formData.experiences &&
    formData.experiences.length > 0 &&
    formData.experiences.some((e) => e.role && e.role.trim() !== '')
  );
}

function applyParsedData(formData, parsedData) {
  const updated = { ...formData };
  if (parsedData.personal) {
    updated.personal = {
      name: parsedData.personal.name || '',
      email: parsedData.personal.email || '',
      phone: parsedData.personal.phone || '',
      location: parsedData.personal.location || '',
    };
  }
  if (parsedData.experiences?.length > 0) {
    updated.experiences = parsedData.experiences;
  }
  if (parsedData.education?.length > 0) {
    updated.education = parsedData.education;
  }
  if (parsedData.skills?.length > 0) {
    updated.skills = parsedData.skills;
  }
  if (parsedData.languages?.length > 0) {
    updated.languages = parsedData.languages;
  }
  return updated;
}

function loadProfileIntoForm(profile) {
  const d = profile.data || profile;
  return {
    label: d.label || profile.label || 'CV Principale',
    personal: { name: '', email: '', phone: '', location: '', ...(d.personal || {}) },
    photo_path: d.photo_path || null,
    experiences:
      Array.isArray(d.experiences) && d.experiences.length
        ? d.experiences.map((e) => ({
            role: e.role || '',
            company: e.company || '',
            period: e.period || '',
            bullets: Array.isArray(e.bullets) && e.bullets.length ? [...e.bullets] : [''],
          }))
        : [{ role: '', company: '', period: '', bullets: [''] }],
    education:
      Array.isArray(d.education) && d.education.length
        ? d.education.map((e) => ({
            degree: e.degree || '',
            school: e.school || '',
            period: e.period || '',
            grade: e.grade || '',
          }))
        : [{ degree: '', school: '', period: '', grade: '' }],
    skills: Array.isArray(d.skills) ? [...d.skills] : [],
    languages:
      Array.isArray(d.languages) && d.languages.length
        ? d.languages.map((l) => ({ language: l.language || '', level: l.level || '' }))
        : [{ language: '', level: '' }],
  };
}

export default function Profile() {
  const { user } = useAuth();
  const [formData, setFormData] = useState(() => defaultFormData(user));
  const [currentProfile, setCurrentProfile] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load profiles on mount
  useEffect(() => {
    if (user && !user.guest) {
      (async () => {
        try {
          const res = await api.getProfiles();
          const profiles = res.profiles || res || [];
          if (profiles.length > 0) {
            setCurrentProfile(profiles[0]);
            setFormData(loadProfileIntoForm(profiles[0]));
          }
        } catch { /* no profiles yet */ }
        setLoaded(true);
      })();
    } else {
      setLoaded(true);
    }
  }, [user]);

  const handleParsed = useCallback((parsedData) => {
    setFormData((prev) => applyParsedData(prev, parsedData));
    setShowUploadZone(false);
  }, []);

  const handleSave = useCallback(async () => {
    const data = JSON.parse(JSON.stringify(formData));
    try {
      const targetId = currentProfile?.id;
      let result;
      if (targetId) {
        result = await api.updateProfile(targetId, data);
      } else {
        result = await api.createProfile(data);
      }
      const savedProfile = result.profile || result;
      setCurrentProfile(savedProfile);
      setFeedback({ text: t('form.saved'), error: false });
    } catch (err) {
      setFeedback({ text: t('common.errorPrefix') + err.message, error: true });
    }
    setTimeout(() => setFeedback(null), 4000);
  }, [formData, currentProfile]);

  if (!loaded) {
    return <main className="dashboard-main"><div>{t('common.loading')}</div></main>;
  }

  const hasData = hasRealData(formData);

  return (
    <main className="dashboard-main">
      {/* Guest banner */}
      {user?.guest && (
        <div className="guest-banner card">
          <span>&#9888;</span>
          <span>{t('form.guestBanner')}</span>
          <button
            className="guest-banner-link"
            onClick={() => { window.location.href = '/api/auth/google'; }}
          >
            Accedi per non perderli
          </button>
        </div>
      )}

      <div className="cv-form-container">
        {/* Upload zone — adaptive */}
        {hasData ? (
          <div className="upload-compact card">
            <button
              className="btn-secondary"
              onClick={() => setShowUploadZone((prev) => !prev)}
            >
              Aggiorna dati da CV
            </button>
            {showUploadZone && <UploadZone onParsed={handleParsed} />}
          </div>
        ) : (
          <div className="upload-prominent card">
            <h3>Carica il tuo CV per iniziare</h3>
            <p className="upload-prominent-sub">
              L'AI legge il tuo CV e pre-compila tutti i campi. Puoi anche compilare manualmente.
            </p>
            <UploadZone onParsed={handleParsed} />
          </div>
        )}

        {/* Profile form */}
        <ProfileForm
          formData={formData}
          onChange={setFormData}
          profileId={currentProfile?.id}
        />

        {/* Save button */}
        <div className="form-actions">
          {user && !user.guest && (
            <button className="btn-primary" onClick={handleSave}>
              {t('form.save')}
            </button>
          )}
          {feedback && (
            <div className={`feedback-msg ${feedback.error ? 'feedback-error' : 'feedback-success'}`}>
              {feedback.text}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
