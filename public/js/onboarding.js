import { api } from './api.js';

/**
 * Renders the onboarding analysis flow.
 * @param {HTMLElement} container - Where to render
 * @param {Object} profile - The CV profile data
 * @param {string} jobDescription - The pasted JD
 * @param {string} language - 'it' or 'en'
 * @param {Function} onComplete - Called with updated profile data when user finishes processing cards
 */
export async function renderOnboarding(container, profile, jobDescription, language, onComplete) {
  container.textContent = '';

  // Show loading
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'onboarding-loading';

  const spinner = document.createElement('div');
  spinner.className = 'upload-spinner';
  loadingDiv.appendChild(spinner);

  const loadingText = document.createElement('p');
  loadingText.textContent = 'Analisi strategica del CV in corso...';
  loadingDiv.appendChild(loadingText);

  container.appendChild(loadingDiv);

  try {
    // Call the analyzer
    const result = await api.analyze({ profile, jobDescription, language });

    container.textContent = '';

    // Overall fit score
    renderOverallFit(container, result.overall_fit);

    // Sort observations: high severity first
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const sorted = (result.observations || []).sort(
      (a, b) => (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2)
    );

    // Track which cards have been actioned
    const actioned = new Set();
    let workingProfile = JSON.parse(JSON.stringify(profile));

    // Render cards
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'onboarding-cards';

    sorted.forEach((obs, index) => {
      const card = renderObservationCard(obs, index, workingProfile, () => {
        actioned.add(index);
        // Check if all cards actioned
        if (actioned.size === sorted.length) {
          proceedBtn.disabled = false;
          proceedBtn.classList.add('ready');
        }
        updateCounter();
      });
      cardsContainer.appendChild(card);
    });

    container.appendChild(cardsContainer);

    // Counter and proceed button
    const footer = document.createElement('div');
    footer.className = 'onboarding-footer';

    const counter = document.createElement('span');
    counter.className = 'onboarding-counter';
    function updateCounter() {
      counter.textContent = `${actioned.size}/${sorted.length} osservazioni processate`;
    }
    updateCounter();
    footer.appendChild(counter);

    const proceedBtn = document.createElement('button');
    proceedBtn.className = 'btn-primary';
    proceedBtn.textContent = 'Procedi alla generazione';
    proceedBtn.disabled = sorted.length > 0;  // disabled until all cards actioned (or 0 cards)
    if (sorted.length === 0) proceedBtn.classList.add('ready');
    proceedBtn.addEventListener('click', () => {
      onComplete(workingProfile);
    });
    footer.appendChild(proceedBtn);

    container.appendChild(footer);

  } catch (err) {
    container.textContent = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'upload-feedback error';
    errDiv.textContent = 'Errore nell\'analisi: ' + err.message;
    container.appendChild(errDiv);
  }
}

function renderOverallFit(container, fit) {
  const section = document.createElement('div');
  section.className = 'overall-fit card';

  const scoreDiv = document.createElement('div');
  scoreDiv.className = 'fit-score';

  const scoreNum = document.createElement('span');
  scoreNum.className = 'fit-score-number';
  scoreNum.textContent = fit.score;

  // Color based on score
  if (fit.score >= 80) scoreNum.classList.add('score-high');
  else if (fit.score >= 60) scoreNum.classList.add('score-medium');
  else scoreNum.classList.add('score-low');

  scoreDiv.appendChild(scoreNum);

  const scoreLabel = document.createElement('span');
  scoreLabel.className = 'fit-score-label';
  scoreLabel.textContent = '/100 Fit Score';
  scoreDiv.appendChild(scoreLabel);

  section.appendChild(scoreDiv);

  const summary = document.createElement('p');
  summary.className = 'fit-summary';
  summary.textContent = fit.summary;
  section.appendChild(summary);

  container.appendChild(section);
}

function renderObservationCard(obs, index, workingProfile, onAction) {
  const card = document.createElement('div');
  card.className = `observation-card card obs-${obs.type}`;
  card.dataset.index = index;

  // Type badge
  const badge = document.createElement('span');
  badge.className = `obs-badge obs-badge-${obs.type}`;
  const typeLabels = { incongruence: 'INCONGRUENZA', improve: 'MIGLIORA', valorize: 'VALORIZZA' };
  badge.textContent = typeLabels[obs.type] || obs.type.toUpperCase();
  card.appendChild(badge);

  // Title
  const title = document.createElement('h4');
  title.className = 'obs-title';
  title.textContent = obs.title;
  card.appendChild(title);

  // Detail
  const detail = document.createElement('p');
  detail.className = 'obs-detail';
  detail.textContent = obs.detail;
  card.appendChild(detail);

  // Advice
  const advice = document.createElement('p');
  advice.className = 'obs-advice';
  advice.textContent = 'Consiglio: ' + obs.advice;
  card.appendChild(advice);

  // Actions
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'obs-actions';

  // Edit field (for "improve" type)
  let editField = null;
  if (obs.actions.includes('edit')) {
    editField = document.createElement('textarea');
    editField.className = 'obs-edit-field';
    editField.placeholder = 'Riscrivi qui...';
    // Pre-fill with current bullet text if applicable
    if (obs.target === 'experience' && obs.target_index !== undefined) {
      const exp = workingProfile.experiences[obs.target_index];
      if (exp && exp.bullets) {
        editField.value = exp.bullets.join('\n');
      }
    }
    card.appendChild(editField);
  }

  const actionLabels = {
    remove: 'Rimuovi',
    reduce: 'Riduci',
    keep: 'Mantieni',
    edit: 'Salva modifiche',
    apply: 'Applica consiglio',
    ignore: 'Ignora',
  };

  const actionStyles = {
    remove: 'btn-danger-small',
    reduce: 'btn-secondary',
    keep: 'btn-secondary',
    edit: 'btn-primary',
    apply: 'btn-primary',
    ignore: 'btn-secondary',
  };

  obs.actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = actionStyles[action] || 'btn-secondary';
    btn.textContent = actionLabels[action] || action;
    btn.addEventListener('click', () => {
      applyAction(action, obs, workingProfile, editField);
      card.classList.add('obs-actioned');
      actionsDiv.style.display = 'none';
      if (editField) editField.disabled = true;

      const doneLabel = document.createElement('span');
      doneLabel.className = 'obs-done-label';
      doneLabel.textContent = actionLabels[action] + ' applicato';
      card.appendChild(doneLabel);

      onAction();
    });
    actionsDiv.appendChild(btn);
  });

  card.appendChild(actionsDiv);
  return card;
}

function applyAction(action, obs, profile, editField) {
  const idx = obs.target_index;

  switch (action) {
    case 'remove':
      if (obs.target === 'experience' && idx !== undefined) {
        profile.experiences.splice(idx, 1);
      } else if (obs.target === 'skill' && idx !== undefined) {
        profile.skills.splice(idx, 1);
      }
      break;

    case 'reduce':
      if (obs.target === 'experience' && idx !== undefined && profile.experiences[idx]) {
        // Keep only first bullet
        profile.experiences[idx].bullets = [profile.experiences[idx].bullets[0] || ''];
      }
      break;

    case 'edit':
      if (editField && obs.target === 'experience' && idx !== undefined && profile.experiences[idx]) {
        profile.experiences[idx].bullets = editField.value.split('\n').filter(b => b.trim());
      }
      break;

    case 'apply':
      // Acknowledged — the generation will handle this via the prompt
      break;

    case 'keep':
    case 'ignore':
      // No changes
      break;
  }
}
