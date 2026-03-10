import { api } from './api.js';

/**
 * Handle the full CV upload + OCR parsing flow.
 * @param {File} file - The file to upload and parse
 * @param {Function} onParsed - Called with structured CV data on success
 * @param {Function} onError - Called with error message on failure
 * @param {Function} onLoading - Called with boolean (true=start, false=end)
 */
export async function handleCVUpload(file, onParsed, onError, onLoading) {
  try {
    onLoading(true);

    // Step 1: Upload the file to server
    const uploadResult = await api.uploadCV(file);

    // Step 2: Parse with Mistral OCR + Claude structuring
    const parseResult = await api.parseCV(uploadResult.path);

    // Step 3: Return structured data
    onParsed(parseResult.structured);
  } catch (err) {
    onError(err.message || 'Failed to parse CV');
  } finally {
    onLoading(false);
  }
}

/**
 * Creates a drag-and-drop upload zone element.
 * @param {Function} onParsed - Called with structured CV data
 * @returns {HTMLElement} The upload zone element
 */
export function createUploadZone(onParsed) {
  const zone = document.createElement('div');
  zone.className = 'upload-zone';

  const icon = document.createElement('div');
  icon.className = 'upload-icon';
  icon.textContent = '\u{1F4C4}';
  zone.appendChild(icon);

  const text = document.createElement('p');
  text.className = 'upload-text';
  text.textContent = 'Trascina qui il tuo CV (PDF, DOCX, immagine) oppure clicca per selezionare';
  zone.appendChild(text);

  const subtext = document.createElement('p');
  subtext.className = 'upload-subtext';
  subtext.textContent = 'Il CV verr\u00e0 analizzato con AI e i campi verranno pre-compilati';
  zone.appendChild(subtext);

  // Loading state elements
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'upload-loading';
  loadingDiv.style.display = 'none';

  const spinner = document.createElement('div');
  spinner.className = 'upload-spinner';
  loadingDiv.appendChild(spinner);

  const loadingText = document.createElement('p');
  loadingText.textContent = 'Analisi del CV in corso...';
  loadingDiv.appendChild(loadingText);

  zone.appendChild(loadingDiv);

  // Hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.pdf,.docx,.doc,.jpg,.jpeg,.png,.webp';
  fileInput.style.display = 'none';

  // Error/success feedback
  const feedback = document.createElement('div');
  feedback.className = 'upload-feedback';
  feedback.style.display = 'none';
  zone.appendChild(feedback);

  // Click to select
  zone.addEventListener('click', (e) => {
    if (e.target === fileInput) return;
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      processFile(fileInput.files[0]);
    }
  });
  zone.appendChild(fileInput);

  // Drag events
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  });

  function processFile(file) {
    handleCVUpload(
      file,
      (data) => {
        feedback.textContent = 'CV analizzato con successo! Campi pre-compilati.';
        feedback.className = 'upload-feedback success';
        feedback.style.display = 'block';
        onParsed(data);
      },
      (errMsg) => {
        feedback.textContent = 'Errore: ' + errMsg;
        feedback.className = 'upload-feedback error';
        feedback.style.display = 'block';
      },
      (loading) => {
        if (loading) {
          icon.style.display = 'none';
          text.style.display = 'none';
          subtext.style.display = 'none';
          loadingDiv.style.display = 'flex';
          feedback.style.display = 'none';
        } else {
          icon.style.display = '';
          text.style.display = '';
          subtext.style.display = '';
          loadingDiv.style.display = 'none';
        }
      }
    );
  }

  return zone;
}
