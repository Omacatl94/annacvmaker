import { icon } from './icons.js';
import { track } from './analytics.js';

const SCREENS = [
  {
    icon: 'shield-ban',
    title: "Cos'è un ATS?",
    bullets: [
      'Il 75% dei CV viene filtrato prima che un umano li veda.',
      'ATS = software che le aziende usano per gestire le candidature.',
      "Non è cattiveria: ricevono 200+ CV per posizione.",
    ],
  },
  {
    icon: 'search',
    title: 'Come funziona',
    bullets: [
      "L'ATS cerca keyword specifiche nel tuo CV.",
      'Confronta il testo con la job description.',
      'Se non trova le parole giuste, ti scarta.',
      'Non importa quanto sei bravo — importa come lo scrivi.',
    ],
  },
  {
    icon: 'file-x',
    title: 'Perché il tuo CV viene scartato',
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
      "Tu controlli tutto — l'AI non inventa niente.",
    ],
    cta: true,
  },
];

export function showATSEducation(onDone) {
  let currentScreen = 0;

  const overlay = document.createElement('div');
  overlay.className = 'ats-edu-overlay';

  const card = document.createElement('div');
  card.className = 'ats-edu-card';
  overlay.appendChild(card);

  function render() {
    card.textContent = '';
    const screen = SCREENS[currentScreen];

    // Progress dots
    const dots = document.createElement('div');
    dots.className = 'ats-edu-dots';
    SCREENS.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'ats-edu-dot' + (i === currentScreen ? ' active' : '');
      dots.appendChild(dot);
    });
    card.appendChild(dots);

    // Icon
    const iconWrap = document.createElement('div');
    iconWrap.className = 'ats-edu-icon';
    iconWrap.appendChild(icon(screen.icon, { size: 48 }));
    card.appendChild(iconWrap);

    // Title
    const title = document.createElement('h3');
    title.className = 'ats-edu-title';
    title.textContent = screen.title;
    card.appendChild(title);

    // Bullets
    const list = document.createElement('ul');
    list.className = 'ats-edu-list';
    screen.bullets.forEach((b) => {
      const li = document.createElement('li');
      li.textContent = b;
      list.appendChild(li);
    });
    card.appendChild(list);

    // Navigation
    const nav = document.createElement('div');
    nav.className = 'ats-edu-nav';

    if (currentScreen > 0) {
      const backBtn = document.createElement('button');
      backBtn.className = 'btn-secondary';
      backBtn.textContent = 'Indietro';
      backBtn.addEventListener('click', () => {
        currentScreen--;
        render();
      });
      nav.appendChild(backBtn);
    }

    if (screen.cta) {
      const ctaBtn = document.createElement('button');
      ctaBtn.className = 'btn-primary';
      ctaBtn.textContent = 'Ho capito, proviamo';
      ctaBtn.addEventListener('click', () => {
        localStorage.setItem('jh-ats-edu-done', '1');
        track('ats_education_completed');
        overlay.remove();
        if (onDone) onDone();
      });
      nav.appendChild(ctaBtn);
    } else {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'btn-primary';
      nextBtn.textContent = 'Avanti';
      nextBtn.addEventListener('click', () => {
        currentScreen++;
        render();
      });
      nav.appendChild(nextBtn);
    }

    // Skip link
    const skip = document.createElement('button');
    skip.className = 'ats-edu-skip';
    skip.textContent = 'Salta';
    skip.addEventListener('click', () => {
      localStorage.setItem('jh-ats-edu-done', '1');
      overlay.remove();
      if (onDone) onDone();
    });
    nav.appendChild(skip);

    card.appendChild(nav);
  }

  render();
  document.body.appendChild(overlay);
}

export function shouldShowATSEducation() {
  return !localStorage.getItem('jh-ats-edu-done');
}
