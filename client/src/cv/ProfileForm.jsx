import { useState, useCallback } from 'react';
import { api } from '../api';
import { t } from '../strings';

// ── Sub-components ──

function FormInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        type={type}
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function FormSelect({ label, options, value, onChange }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt || t('common.selectDefault')}
          </option>
        ))}
      </select>
    </div>
  );
}

function PhotoUpload({ photoPath, onPhotoChange, profileId }) {
  const [feedback, setFeedback] = useState(null);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const res = await api.uploadPhoto(file);
      const path = res.path || res.url;
      onPhotoChange(path);

      if (profileId) {
        api.updateProfile(profileId, { photo_path: path }).catch(() => {});
        setFeedback({ text: 'Foto salvata.', error: false });
      } else {
        setFeedback({ text: 'Foto caricata. Salva il profilo per non perderla.', error: false });
      }
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ text: 'Errore upload foto: ' + err.message, error: true });
      setTimeout(() => setFeedback(null), 4000);
    }
  }, [onPhotoChange, profileId]);

  return (
    <section className="form-section card">
      <h2 className="section-title">{t('form.photoTitle')}</h2>
      <div className="photo-upload-zone" onClick={() => document.getElementById('photo-input')?.click()}>
        <div className={`photo-preview${!photoPath ? ' photo-preview--empty' : ''}`}>
          {photoPath ? (
            <>
              <img src={photoPath} alt="Foto profilo" />
              <span className="photo-placeholder">Sostituisci foto</span>
            </>
          ) : (
            <span className="photo-placeholder">{t('form.photoPlaceholder')}</span>
          )}
        </div>
        <input
          id="photo-input"
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
      {feedback && (
        <div className={`feedback-msg ${feedback.error ? 'feedback-error' : 'feedback-success'}`}>
          {feedback.text}
        </div>
      )}
    </section>
  );
}

