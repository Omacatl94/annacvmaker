export function renderPrivacyPolicy(root) {
  root.textContent = '';
  const page = createLegalPage('Privacy Policy');

  const content = page.querySelector('.legal-content');

  addSection(content, 'Titolare del trattamento', `
JobHacker e' un servizio sperimentale. Il titolare del trattamento dei dati personali e' indicato nei contatti in fondo a questa pagina.
  `);

  addSection(content, 'Dati raccolti', `
Raccogliamo solo i dati strettamente necessari al funzionamento del servizio:

- Dati di autenticazione: email, nome (da Google/LinkedIn OAuth). Non memorizziamo password.
- Dati del profilo CV: informazioni personali, esperienze, formazione, competenze, lingue — inseriti volontariamente dall'utente.
- CV generati: il testo dei CV generati dall'AI, la job description utilizzata, lo score ATS.
- Dati tecnici: cookie di sessione (strettamente necessari), log del server (IP, timestamp, endpoint chiamato).

NON raccogliamo: dati di navigazione, analytics comportamentali, dati biometrici, dati sensibili.
  `);

  addSection(content, 'Finalita\' del trattamento', `
I dati vengono trattati esclusivamente per:

1. Fornire il servizio di generazione CV (Art. 6(1)(b) GDPR — esecuzione del servizio).
2. Mantenere la sessione utente (Art. 6(1)(b) — necessario per il funzionamento).
3. Migliorare il servizio attraverso log tecnici anonimi (Art. 6(1)(f) — legittimo interesse).
  `);

  addSection(content, 'Condivisione con terze parti', `
I dati del profilo e le job description vengono inviati a servizi AI (OpenRouter/Anthropic/Google) per la generazione del CV e l'analisi ATS. Questi servizi agiscono come responsabili del trattamento.

NON vendiamo, affittiamo o condividiamo i tuoi dati con nessun altro soggetto terzo.
NON utilizziamo i tuoi dati per addestrare modelli AI.
  `);

  addSection(content, 'Conservazione dei dati', `
- I dati del profilo e i CV generati vengono conservati finche' l'account e' attivo.
- Alla cancellazione dell'account, tutti i dati vengono eliminati immediatamente e irreversibilmente (CASCADE delete).
- I log tecnici vengono conservati per massimo 30 giorni.
- Le sessioni scadono dopo 7 giorni di inattivita'.
  `);

  addSection(content, 'I tuoi diritti (GDPR)', `
Hai diritto a:

- Accesso: visualizzare tutti i tuoi dati (sezione Account).
- Portabilita': scaricare tutti i tuoi dati in formato JSON (bottone "Scarica i miei dati").
- Rettifica: modificare i tuoi dati in qualsiasi momento.
- Cancellazione: eliminare il tuo account e tutti i dati associati (bottone "Elimina account").
- Opposizione: contattarci per opporti al trattamento.

Per esercitare questi diritti, usa le funzioni nell'app o contattaci.
  `);

  addSection(content, 'Cookie', `
Utilizziamo esclusivamente cookie tecnici di sessione, strettamente necessari per il funzionamento del servizio. Non utilizziamo cookie di profilazione, analytics o pubblicitari.

Il cookie di sessione:
- Nome: sessionId
- Durata: 7 giorni
- Tipo: HttpOnly, Secure
- Finalita': mantenere l'autenticazione

Non e' necessario un banner cookie per i cookie strettamente necessari (Art. 5(3) Direttiva ePrivacy).
  `);

  addSection(content, 'Sicurezza', `
- Connessioni crittografate (HTTPS/TLS).
- Password non memorizzate (autenticazione delegata a Google/LinkedIn).
- Cookie HttpOnly e Secure.
- Rate limiting sulle API.
- Database con accesso limitato e backup.
  `);

  addSection(content, 'Contatti', `
Per questioni relative alla privacy, scrivi a: privacy@jobhacker.it

Ultimo aggiornamento: marzo 2026.
  `);

  root.appendChild(page);
}

