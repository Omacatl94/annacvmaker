import { getGeneratedData, setGeneratedData } from './cv-generator.js';

let editMode = false;

/**
 * Renders the editor toolbar above the CV preview.
 * @param {HTMLElement} container — element to append the toolbar to
 * @param {Object} profile — the CV profile data
 * @param {Function} onSave — called with updated generatedData after saving
 */
export function renderEditorToolbar(container, profile, onSave) {
  const toolbar = document.createElement('div');
  toolbar.className = 'editor-toolbar';

  // Edit / Save toggle button
  const editBtn = document.createElement('button');
  editBtn.className = 'btn-edit';
  editBtn.textContent = 'Modifica';
  toolbar.appendChild(editBtn);

  // Edit mode banner
  const banner = document.createElement('div');
  banner.className = 'edit-banner';
  banner.textContent = 'Modalit\u00e0 modifica \u2014 clicca su qualsiasi campo per modificarlo';

  editBtn.addEventListener('click', () => {
    if (!editMode) {
      enterEditMode(editBtn, banner);
    } else {
      exitEditMode(editBtn, banner, onSave);
    }
  });

  container.appendChild(toolbar);
  container.appendChild(banner);
}

/**
 * Returns true if currently in edit mode.
 */
export function isEditing() {
  return editMode;
}

/**
 * Programmatically exit edit mode and save (used by export before download/print).
 * @param {Function} onSave — callback
 */
export function saveIfEditing(onSave) {
  if (!editMode) return;
  const editBtn = document.querySelector('.editor-toolbar .btn-edit');
  const banner = document.querySelector('.edit-banner');
  if (editBtn && banner) {
    exitEditMode(editBtn, banner, onSave);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function enterEditMode(editBtn, banner) {
  editMode = true;
  editBtn.textContent = 'Salva';
  editBtn.classList.add('active');
  banner.classList.add('visible');

  const cvContainer = document.getElementById('cv-container');
  if (!cvContainer) return;

  cvContainer.classList.add('editing');

  const fields = cvContainer.querySelectorAll('[data-field]');
  fields.forEach(el => {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
  });
}

function exitEditMode(editBtn, banner, onSave) {
  editMode = false;
  editBtn.textContent = 'Modifica';
  editBtn.classList.remove('active');
  banner.classList.remove('visible');

  const cvContainer = document.getElementById('cv-container');
  if (!cvContainer) return;

  // Sync edited text back to generatedData
  const generatedData = getGeneratedData();
  if (generatedData) {
    const fields = cvContainer.querySelectorAll('[data-field]');
    fields.forEach(el => {
      const field = el.getAttribute('data-field');
      const text = el.textContent.trim();

      if (field === 'headline') {
        generatedData.headline = text;
      } else if (field === 'summary') {
        generatedData.summary = text;
      } else if (field === 'skills') {
        // Skills field has a leading " | " from rendering — strip it
        generatedData.skills = text.replace(/^\s*\|\s*/, '');
      } else if (field.startsWith('comp-')) {
        const idx = parseInt(field.split('-')[1], 10);
        if (generatedData.competencies && idx < generatedData.competencies.length) {
          generatedData.competencies[idx] = text;
        }
      } else if (field.startsWith('exp-')) {
        const parts = field.split('-');
        const expIdx = parseInt(parts[1], 10);
        const bulletIdx = parseInt(parts[2], 10);
        if (
          generatedData.experience &&
          generatedData.experience[expIdx] &&
          generatedData.experience[expIdx].bullets &&
          bulletIdx < generatedData.experience[expIdx].bullets.length
        ) {
          generatedData.experience[expIdx].bullets[bulletIdx] = text;
        }
      }
    });
    setGeneratedData(generatedData);
  }

  // Remove contenteditable and editing class
  const fields = cvContainer.querySelectorAll('[data-field]');
  fields.forEach(el => {
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
  });
  cvContainer.classList.remove('editing');

  if (onSave && generatedData) {
    onSave(generatedData);
  }
}
