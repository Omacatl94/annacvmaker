import { api } from './api.js';
import { t } from './strings.js';
import { getUser } from './app.js';
import { showPricingModal } from './pricing.js';

/**
 * Renders the cover letter generation panel below the ATS panel.
 */
export function renderCoverLetterPanel(container, profile, generatedCV, jobDescription) {
  const user = getUser();
  if (!user || user.guest) return;
  if (!jobDescription) return;

  const panel = document.createElement('div');
  panel.className = 'cover-letter-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'cover-letter-header';

  const h3 = document.createElement('h3');
  h3.textContent = t('coverLetter.title');
  header.appendChild(h3);

  const cost = document.createElement('span');
  cost.className = 'cover-letter-cost';
  cost.textContent = t('coverLetter.cost');
  header.appendChild(cost);

  panel.appendChild(header);

  // Hint
  const hint = document.createElement('p');
  hint.className = 'cover-letter-hint';
  hint.textContent = t('coverLetter.hint');
  panel.appendChild(hint);

  // Generate button
  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = t('coverLetter.generate');
  panel.appendChild(btn);

  // Result area (hidden initially)
  const result = document.createElement('div');
  result.className = 'cover-letter-result';
  panel.appendChild(result);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = t('coverLetter.generating');
    result.className = 'cover-letter-result';
    result.textContent = '';

    try {
      const data = await api.coverLetter({
        profile,
        jobDescription,
        generatedData: generatedCV,
        language: generatedCV._language || 'it',
      });

      const letter = data.coverLetter || data;
      renderLetterResult(result, letter);
      result.classList.add('visible');
      btn.textContent = t('coverLetter.generate');
      btn.disabled = false;
    } catch (err) {
      if (err.message === 'Crediti insufficienti' || err.message === 'Limite giornaliero raggiunto') {
        showPricingModal();
        btn.textContent = t('coverLetter.generate');
        btn.disabled = false;
        return;
      }
      result.className = 'cover-letter-result error';
      result.textContent = t('coverLetter.error');
      btn.textContent = t('coverLetter.generate');
      btn.disabled = false;
    }
  });

  container.appendChild(panel);
}

function renderLetterResult(container, letter) {
  container.textContent = '';

  // Subject
  if (letter.subject) {
    const subject = document.createElement('div');
    subject.className = 'cover-letter-subject';
    subject.textContent = letter.subject;
    container.appendChild(subject);
  }

  // Greeting
  if (letter.greeting) {
    const greeting = document.createElement('p');
    greeting.className = 'cover-letter-greeting';
    greeting.textContent = letter.greeting;
    container.appendChild(greeting);
  }

  // Body paragraphs
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'cover-letter-body';
  const paragraphs = Array.isArray(letter.body) ? letter.body : [letter.body];
  for (const p of paragraphs) {
    const para = document.createElement('p');
    para.textContent = p;
    bodyDiv.appendChild(para);
  }
  container.appendChild(bodyDiv);

  // Closing
  if (letter.closing) {
    const closing = document.createElement('p');
    closing.className = 'cover-letter-closing';
    closing.textContent = letter.closing;
    container.appendChild(closing);
  }

  // Signature
  if (letter.signature) {
    const sig = document.createElement('p');
    sig.className = 'cover-letter-signature';
    sig.textContent = letter.signature;
    container.appendChild(sig);
  }

  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-secondary btn-sm cover-letter-copy';
  copyBtn.textContent = t('coverLetter.copy');
  copyBtn.addEventListener('click', () => {
    const text = [
      letter.subject,
      '',
      letter.greeting,
      '',
      ...paragraphs,
      '',
      letter.closing,
      letter.signature,
    ].filter(Boolean).join('\n\n');

    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = t('coverLetter.copied');
      setTimeout(() => { copyBtn.textContent = t('coverLetter.copy'); }, 2000);
    });
  });
  container.appendChild(copyBtn);
}