function ExperiencesSection({ experiences, onChange }) {
  const updateExperience = (index, field, value) => {
    const updated = experiences.map((exp, i) =>
      i === index ? { ...exp, [field]: value } : exp
    );
    onChange(updated);
  };

  const updateBullet = (expIndex, bulletIndex, value) => {
    const updated = experiences.map((exp, i) => {
      if (i !== expIndex) return exp;
      const bullets = exp.bullets.map((b, bi) => (bi === bulletIndex ? value : b));
      return { ...exp, bullets };
    });
    onChange(updated);
  };

  const addBullet = (expIndex) => {
    const updated = experiences.map((exp, i) => {
      if (i !== expIndex) return exp;
      return { ...exp, bullets: [...exp.bullets, ''] };
    });
    onChange(updated);
  };

  const removeBullet = (expIndex, bulletIndex) => {
    const updated = experiences.map((exp, i) => {
      if (i !== expIndex) return exp;
      return { ...exp, bullets: exp.bullets.filter((_, bi) => bi !== bulletIndex) };
    });
    onChange(updated);
  };

  const addExperience = () => {
    onChange([...experiences, { role: '', company: '', period: '', bullets: [''] }]);
  };

  const removeExperience = (index) => {
    onChange(experiences.filter((_, i) => i !== index));
  };

  return (
    <section className="form-section card">
      <h2 className="section-title">{t('form.experiencesTitle')}</h2>

      {experiences.map((exp, i) => (
        <div key={i} className="dynamic-entry card">
          <div className="entry-header">
            <strong>Esperienza {i + 1}</strong>
            {experiences.length > 1 && (
              <button className="btn-danger-sm" onClick={() => removeExperience(i)}>
                {t('form.remove')}
              </button>
            )}
          </div>

          <div className="form-grid">
            <FormInput label="Ruolo" value={exp.role} onChange={(v) => updateExperience(i, 'role', v)} />
            <FormInput label="Azienda" value={exp.company} onChange={(v) => updateExperience(i, 'company', v)} />
            <FormInput label="Periodo" value={exp.period} onChange={(v) => updateExperience(i, 'period', v)} />
          </div>

          <label className="bullets-label">Punti salienti</label>
          <div className="bullets-container">
            {exp.bullets.map((bullet, bi) => (
              <div key={bi} className="bullet-row">
                <input
                  type="text"
                  value={bullet}
                  placeholder={t('form.bulletPlaceholder')}
                  onChange={(e) => updateBullet(i, bi, e.target.value)}
                />
                {exp.bullets.length > 1 && (
                  <button className="btn-danger-sm" title="Rimuovi punto" onClick={() => removeBullet(i, bi)}>
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button className="btn-secondary btn-sm" onClick={() => addBullet(i)}>
              {t('form.addBullet')}
            </button>
          </div>
        </div>
      ))}

      <button className="btn-secondary" style={{ marginTop: 8 }} onClick={addExperience}>
        {t('form.addExperience')}
      </button>
    </section>
  );
}

function EducationSection({ education, onChange }) {
  const updateEducation = (index, field, value) => {
    const updated = education.map((edu, i) =>
      i === index ? { ...edu, [field]: value } : edu
    );
    onChange(updated);
  };

  const addEducation = () => {
    onChange([...education, { degree: '', school: '', period: '', grade: '' }]);
  };

  const removeEducation = (index) => {
    onChange(education.filter((_, i) => i !== index));
  };

  return (
    <section className="form-section card">
      <h2 className="section-title">{t('form.educationTitle')}</h2>

      {education.map((edu, i) => (
        <div key={i} className="dynamic-entry card">
          <div className="entry-header">
            <strong>Formazione {i + 1}</strong>
            {education.length > 1 && (
              <button className="btn-danger-sm" onClick={() => removeEducation(i)}>
                {t('form.remove')}
              </button>
            )}
          </div>

          <div className="form-grid">
            <FormInput label="Titolo di studio" value={edu.degree} onChange={(v) => updateEducation(i, 'degree', v)} />
            <FormInput label="Istituto" value={edu.school} onChange={(v) => updateEducation(i, 'school', v)} />
            <FormInput label="Periodo" value={edu.period} onChange={(v) => updateEducation(i, 'period', v)} />
            <FormInput label="Voto" value={edu.grade} onChange={(v) => updateEducation(i, 'grade', v)} />
          </div>
        </div>
      ))}

      <button className="btn-secondary" style={{ marginTop: 8 }} onClick={addEducation}>
        {t('form.addEducation')}
      </button>
    </section>
  );
}

function SkillsSection({ skills, onChange }) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = inputValue.trim();
      if (val && !skills.includes(val)) {
        onChange([...skills, val]);
        setInputValue('');
      }
    }
  };

  const removeSkill = (index) => {
    onChange(skills.filter((_, i) => i !== index));
  };

  return (
    <section className="form-section card">
      <h2 className="section-title">{t('form.skillsTitle')}</h2>
      <div className="tags-container">
        {skills.map((skill, i) => (
          <span key={i} className="tag">
            <span>{skill}</span>
            <span className="tag-remove" onClick={() => removeSkill(i)}>&times;</span>
          </span>
        ))}
        <input
          type="text"
          className="tag-input"
          placeholder={t('form.skillPlaceholder')}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </section>
  );
}

function LanguagesSection({ languages, onChange }) {
  const levels = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Madrelingua'];

  const updateLanguage = (index, field, value) => {
    const updated = languages.map((lang, i) =>
      i === index ? { ...lang, [field]: value } : lang
    );
    onChange(updated);
  };

  const addLanguage = () => {
    onChange([...languages, { language: '', level: '' }]);
  };

  const removeLanguage = (index) => {
    onChange(languages.filter((_, i) => i !== index));
  };

  return (
    <section className="form-section card">
      <h2 className="section-title">{t('form.languagesTitle')}</h2>

      {languages.map((lang, i) => (
        <div key={i} className="dynamic-entry card">
          <div className="entry-header">
            <strong>Lingua {i + 1}</strong>
            {languages.length > 1 && (
              <button className="btn-danger-sm" onClick={() => removeLanguage(i)}>
                {t('form.remove')}
              </button>
            )}
          </div>

          <div className="form-grid">
            <FormInput label="Lingua" value={lang.language} onChange={(v) => updateLanguage(i, 'language', v)} />
            <FormSelect label="Livello" options={levels} value={lang.level} onChange={(v) => updateLanguage(i, 'level', v)} />
          </div>
        </div>
      ))}

      <button className="btn-secondary" style={{ marginTop: 8 }} onClick={addLanguage}>
        {t('form.addLanguage')}
      </button>
    </section>
  );
}

// ── Main Component ──

export default function ProfileForm({ formData, onChange, profileId }) {
  const updatePersonal = useCallback((field, value) => {
    onChange({
      ...formData,
      personal: { ...formData.personal, [field]: value },
    });
  }, [formData, onChange]);

  return (
    <>
      {/* Personal info */}
      <section className="form-section card">
        <h2 className="section-title">{t('form.personalTitle')}</h2>
        <div className="form-grid">
          <FormInput label="Nome completo" value={formData.personal.name} onChange={(v) => updatePersonal('name', v)} />
          <FormInput label="Email" value={formData.personal.email} onChange={(v) => updatePersonal('email', v)} type="email" />
          <FormInput label="Telefono" value={formData.personal.phone} onChange={(v) => updatePersonal('phone', v)} type="tel" />
          <FormInput label="Localita'" value={formData.personal.location} onChange={(v) => updatePersonal('location', v)} />
        </div>
      </section>

      {/* Photo */}
      <PhotoUpload
        photoPath={formData.photo_path}
        profileId={profileId}
        onPhotoChange={(path) => onChange({ ...formData, photo_path: path })}
      />

      {/* Experiences */}
      <ExperiencesSection
        experiences={formData.experiences}
        onChange={(experiences) => onChange({ ...formData, experiences })}
      />

      {/* Education */}
      <EducationSection
        education={formData.education}
        onChange={(education) => onChange({ ...formData, education })}
      />

      {/* Skills */}
      <SkillsSection
        skills={formData.skills}
        onChange={(skills) => onChange({ ...formData, skills })}
      />

      {/* Languages */}
      <LanguagesSection
        languages={formData.languages}
        onChange={(languages) => onChange({ ...formData, languages })}
      />
    </>
  );
}
