/**
 * Centralized string catalog for JobHacker UI.
 * Organized by module. Use t('module.key') to retrieve.
 * Prepared for future i18n — swap the `it` object for other languages.
 */

const it = {
  // ── Landing ──
  landing: {
    logo: 'JobHacker',
    badge: 'Open Beta \u2014 gratis per i primi utenti',
    h1_line1: 'Il sistema non e\' dalla tua parte.',
    h1_accent: 'Noi si\'.',
    subtitle: '100 candidature personalizzate in ore, non mesi. Ogni CV ottimizzato per passare i filtri automatici \u2014 in 5 minuti.',
    tryFree: 'Richiedi accesso',
    tryHint: 'Posti limitati. 2 CV al giorno, gratis.',
    wait: 'Un momento...',
    loginLink: 'Accedi',
    loginModalSubtitle: 'Inserisci la tua email per verificare il tuo account.',
    loginCheckBtn: 'Verifica',
    loginWelcomeBack: 'Bentornato!',
    loginChooseProvider: 'Scegli come accedere:',
    loginBackBtn: '\u2190 Cambia email',
    loginWaitlisted: 'Sei in lista d\'attesa',
    loginWaitlistedText: 'Il tuo account non \u00E8 ancora attivo. Ti avviseremo quando sar\u00E0 il tuo turno.',
    loginAddedToWaitlist: 'Ti abbiamo aggiunto alla lista',
    loginAddedToWaitlistText: 'Non abbiamo ancora un account con questa email. Ti abbiamo messo in lista d\'attesa \u2014 riceverai un\'email quando il tuo account sar\u00E0 attivo!',
    loginAlreadyInWaitlist: 'Sei gi\u00E0 in lista d\'attesa',
    loginAlreadyInWaitlistText: 'Questa email \u00E8 gi\u00E0 nella nostra lista. Riceverai un\'email appena il tuo account verr\u00E0 attivato \u2014 tieni d\'occhio la posta!',
    loginOkBtn: 'Ho capito',
    waitlistTitle: 'Richiedi accesso',
    waitlistPlaceholder: 'La tua email',
    waitlistBtn: 'Entra in lista',
    waitlistSubtitle: 'Lascia la tua email e ti avviseremo quando \u00E8 il tuo turno.',
    waitlistDone: 'Sei in lista. Ti avviseremo quando sar\u00E0 il tuo turno.',
    waitlistAlreadyActive: 'Ehi, ti conosco gi\u00E0! Il tuo account \u00E8 attivo \u2014 clicca "Accedi" in alto a destra per entrare.',
    waitlistedBanner: 'Non hai ancora un account attivo. Ti abbiamo aggiunto alla lista d\'attesa \u2014 ti avviseremo!',

    problemTitle: 'Il problema che nessuno ti spiega',
    problem1Title: 'Il 75% viene scartato dall\'ATS',
    problem1Text: 'Il tuo CV non arriva mai al recruiter. L\'algoritmo lo scarta in 6 secondi perche\' mancano le keyword giuste nel formato giusto.',
    problem2Title: 'Servono 100+ candidature',
    problem2Text: 'In Italia la ricerca dura in media 15 mesi. Gli esperti consigliano 5-10 candidature al giorno. Con CV diversi. Nessuno lo fa perche\' richiede troppo tempo.',
    problem3Title: '200 ore buttate',
    problem3Text: '1-2 ore per personalizzare ogni CV. Per 100 candidature fanno 200 ore. Tempo che potresti usare per prepararti ai colloqui.',

    compTitle: 'Perche\' non basta ChatGPT',
    compHeader1: 'A mano',
    compHeader2: 'ChatGPT + template',
    compHeader3: 'JobHacker',
    compRow1Label: 'Tempo per CV',
    compRow1A: '1-2 ore',
    compRow1B: '15-20 min',
    compRow1C: '5 min',
    compRow2Label: 'Personalizzato per annuncio',
    compRow2A: 'Se hai tempo',
    compRow2B: 'Dipende dal prompt',
    compRow2C: 'Automatico da JD',
    compRow3Label: 'Verifica ATS',
    compRow3A: 'Impossibile',
    compRow3B: 'Non disponibile',
    compRow3C: 'Score in tempo reale',
    compRow4Label: '100 candidature',
    compRow4A: '200 ore',
    compRow4B: '25+ ore',
    compRow4C: '~8 ore, PDF pronti',
    compRow5Label: 'Consistenza qualita\'',
    compRow5A: 'Cala col tempo',
    compRow5B: 'Varia col prompt',
    compRow5C: 'Costante',

    metricsTitle: 'Quello che il procione non inventa',
    metric1Value: '47s',
    metric1Label: 'tempo medio generazione',
    metric2Value: '87/100',
    metric2Label: 'score ATS medio',
    metric3Value: '8',
    metric3Label: 'regole anti-hallucination',

    howTitle: 'Come funziona',
    step1Title: 'Incolla l\'annuncio',
    step1Text: 'Copia la job description dal sito dell\'azienda. Il procione estrae le keyword che l\'ATS cerchera\' nel tuo CV.',
    step2Title: 'Il procione genera il tuo CV',
    step2Text: 'In 30 secondi hai un CV tailor-made: le tue esperienze reali, riformulate per matchare l\'annuncio. Zero hallucination.',
    step3Title: 'Verifica e scarica',
    step3Text: 'Controlla lo score ATS, modifica quello che vuoi inline, scarica in PDF. Pronto da inviare.',

    featTitle: 'Cosa fa JobHacker',
    feat1Title: 'CV su misura per ogni annuncio',
    feat1Text: 'Ogni CV e\' generato a partire dalle keyword della job description. Non un template \u2014 un documento unico.',
    feat2Title: 'Score ATS in tempo reale',
    feat2Text: 'Vedi subito quanto il tuo CV matcha l\'annuncio. Keyword mancanti, formato, struttura \u2014 tutto analizzato.',
    feat3Title: 'Editor inline',
    feat3Text: 'Non ti piace una frase? Cliccaci sopra e riscrivila. Il CV e\' tuo, il procione ti da\' la base.',
    feat4Title: 'Zero hallucination',
    feat4Text: '8 regole anti-hallucination verificano che ogni riga del CV corrisponda al tuo profilo reale. Niente invenzioni.',

    pricingTitle: 'Open Beta \u2014 Gratis',
    pricingSubtitle: '2 CV al giorno, zero costi. Nessuna carta di credito.',

    ctaTitle: 'Loro hanno i filtri. Tu hai il procione.',
    ctaText: 'I filtri ATS scartano il 75% dei candidati prima che un umano li veda. JobHacker ti mette dall\'altra parte del filtro.',

    footerTrust: 'I tuoi dati restano tuoi. Zero tracking, zero condivisione. Nessun CV esce senza il tuo consenso.',
  },

  // ── Auth ──
  auth: {
    title: 'JobHacker',
    subtitle: 'Il sistema non e\' dalla tua parte. Noi si\'.',
    google: 'Entra con Google',
    linkedin: 'Entra con LinkedIn',
    divider: 'oppure',
    guest: 'Prova senza account',
    wait: 'Un momento...',
    trust: 'I tuoi dati restano tuoi. Zero tracking, zero condivisione. Nessun CV esce senza il tuo consenso.',
    waitlistTitle: 'Sei in lista d\'attesa',
    waitlistText: 'Ti avviseremo quando sara\' il tuo turno.',
  },

  // ── CV Generator ──
  generator: {
    jdLabel: 'Incolla l\'annuncio',
    jdPlaceholder: 'Incolla qui l\'annuncio di lavoro. Più dettagli mi dai, meglio lavoro!',
    jdRequired: 'Serve l\'annuncio. Incolla la job description qui sopra.',
    langLabel: 'Lingua del CV',
    styleLabel: 'Stile',
    generate: 'Genera CV',
    progress1: 'Analizziamo l\'annuncio...',
    progress2: 'Keyword individuate...',
    progress3: 'Costruiamo il tuo CV...',
    progress4: 'Quasi fatto...',
    progress5: 'CV pronto.',
    success: 'CV pronto. Vediamo come se la cava con l\'ATS.',
    error: 'Qualcosa non ha funzionato.',
    kwTitle: 'Keyword dall\'annuncio',
    kwSubtitle: 'Queste sono le keyword che l\'ATS cerchera\' nel tuo CV.',
    kwConfirm: 'Conferma e genera',
    kwSkip: 'Salta',
    kwExtracting: 'Estrazione keyword dalla JD...',
    kwTargeted: 'Generazione CV con keyword target...',
  },

  // ── ATS Panel ──
  ats: {
    runBtn: 'Verifica ATS',
    loading: 'Analizziamo il tuo CV contro l\'annuncio...',
    optimizeBtn: 'Migliora il match',
    refineBtn: 'Affina ulteriormente',
    optimizeLoading: 'Miglioriamo il match...',
    optimizeVerify: 'Verifica risultato...',
    fallbackTip: 'Le keyword in rosso mancano dal tuo CV. Aggiungile dove ha senso per migliorare il match.',
    targetBanner: 'Questo CV e\' stato generato con keyword target. L\'analisi verifica il risultato.',
  },

  // ── Onboarding ──
  onboarding: {
    loading: 'Analizziamo il tuo profilo rispetto all\'annuncio...',
    counter: (done, total) => `${done}/${total} punti gestiti`,
    proceed: 'Tutto chiaro, genera il CV',
    error: 'Qualcosa non ha funzionato nell\'analisi.',
    fitLabel: '/100 compatibilita\'',
    badgeIncongruence: 'DA CORREGGERE',
    badgeImprove: 'DA MIGLIORARE',
    badgeValorize: 'DA VALORIZZARE',
    editPlaceholder: 'Riscrivi come vuoi che appaia nel CV...',
    actionRemove: 'Rimuovi',
    actionReduce: 'Riduci',
    actionKeep: 'Tieni cosi\'',
    actionEdit: 'Salva',
    actionApply: 'Applica',
    actionIgnore: 'Salta',
    actionDone: 'Fatto',
  },

  // ── CV Form ──
  form: {
    guestBanner: 'Stai provando JobHacker come ospite. I dati non vengono salvati \u2014 accedi per non perderli.',
    uploadTitle: 'Hai gia\' un CV? Caricalo qui',
    profileLabel: 'Etichetta Profilo',
    personalTitle: 'Informazioni Personali',
    photoTitle: 'Foto',
    photoPlaceholder: 'Aggiungi foto',
    experiencesTitle: 'Esperienze',
    addExperience: '+ Aggiungi esperienza',
    bulletPlaceholder: 'Cosa hai fatto di concreto...',
    addBullet: '+ Aggiungi punto',
    educationTitle: 'Formazione',
    addEducation: '+ Aggiungi formazione',
    skillsTitle: 'Competenze',
    skillPlaceholder: 'Scrivi una competenza e premi Invio',
    languagesTitle: 'Lingue',
    addLanguage: '+ Aggiungi lingua',
    save: 'Salva profilo',
    saved: 'Profilo salvato.',
    continue: 'Vai alla generazione',
    back: '\u2190 Torna al profilo',
    onboardBtn: 'Analisi strategica',
    onboardHint: 'Analizzo il tuo profilo rispetto all\'annuncio e ti suggerisco cosa sistemare prima di generare.',
    comingSoon: 'Coming soon',
    remove: 'Rimuovi',
  },

  // ── CV Upload ──
  upload: {
    dropText: 'Trascina il CV qui (PDF, Word, ODT, immagine) o clicca per scegliere',
    subtext: 'Leggo il tuo CV e pre-compilo tutti i campi',
    loading: 'Stiamo leggendo il tuo CV...',
    success: 'CV letto. Campi pre-compilati \u2014 controlla e correggi se serve.',
  },

  // ── CV Editor ──
  editor: {
    edit: 'Modifica',
    save: 'Salva',
    banner: 'Modalita\' modifica \u2014 clicca su qualsiasi campo per cambiarlo',
  },

  // ── CV Export ──
  export: {
    pdf: 'Scarica PDF',
    html: 'Scarica HTML',
    saveDb: 'Salva',
    pdfLoading: 'Preparazione PDF...',
    saving: 'Salvataggio...',
    saved: 'Salvato!',
    errorPdf: 'Errore PDF!',
    errorSave: 'Errore!',
  },

  // ── Account ──
  account: {
    dataTitle: 'I tuoi dati',
    dataHint: 'Questi dati vengono usati come base per ogni nuovo profilo CV.',
    saveBtn: 'Salva modifiche',
    saving: 'Salvataggio...',
    saved: 'Salvato.',
    prefsTitle: 'Preferenze',
    prefsSaved: 'Preferenze aggiornate.',
    profilesTitle: 'I tuoi profili CV',
    profilesEmpty: 'Nessun profilo ancora. Vai su "Genera CV" per crearne uno.',
    profilesHint: 'Puoi modificarli dal tab "Genera CV".',
    accountTitle: 'Account',
    deleteBtn: 'Elimina account',
    deleteConfirm1: 'Sicuro? Tutti i profili e le candidature vengono eliminati per sempre.',
    deleteConfirm2: 'Ultima conferma. Non si torna indietro.',
  },

  // ── Candidature ──
  candidature: {
    search: 'Cerca per azienda o ruolo...',
    exportMemo: 'Esporta memo',
    empty: 'Nessuna candidatura ancora. Genera il primo CV dal tab "Genera CV" per iniziare.',
    notesPlaceholder: 'Appunti \u2014 es. "Colloquio il 15/03, parlato con HR"',
    openCv: 'Apri CV',
    downloadPdf: 'Scarica PDF',
    pdfLoading: 'Generazione...',
    exportTitle: 'CANDIDATURE ATTIVE - JobHacker',
    noActive: 'Nessuna candidatura attiva da esportare.',
    statusSent: 'Inviato',
    statusWaiting: 'In attesa',
    statusInterview: 'Colloquio',
    statusRejected: 'Rifiutato',
  },

  // ── Pricing ──
  pricing: {
    title: 'Ricarica Raccoin',
    subtitle: 'Niente abbonamenti. Paghi per i CV che generi, quando vuoi.',
    credits: 'Raccoin',
    perCv: '/CV',
    popular: 'Piu\' popolare',
    buy: 'Acquista',
    guarantee: 'Garanzia 14 giorni: se l\'ATS score < 70, rimborso completo.',
    remaining: 'Raccoin rimasti',
    lowCredits: 'Hai pochi Raccoin rimasti.',
    noCredits: 'Raccoin esauriti. Ricarica per continuare.',
    paymentSuccess: 'Pagamento completato! I Raccoin sono stati aggiunti.',
    paymentCancel: 'Pagamento annullato.',
  },

  // ── Open Beta ──
  beta: {
    badge: 'OPEN BETA',
    dailyLimit: (used, limit) => `${limit - used}/${limit} CV rimasti oggi`,
    dailyExhausted: 'Hai raggiunto il limite giornaliero. Torna domani!',
    modalTitle: 'Open Beta — Gratis',
    modalText: 'Durante la beta puoi generare fino a 2 CV al giorno, gratis. Nessuna carta di credito richiesta.',
    modalHint: 'Segnala bug o idee per ottenere Raccoin extra.',
    landingTitle: 'Accesso in Open Beta',
    landingText: '2 CV al giorno, gratis.',
  },

  // ── Cover Letter ──
  coverLetter: {
    title: 'Lettera di Presentazione',
    generate: 'Genera lettera',
    generating: 'Generazione lettera...',
    cost: '1 Raccoin',
    hint: 'Genera una lettera di presentazione personalizzata per questo annuncio, basata sul CV appena creato.',
    copy: 'Copia',
    copied: 'Copiata!',
    error: 'Errore nella generazione della lettera.',
  },

  // ── Notifications ──
  notifications: {
    title: 'Notifiche',
    empty: 'Nessuna notifica',
    credits_received:  (d) => `Hai ricevuto ${d.credits} Raccoin${d.reason ? `: "${d.reason}"` : ''}`,
    credits_purchased: (d) => `Acquisto completato: +${d.credits} Raccoin`,
    feedback_rewarded: (d) => `Il tuo feedback \u00E8 stato premiato con ${d.credits} Raccoin`,
    welcome_activated: (d) => `Benvenuto! Il tuo account \u00E8 attivo \u2014 hai ${d.credits} Raccoin`,
  },

  // ── Common ──
  common: {
    loading: 'Caricamento...',
    error: 'Errore',
    errorPrefix: 'Errore: ',
    selectDefault: '\u2014 Seleziona \u2014',
    themeToggle: 'Cambia tema',
    logout: 'Esci',
    guest: 'Ospite',
  },
};

const strings = it;

/**
 * Get a string by dot-notation key. Falls back to the key itself if not found.
 * @param {string} key - e.g. 'landing.badge' or 'auth.title'
 * @returns {string|Function}
 */
export function t(key) {
  const parts = key.split('.');
  let val = strings;
  for (const p of parts) {
    val = val?.[p];
    if (val === undefined) return key;
  }
  return val;
}

export default strings;
