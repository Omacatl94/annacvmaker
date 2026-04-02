import { useState, useCallback } from 'react';
import Icon from './Icon';

const SCREENS = [
  {
    icon: 'shield-ban',
    title: "Cos'\u00E8 un ATS?",
    bullets: [
      'Il 75% dei CV viene filtrato prima che un umano li veda.',
      'ATS = software che le aziende usano per gestire le candidature.',
      "Non \u00E8 cattiveria: ricevono 200+ CV per posizione.",
    ],
  },
  {
    icon: 'search',
    title: 'Come funziona',
    bullets: [
      "L'ATS cerca keyword specifiche nel tuo CV.",
      'Confronta il testo con la job description.',
      'Se non trova le parole giuste, ti scarta.',
      'Non importa quanto sei bravo \u2014 importa come lo scrivi.',
    ],
  },
  {
    icon: 'file-x',
    title: 'Perch\u00E9 il tuo CV viene scartato',
    bullets: [
      'Formato sbagliato (tabelle, colonne, Europass).',
      'Keyword mancanti ("gestione progetti" vs "project management").',
      'Troppo generico: stesso CV per ogni annuncio.',
    ],
  },
  {
    icon: 'check-circle',
    title: 'Come lo risolvi',
    bullets: [
      'Un CV per ogni annuncio (JobHacker lo fa in 2 minuti).',
      'Le keyword giuste al posto giusto.',
      'Formato pulito, sezioni standard.',
      'Score ATS per verificare prima di inviare.',
    ],
  },
  {
    icon: 'rocket',
    title: 'Cosa fa JobHacker per te',
    bullets: [
      "Estrae le keyword dall'annuncio.",
      'Genera il CV con le keyword incorporate.',
      "Verifica il punteggio ATS prima dell'invio.",
      "Tu controlli tutto \u2014 l'AI non inventa niente.",
    ],
    cta: true,
  },
];

export default function ATSEducation({ onDone }) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const screen = SCREENS[currentScreen];

  const handleComplete = useCallback(() => {
    localStorage.setItem('jh-ats-edu-done', '1');
    onDone?.();
  }, [onDone]);

  const handleSkip = useCallback(() => {
    localStorage.setItem('jh-ats-edu-done', '1');
    onDone?.();
  }, [onDone]);

  return (
    <div className="ats-edu-overlay">
      <div className="ats-edu-card">
        {/* Progress dots */}
        <div className="ats-edu-dots">
          {SCREENS.map((_, i) => (
            <span
              key={i}
              className={`ats-edu-dot${i === currentScreen ? ' active' : ''}`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="ats-edu-icon">
          <Icon name={screen.icon} size={48} />
        </div>

        {/* Title */}
        <h3 className="ats-edu-title">{screen.title}</h3>

        {/* Bullets */}
        <ul className="ats-edu-list">
          {screen.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>

        {/* Navigation */}
        <div className="ats-edu-nav">
          {currentScreen > 0 && (
            <button
              className="btn-secondary"
              onClick={() => setCurrentScreen((s) => s - 1)}
            >
              Indietro
            </button>
          )}

          {screen.cta ? (
            <button className="btn-primary" onClick={handleComplete}>
              Ho capito, proviamo
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => setCurrentScreen((s) => s + 1)}
            >
              Avanti
            </button>
          )}

          <button className="ats-edu-skip" onClick={handleSkip}>
            Salta
          </button>
        </div>
      </div>
    </div>
  );
}

export function shouldShowATSEducation() {
  return !localStorage.getItem('jh-ats-edu-done');
}
