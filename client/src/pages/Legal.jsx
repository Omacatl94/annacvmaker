import { useNavigate } from 'react-router-dom';

const PRIVACY_SECTIONS = [
  {
    title: 'Titolare del trattamento',
    text: `JobHacker e' un servizio sperimentale. Il titolare del trattamento dei dati personali e' indicato nei contatti in fondo a questa pagina.`,
  },
  {
    title: 'Dati raccolti',
    text: `Raccogliamo solo i dati strettamente necessari al funzionamento del servizio:

- Dati di autenticazione: email, nome (da Google/LinkedIn OAuth). Non memorizziamo password.
- Dati del profilo CV: informazioni personali, esperienze, formazione, competenze, lingue — inseriti volontariamente dall'utente.
- CV generati: il testo dei CV generati dall'AI, la job description utilizzata, lo score ATS.
- Dati tecnici: cookie di sessione (strettamente necessari), log del server (IP, timestamp, endpoint chiamato).

NON raccogliamo: dati di navigazione, analytics comportamentali, dati biometrici, dati sensibili.`,
  },
  {
    title: "Finalita' del trattamento",
    text: `I dati vengono trattati esclusivamente per:

1. Fornire il servizio di generazione CV (Art. 6(1)(b) GDPR — esecuzione del servizio).
2. Mantenere la sessione utente (Art. 6(1)(b) — necessario per il funzionamento).
3. Migliorare il servizio attraverso log tecnici anonimi (Art. 6(1)(f) — legittimo interesse).`,
  },
  {
    title: 'Condivisione con terze parti',
    text: `I dati del profilo e le job description vengono inviati a servizi AI (OpenRouter/Anthropic/Google) per la generazione del CV e l'analisi ATS. Questi servizi agiscono come responsabili del trattamento.

NON vendiamo, affittiamo o condividiamo i tuoi dati con nessun altro soggetto terzo.
NON utilizziamo i tuoi dati per addestrare modelli AI.`,
  },
  {
    title: 'Conservazione dei dati',
    text: `- I dati del profilo e i CV generati vengono conservati finche' l'account e' attivo.
- Alla cancellazione dell'account, tutti i dati vengono eliminati immediatamente e irreversibilmente (CASCADE delete).
- I log tecnici vengono conservati per massimo 30 giorni.
- Le sessioni scadono dopo 7 giorni di inattivita'.`,
  },
  {
    title: 'I tuoi diritti (GDPR)',
    text: `Hai diritto a:

- Accesso: visualizzare tutti i tuoi dati (sezione Account).
- Portabilita': scaricare tutti i tuoi dati in formato JSON (bottone "Scarica i miei dati").
- Rettifica: modificare i tuoi dati in qualsiasi momento.
- Cancellazione: eliminare il tuo account e tutti i dati associati (bottone "Elimina account").
- Opposizione: contattarci per opporti al trattamento.

Per esercitare questi diritti, usa le funzioni nell'app o contattaci.`,
  },
  {
    title: 'Cookie',
    text: `Utilizziamo esclusivamente cookie tecnici di sessione, strettamente necessari per il funzionamento del servizio. Non utilizziamo cookie di profilazione, analytics o pubblicitari.

Il cookie di sessione:
- Nome: sessionId
- Durata: 7 giorni
- Tipo: HttpOnly, Secure
- Finalita': mantenere l'autenticazione

Non e' necessario un banner cookie per i cookie strettamente necessari (Art. 5(3) Direttiva ePrivacy).`,
  },
  {
    title: 'Sicurezza',
    text: `- Connessioni crittografate (HTTPS/TLS).
- Password non memorizzate (autenticazione delegata a Google/LinkedIn).
- Cookie HttpOnly e Secure.
- Rate limiting sulle API.
- Database con accesso limitato e backup.`,
  },
  {
    title: 'Contatti',
    text: `Per questioni relative alla privacy, scrivi a: privacy@jobhacker.it

Ultimo aggiornamento: marzo 2026.`,
  },
];

const TERMS_SECTIONS = [
  {
    title: 'Accettazione',
    text: `Utilizzando JobHacker accetti questi termini di servizio. Se non li accetti, non utilizzare il servizio.`,
  },
  {
    title: 'Descrizione del servizio',
    text: `JobHacker e' un servizio che utilizza intelligenza artificiale per generare CV ottimizzati per sistemi ATS (Applicant Tracking System). Il servizio include:

- Generazione di CV basati sul profilo dell'utente e su job description
- Analisi di compatibilita' ATS
- Ottimizzazione keyword
- Gestione profili e candidature`,
  },
  {
    title: "Responsabilita' dell'utente",
    text: `- I dati inseriti nel profilo devono essere veritieri e accurati.
- L'utente e' l'unico responsabile del contenuto del proprio CV.
- L'utente deve verificare il CV generato prima di inviarlo. L'AI puo' commettere errori.
- L'utente non deve utilizzare il servizio per generare CV fraudolenti o con informazioni false.`,
  },
  {
    title: 'Limitazioni del servizio',
    text: `- JobHacker NON garantisce che il CV generato superi tutti i filtri ATS o porti a colloqui.
- Il servizio e' fornito "as is". L'AI genera contenuti basati sui dati forniti — errori sono possibili.
- Il servizio potrebbe essere temporaneamente non disponibile per manutenzione o problemi tecnici.
- Le regole anti-hallucination riducono ma non eliminano il rischio di imprecisioni.`,
  },
  {
    title: "Proprieta' intellettuale",
    text: `- I CV generati appartengono all'utente.
- Il codice sorgente, il design e i prompt di JobHacker sono proprieta' del titolare.
- L'utente concede a JobHacker il diritto di elaborare i dati del profilo e le job description al solo scopo di fornire il servizio.`,
  },
  {
    title: 'Prezzi e pagamenti',
    text: `- Il primo CV e' gratuito.
- I pacchetti a pagamento sono pre-pagati e non rimborsabili una volta utilizzati i crediti.
- I prezzi possono cambiare. I crediti gia' acquistati restano validi.
- I crediti non hanno scadenza.`,
  },
  {
    title: 'Cancellazione',
    text: `- L'utente puo' cancellare il proprio account in qualsiasi momento dalla sezione Account.
- Alla cancellazione, tutti i dati vengono eliminati irreversibilmente.
- I crediti non utilizzati al momento della cancellazione non vengono rimborsati.`,
  },
  {
    title: 'Modifiche ai termini',
    text: `Possiamo modificare questi termini. Le modifiche saranno comunicate tramite il servizio. L'uso continuato dopo la notifica costituisce accettazione.`,
  },
  {
    title: 'Legge applicabile',
    text: `Questi termini sono regolati dalla legge italiana. Per qualsiasi controversia e' competente il Foro di [sede legale].

Ultimo aggiornamento: marzo 2026.`,
  },
];

export default function Legal({ page }) {
  const navigate = useNavigate();
  const isPrivacy = page === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Termini di Servizio';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return (
    <div className="legal-page">
      <nav className="landing-nav">
        <a
          href="/"
          className="landing-logo"
          style={{ textDecoration: 'none' }}
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
        >
          JobHacker
        </a>
      </nav>
      <div className="legal-wrapper">
        <h1 className="legal-title">{title}</h1>
        <div className="legal-content">
          {sections.map((s, i) => (
            <div className="legal-section" key={i}>
              <h3>{s.title}</h3>
              <div className="legal-text" style={{ whiteSpace: 'pre-line' }}>
                {s.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
