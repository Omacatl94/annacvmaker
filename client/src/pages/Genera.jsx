import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { t } from '../strings';
import { useAuth } from '../hooks/useAuth';
import ProfileSummary from '../cv/ProfileSummary';
import Generator from '../cv/Generator';
import Editor from '../cv/Editor';
import Preview from '../cv/Preview';
import ExportButtons from '../cv/ExportButtons';
import ATSPanel from '../cv/ATSPanel';
import CoverLetter from '../cv/CoverLetter';

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

function loadProfileIntoForm(profile) {
  const d = profile.data || profile;
  return {
    id: profile.id,
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

function hasRealData(formData) {
  return (
    formData.experiences &&
    formData.experiences.length > 0 &&
    formData.experiences.some((e) => e.role && e.role.trim() !== '')
  );
}

export default function Genera() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(() => defaultFormData(user));
  const [loaded, setLoaded] = useState(false);

  // Generation state
  const [style, setStyle] = useState('professional');
  const [lang, setLang] = useState('it');
  const [generated, setGenerated] = useState(null);
  const [jobDescription, setJobDescription] = useState('');

  // Load profile on mount
  useEffect(() => {
    if (user && !user.guest) {
      (async () => {
        try {
          const res = await api.getProfiles();
          const profiles = res.profiles || res || [];
          if (profiles.length > 0) {
            setProfile(loadProfileIntoForm(profiles[0]));
          }
        } catch { /* no profiles yet */ }
        setLoaded(true);
      })();
    } else {
      setLoaded(true);
    }
  }, [user]);

  // Auto-save generated CV for registered users
  const autoSaveGenerated = useCallback(async (prof, data, jd) => {
    if (!user || user.guest) return;
    if (!prof.id) {
      console.warn('[autoSave] Profilo senza ID, salvataggio saltato');
      return;
    }
    try {
      await api.saveGenerated({
        profile_id: prof.id,
        job_description: jd || '',
        target_role: data.target_role || data.targetRole || data.roleTitle || '',
        target_company: data.target_company || data.targetCompany || data.companyName || '',
        language: lang,
        style,
        generated_data: { ...data, _profile: prof },
        ats_classic: data.ats_classic || null,
        ats_smart: data.ats_smart || null,
      });
    } catch (err) {
      console.error('[autoSave] Errore salvataggio candidatura:', err.message);
    }
  }, [user, lang, style]);

  const handleGenerated = useCallback((result, jd, oneTapLang) => {
    setGenerated(result);
    setJobDescription(jd);
    if (oneTapLang) setLang(oneTapLang);
    autoSaveGenerated(profile, result, jd);
  }, [profile, autoSaveGenerated]);

  const handleEditorUpdate = useCallback((updatedData) => {
    setGenerated(updatedData);
  }, []);

  const handleOptimized = useCallback((newData) => {
    setGenerated(newData);
  }, []);

  const handleNewGeneration = useCallback(() => {
    setGenerated(null);
    setJobDescription('');
  }, []);

  if (!loaded) {
    return <main className="dashboard-main"><div>{t('common.loading')}</div></main>;
  }

  // If no profile data, prompt to fill it
  if (!hasRealData(profile)) {
    return (
      <main className="dashboard-main">
        <div className="empty-profile-prompt card">
          <h3>Compila prima il tuo CV</h3>
          <p>Per generare un CV ottimizzato, devi prima inserire le tue esperienze e competenze.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>
            Vai a Il mio CV
          </button>
        </div>
      </main>
    );
  }

  // Post-generation view
  if (generated) {
    return (
      <main className="dashboard-main">
        <button
          className="btn-secondary"
          style={{ marginBottom: 16 }}
          onClick={handleNewGeneration}
        >
          &larr; Nuova generazione
        </button>

        {/* Guest registration prompt */}
        {user?.guest && (
          <div className="register-prompt card">
            <strong>Vuoi salvare le candidature e ottenere CV extra?</strong>
            <p>Registrati per tracciare i CV generati, accedere al link referral e sbloccare generazioni bonus.</p>
            <button
              className="btn-primary btn-sm"
              onClick={() => { window.location.href = '/api/auth/google'; }}
            >
              Registrati gratis
            </button>
          </div>
        )}

        {/* Editor toolbar */}
        <Editor generated={generated} onUpdate={handleEditorUpdate} />

        {/* CV Preview */}
        <div className="cv-preview-wrapper">
          <Preview profile={profile} data={generated} style={style} lang={lang} />
        </div>

        {/* Export buttons */}
        <ExportButtons profile={profile} style={style} lang={lang} generated={generated} />

        {/* ATS Panel */}
        <ATSPanel
          profile={profile}
          jobDescription={jobDescription}
          generated={generated}
          style={style}
          lang={lang}
          onOptimized={handleOptimized}
        />

        {/* Cover Letter */}
        <CoverLetter
          profile={profile}
          generated={generated}
          jobDescription={jobDescription}
          lang={lang}
        />
      </main>
    );
  }

  // Pre-generation view
  return (
    <main className="dashboard-main">
      <ProfileSummary formData={profile} />

      <Generator
        profile={profile}
        style={style}
        lang={lang}
        onStyleChange={setStyle}
        onLangChange={setLang}
        onJobDescription={setJobDescription}
        onGenerated={handleGenerated}
      />
    </main>
  );
}