export function renderTermsOfService(root) {
  root.textContent = '';
  const page = createLegalPage('Termini di Servizio');

  const content = page.querySelector('.legal-content');

  addSection(content, 'Accettazione', `
Utilizzando JobHacker accetti questi termini di servizio. Se non li accetti, non utilizzare il servizio.
  `);

  addSection(content, 'Descrizione del servizio', `
JobHacker e' un servizio che utilizza intelligenza artificiale per generare CV ottimizzati per sistemi ATS (Applicant Tracking System). Il servizio include:

- Generazione di CV basati sul profilo dell'utente e su job description
- Analisi di compatibilita' ATS
- Ottimizzazione keyword
- Gestione profili e candidature
  `);

  addSection(content, 'Responsabilita\' dell\'utente', `
- I dati inseriti nel profilo devono essere veritieri e accurati.
- L'utente e' l'unico responsabile del contenuto del proprio CV.
- L'utente deve verificare il CV generato prima di inviarlo. L'AI puo' commettere errori.
- L'utente non deve utilizzare il servizio per generare CV fraudolenti o con informazioni false.
  `);

  addSection(content, 'Limitazioni del servizio', `
- JobHacker NON garantisce che il CV generato superi tutti i filtri ATS o porti a colloqui.
- Il servizio e' fornito "as is". L'AI genera contenuti basati sui dati forniti — errori sono possibili.
- Il servizio potrebbe essere temporaneamente non disponibile per manutenzione o problemi tecnici.
- Le regole anti-hallucination riducono ma non eliminano il rischio di imprecisioni.
  `);

  addSection(content, 'Proprieta\' intellettuale', `
- I CV generati appartengono all'utente.
- Il codice sorgente, il design e i prompt di JobHacker sono proprieta' del titolare.
- L'utente concede a JobHacker il diritto di elaborare i dati del profilo e le job description al solo scopo di fornire il servizio.
  `);

  addSection(content, 'Prezzi e pagamenti', `
- Il primo CV e' gratuito.
- I pacchetti a pagamento sono pre-pagati e non rimborsabili una volta utilizzati i crediti.
- I prezzi possono cambiare. I crediti gia' acquistati restano validi.
- I crediti non hanno scadenza.
  `);

  addSection(content, 'Cancellazione', `
- L'utente puo' cancellare il proprio account in qualsiasi momento dalla sezione Account.
- Alla cancellazione, tutti i dati vengono eliminati irreversibilmente.
- I crediti non utilizzati al momento della cancellazione non vengono rimborsati.
  `);

  addSection(content, 'Modifiche ai termini', `
Possiamo modificare questi termini. Le modifiche saranno comunicate tramite il servizio. L'uso continuato dopo la notifica costituisce accettazione.
  `);

  addSection(content, 'Legge applicabile', `
Questi termini sono regolati dalla legge italiana. Per qualsiasi controversia e' competente il Foro di [sede legale].

Ultimo aggiornamento: marzo 2026.
  `);

  root.appendChild(page);
}

function createLegalPage(title) {
  const page = document.createElement('div');
  page.className = 'legal-page';

  const nav = document.createElement('nav');
  nav.className = 'landing-nav';

  const logo = document.createElement('a');
  logo.href = '/';
  logo.className = 'landing-logo';
  logo.textContent = 'JobHacker';
  logo.style.textDecoration = 'none';
  nav.appendChild(logo);

  page.appendChild(nav);

  const wrapper = document.createElement('div');
  wrapper.className = 'legal-wrapper';

  const h1 = document.createElement('h1');
  h1.className = 'legal-title';
  h1.textContent = title;
  wrapper.appendChild(h1);

  const content = document.createElement('div');
  content.className = 'legal-content';
  wrapper.appendChild(content);

  page.appendChild(wrapper);
  return page;
}

function addSection(container, title, text) {
  const section = document.createElement('div');
  section.className = 'legal-section';

  const h2 = document.createElement('h3');
  h2.textContent = title;
  section.appendChild(h2);

  const p = document.createElement('div');
  p.className = 'legal-text';
  p.textContent = text.trim();
  p.style.whiteSpace = 'pre-line';
  section.appendChild(p);

  container.appendChild(section);
}
