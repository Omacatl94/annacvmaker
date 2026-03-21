import Icon from '../components/Icon';

export default function Preview({ profile, data, style, lang }) {
  if (!data || !profile) return null;

  const isIt = lang === 'it';
  const labels = isIt
    ? {
        summary: 'Profilo Professionale',
        competencies: 'Competenze Chiave',
        experience: 'Esperienza Professionale',
        education: 'Formazione',
        additional: 'Lingue e Strumenti',
      }
    : {
        summary: 'Professional Summary',
        competencies: 'Core Competencies',
        experience: 'Professional Experience',
        education: 'Education',
        additional: 'Languages & Tools',
      };

  return (
    <div id="cv-container" data-theme={style || 'professional'}>
      {/* === HEADER === */}
      <div className="cv-header">
        {profile.photo_path && (
          <img className="cv-photo" src={profile.photo_path} alt={profile.personal?.name} />
        )}
        <div className="cv-header-text">
          <div className="cv-name">{profile.personal?.name}</div>
          <div className="cv-headline" data-field="headline">
            {data.headline}
          </div>
          <div className="cv-contacts">
            {profile.personal?.email && (
              <span>
                <Icon name="mail" size={14} /> {profile.personal.email}
              </span>
            )}
            {profile.personal?.phone && (
              <span>
                <Icon name="phone" size={14} /> {profile.personal.phone}
              </span>
            )}
            {profile.personal?.location && (
              <span>
                <Icon name="map-pin" size={14} /> {profile.personal.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* === BODY === */}
      <div className="cv-body">
        {/* Summary */}
        <div className="cv-section">
          <div className="cv-section-title">{labels.summary}</div>
          <div className="cv-summary" data-field="summary">
            {data.summary}
          </div>
        </div>

        {/* Competencies */}
        {data.competencies?.length > 0 && (
          <div className="cv-section">
            <div className="cv-section-title">{labels.competencies}</div>
            <div className="cv-competencies">
              {data.competencies.map((comp, i) => (
                <span key={i} className="cv-badge" data-field={`comp-${i}`}>
                  {comp}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Experience */}
        <div className="cv-section">
          <div className="cv-section-title">{labels.experience}</div>
          {profile.experiences?.map((exp, i) => {
            // Skip if omitted by AI
            if (data.omittedExperiences?.some((o) => o.index === i)) return null;

            const adaptedBullets = data.experience?.[i]?.bullets || exp.bullets || [];

            return (
              <div key={i} className="cv-exp-item">
                <div className="cv-exp-header">
                  <span className="cv-exp-role">{exp.role}</span>
                  <span className="cv-exp-period">{exp.period}</span>
                </div>
                <div className="cv-exp-company">{exp.company}</div>
                <ul className="cv-exp-bullets">
                  {adaptedBullets.map((b, bi) => (
                    <li key={bi} data-field={`exp-${i}-${bi}`}>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Education */}
        <div className="cv-section">
          <div className="cv-section-title">{labels.education}</div>
          {profile.education?.map((edu, i) => (
            <div key={i} className="cv-edu-item">
              <div className="cv-edu-degree">{edu.degree}</div>
              <div className="cv-edu-school">
                {edu.school || ''}
                {edu.period ? ' | ' + edu.period : ''}
              </div>
              {edu.grade && <div className="cv-edu-detail">{edu.grade}</div>}
            </div>
          ))}
        </div>

        {/* Languages & Tools */}
        <div className="cv-section">
          <div className="cv-section-title">{labels.additional}</div>
          <div className="cv-inline-list">
            {profile.languages?.length > 0 && (
              <span>
                {profile.languages
                  .map((l) => l.language + ' (' + l.level + ')')
                  .join(' \u00B7 ')}
              </span>
            )}
            {data.skills && (
              <span data-field="skills"> | {data.skills}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
