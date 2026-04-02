import { useState, useCallback, useRef } from 'react';
import { t } from '../strings';

export default function Editor({ generated, onUpdate }) {
  const [editMode, setEditMode] = useState(false);
  const dataRef = useRef(generated);

  // Keep ref in sync with latest generated data
  dataRef.current = generated;

  const enterEditMode = useCallback(() => {
    setEditMode(true);
    const cvContainer = document.getElementById('cv-container');
    if (!cvContainer) return;

    cvContainer.classList.add('editing');
    const fields = cvContainer.querySelectorAll('[data-field]');
    fields.forEach((el) => {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
    });
  }, []);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    const cvContainer = document.getElementById('cv-container');
    if (!cvContainer) return;

    // Sync edited text back to generated data
    const updatedData = { ...dataRef.current };
    const fields = cvContainer.querySelectorAll('[data-field]');

    fields.forEach((el) => {
      const field = el.getAttribute('data-field');
      const text = el.textContent.trim();

      if (field === 'headline') {
        updatedData.headline = text;
      } else if (field === 'summary') {
        updatedData.summary = text;
      } else if (field === 'skills') {
        updatedData.skills = text.replace(/^\s*\|\s*/, '');
      } else if (field.startsWith('comp-')) {
        const idx = parseInt(field.split('-')[1], 10);
        if (updatedData.competencies && idx < updatedData.competencies.length) {
          updatedData.competencies = [...updatedData.competencies];
          updatedData.competencies[idx] = text;
        }
      } else if (field.startsWith('exp-')) {
        const parts = field.split('-');
        const expIdx = parseInt(parts[1], 10);
        const bulletIdx = parseInt(parts[2], 10);
        if (
          updatedData.experience?.[expIdx]?.bullets &&
          bulletIdx < updatedData.experience[expIdx].bullets.length
        ) {
          // Deep clone the experience array
          if (!updatedData._experienceCloned) {
            updatedData.experience = updatedData.experience.map((e) => ({
              ...e,
              bullets: [...e.bullets],
            }));
            updatedData._experienceCloned = true;
          }
          updatedData.experience[expIdx].bullets[bulletIdx] = text;
        }
      }
    });

    delete updatedData._experienceCloned;

    // Remove contenteditable
    fields.forEach((el) => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
    });
    cvContainer.classList.remove('editing');

    if (onUpdate) onUpdate(updatedData);
  }, [onUpdate]);

  const handleToggle = useCallback(() => {
    if (!editMode) {
      enterEditMode();
    } else {
      exitEditMode();
    }
  }, [editMode, enterEditMode, exitEditMode]);

  return (
    <>
      <div className="editor-toolbar">
        <button
          className={`btn-edit${editMode ? ' active' : ''}`}
          onClick={handleToggle}
        >
          {editMode ? t('editor.save') : t('editor.edit')}
        </button>
      </div>
      <div className={`edit-banner${editMode ? ' visible' : ''}`}>
        {t('editor.banner')}
      </div>
    </>
  );
}
