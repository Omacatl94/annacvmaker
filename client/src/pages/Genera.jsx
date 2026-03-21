import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { t } from '../strings';
import { useAuth } from '../hooks/useAuth';
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
  const [extractedKeywords, setExtractedKeywords] = useState(null);
  const [savedCvId, setSavedCvId] = useState(null);

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
      const saved = await api.saveGenerated({
        profile_id: prof.id,
        job_description: jd || '',
        target_role: data.roleTitle || '',
        target_company: data.companyName || '',
        language: lang,
        style,
        generated_data: { ...data, _profile: prof },
        location: prof.personal?.location || '',
      });
      if (saved?.id) setSavedCvId(saved.id);
    } catch (err) {
      console.error('[autoSave] Errore salvataggio candidatura:', err.message);
    }
  }, [user, lang, style]);

  const handleGenerated = useCallback((result, jd, oneTapLang, keywords) => {
    setGenerated(result);
    setJobDescription(jd);
    if (oneTapLang) setLang(oneTapLang);
    if (keywords) setExtractedKeywords({ keywords });
    autoSaveGenerated(profile, result, jd);
  }, [profile, autoSaveGenerated]);

  const handleEditorUpdate = useCallback((updatedData) => {
    setGenerated(updatedData);
  }, []);

  const handleOptimized = useCallback((newData) => {
    setGenerated(newData);
  }, []);

  const handleATSScored = useCallback(async (classic, smart) => {
    if (!savedCvId) return;
    try {
      await api.updateGenerated(savedCvId, { ats_classic: classic, ats_smart: smart });
    } catch (err) {
      console.error('[atsScore] Errore aggiornamento punteggio:', err.message);
    }
  }, [savedCvId]);

  const handleLetterGenerated = useCallback(async (letterData) => {
    if (!savedCvId) return;
    try {
      await api.updateGenerated(savedCvId, { cover_letter_data: letterData });
    } catch (err) {
      console.error('[coverLetter] Errore salvataggio lettera:', err.message);
    }
  }, [savedCvId]);

  const handleNewGeneration = useCallback(() => {
    setGenerated(null);
    setJobDescription('');
    setExtractedKeywords(null);
    setSavedCvId(null);
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
          onOptimized={handleOptimized}
          onScored={handleATSScored}
          extractedKeywords={extractedKeywords}
        />

        {/* Cover Letter */}
        <CoverLetter
          profile={profile}
          generated={generated}
          jobDescription={jobDescription}
          lang={lang}
          onLetterGenerated={handleLetterGenerated}
        />
      </main>
    );
  }

  // Pre-generation view
  return (
    <main className="dashboard-main">
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
