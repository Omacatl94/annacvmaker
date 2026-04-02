# Universal CV Maker — Design Document

> Data: 2026-03-10
> Evoluzione di annacvmaker da tool single-user (Anna Marongiu) a piattaforma CV maker universale.

## Decisioni di design

| Aspetto | Decisione |
|---|---|
| Input dati | Ibrido (upload CV via Mistral OCR + form manuale) |
| Parsing documenti | Mistral OCR (`mistral-ocr-latest`) via OpenRouter |
| Onboarding | Conversazionale — analisi chirurgica incongruenze vs ruolo target |
| Stili CV | 3 template (Professional, Modern, Minimal) — stesso layout monocolonna, font + colori diversi via CSS variables |
| Persistenza | Account utente + PostgreSQL |
| Auth | Social login (Google + LinkedIn) |
| Monetizzazione | Posticipata — architettura predisposta |
| Backend | Node.js + Fastify |
| Frontend | SPA vanilla JS modulare (ES modules nativi, no framework) |
| Deploy | Docker Compose su DigitalOcean droplet. Prima locale, poi droplet con accesso via IP pubblico. Dominio dopo. |
| AI | OpenRouter unico provider (Claude Opus generazione, Haiku ATS, Mistral OCR parsing) |

---

## Architettura

```
┌─────────────────────────────────────────────────────────┐
│                    DigitalOcean Droplet                  │
│                                                         │
│  Nginx (SSL termination, reverse proxy)                 │
│       ↓                                                 │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Fastify Server :3000                │    │
│  │                                                  │    │
│  │  /public/*        → SPA (HTML/CSS/JS statico)   │    │
│  │  /api/auth/*      → Social login (Google/LI)    │    │
│  │  /api/cv/*        → CRUD dati CV utente         │    │
│  │  /api/ai/*        → Proxy OpenRouter            │    │
│  │  /api/upload/*    → Upload foto + CV file       │    │
│  └──────┬──────────────┬───────────────┬────────────┘    │
│         │              │               │                 │
│    PostgreSQL     uploads/        OpenRouter API         │
│    (utenti,       (foto,          (Claude Opus,          │
│     CV data)      CV files)        Haiku, Mistral OCR)  │
└─────────────────────────────────────────────────────────┘
```

---

## User Flow

```
1. LOGIN
   Landing page → "Accedi con Google" / "Accedi con LinkedIn"
   → Redirect OAuth → User creato/trovato in DB → Dashboard

2. CARICAMENTO CV (ibrido)
   Opzione A: Upload file (PDF/DOCX/immagine)
     → Mistral OCR → testo strutturato → AI mappa nei campi → form pre-compilato
   Opzione B: Compila da zero (form dinamico)
   + Upload foto (crop circolare, preview)
   → Salvataggio profilo in DB

3. TARGET ROLE
   L'utente incolla la Job Description
   + seleziona lingua (IT/EN) e stile (Professional/Modern/Minimal)

4. ONBOARDING STRATEGICO (conversazionale)
   AI analizza CV + JD → produce cards actionable:
   - 🔴 INCONGRUENZA (high): ruoli divergenti → rimuovi/riduci/mantieni
   - 🟡 MIGLIORA (medium): bullet generici → campo testo per riscrivere
   - 🟢 VALORIZZA (low): ruoli propedeutici → applica consiglio/ignora
   L'utente processa le cards → dati CV aggiornati

5. GENERAZIONE CV
   Stesse regole anti-hallucination, adattate per dati dinamici
   → Preview con template scelto

6. ATS + OTTIMIZZAZIONE + EXPORT
   Dual ATS scoring (Classic + Smart) → ottimizzazione keyword
   → inline editing → download HTML / print A4
   → CV salvato in DB (storico)
```

---

## Regole anti-hallucination (adattate)

| # | Regola |
|---|---|
| 1 | Solo skills dichiarate dall'utente. L'AI non può aggiungerne. |
| 2 | Solo rephrase dei bullet esistenti, mai inventare achievement. |
| 3 | Budget bullet dinamico: max 12 totali, distribuiti per rilevanza alla JD. Esperienze recenti/rilevanti fino a 4, supporto 1-2, datate/irrilevanti 0-1. |
| 4 | Summary esattamente 4 frasi, max 500 caratteri. |
| 5 | CV deve stare in 1 pagina A4 (max 8 parole headline, ~230 char per bullet). |
| 6 | Tono fattuale e grounded, non marketing-speak. |
| 7 | Keyword mirroring — usare terminologia esatta della JD per ATS matching. |
| 8 | L'AI deve dichiarare nel JSON quali esperienze ha omesso e perché. |

---

## Template CV (CSS Variables)

3 stili, stesso layout monocolonna, cambiano solo variabili CSS:

- **Professional**: Georgia (serif), palette teal (#0d7377)
- **Modern**: Inter (sans-serif), palette navy (#1e3a5f)
- **Minimal**: Lato (sans-serif), palette grigio/nero (#333333)

Selezione con 3 miniature preview. Aggiungere stili futuri = aggiungere un blocco di CSS variables.

---

## Struttura progetto

```
annacvmaker/
├── server/
│   ├── index.js                  # Entry point Fastify
│   ├── config.js                 # Env vars, costanti
│   ├── plugins/
│   │   ├── auth.js               # OAuth Google + LinkedIn
│   │   ├── cors.js               # CORS config
│   │   └── static.js             # Serve frontend
│   ├── routes/
│   │   ├── auth.js               # /api/auth/*
│   │   ├── cv.js                 # /api/cv/*
│   │   ├── ai.js                 # /api/ai/*
│   │   └── upload.js             # /api/upload/*
│   ├── services/
│   │   ├── openrouter.js         # Client OpenRouter
│   │   ├── cv-analyzer.js        # Logica onboarding strategico
│   │   ├── prompt-builder.js     # Costruzione prompt
│   │   └── ats-scorer.js         # Scoring ATS
│   ├── db/
│   │   ├── connection.js         # Pool PostgreSQL
│   │   └── migrations/           # Schema versioning
│   └── middleware/
│       ├── auth-guard.js         # Verifica sessione
│       └── rate-limit.js         # Rate limiting
│
├── public/
│   ├── index.html                # Shell HTML
│   ├── css/
│   │   ├── app.css               # Layout app
│   │   ├── cv-themes.css         # 3 template CSS variables
│   │   └── cv-layout.css         # Struttura CV condivisa
│   ├── js/
│   │   ├── app.js                # Router SPA, init
│   │   ├── auth.js               # Login/logout UI
│   │   ├── cv-form.js            # Form compilazione CV
│   │   ├── cv-upload.js          # Upload + parsing OCR
│   │   ├── onboarding.js         # UI cards onboarding
│   │   ├── cv-generator.js       # Generazione + preview
│   │   ├── cv-editor.js          # Inline editing
│   │   ├── ats-panel.js          # ATS scoring UI
│   │   └── cv-export.js          # Download/print
│   └── assets/
│       └── fonts/
│
├── .env
├── package.json
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

---

## API Endpoints

```
AUTH
  GET  /api/auth/google             → Redirect OAuth Google
  GET  /api/auth/google/callback    → Callback, crea sessione
  GET  /api/auth/linkedin           → Redirect OAuth LinkedIn
  GET  /api/auth/linkedin/callback
  POST /api/auth/logout             → Distrugge sessione
  GET  /api/auth/me                 → Utente corrente

CV PROFILES
  GET    /api/cv/profiles           → Lista profili utente
  POST   /api/cv/profiles           → Crea nuovo profilo
  PUT    /api/cv/profiles/:id       → Aggiorna profilo
  DELETE /api/cv/profiles/:id       → Elimina profilo

UPLOAD
  POST /api/upload/photo            → Upload foto
  POST /api/upload/cv-file          → Upload CV file per parsing

AI
  POST /api/ai/parse-cv             → Mistral OCR → testo strutturato
  POST /api/ai/analyze              → Onboarding strategico
  POST /api/ai/generate             → Generazione CV (Claude Opus)
  POST /api/ai/ats-score            → ATS scoring (Haiku)
  POST /api/ai/optimize             → Ottimizzazione keyword (Opus)

GENERATED CVs
  GET  /api/cv/generated            → Storico CV generati
  POST /api/cv/generated            → Salva CV generato
```

---

## Schema Database

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255),
  google_id     VARCHAR(255) UNIQUE,
  linkedin_id   VARCHAR(255) UNIQUE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cv_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  label         VARCHAR(100),
  personal      JSONB NOT NULL,
  photo_path    VARCHAR(500),
  experiences   JSONB NOT NULL,
  education     JSONB NOT NULL,
  skills        JSONB NOT NULL,
  languages     JSONB NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE generated_cvs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES cv_profiles(id) ON DELETE CASCADE,
  job_description TEXT NOT NULL,
  target_role   VARCHAR(255),
  target_company VARCHAR(255),
  language      VARCHAR(2) NOT NULL,
  style         VARCHAR(20) NOT NULL,
  generated_data JSONB NOT NULL,
  ats_classic   INTEGER,
  ats_smart     INTEGER,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  sid           VARCHAR(255) PRIMARY KEY,
  sess          JSONB NOT NULL,
  expire        TIMESTAMP NOT NULL
);
```

---

## Onboarding strategico — Prompt analyzer

### Input
- CV strutturato dell'utente (dal profilo)
- Job Description (ruolo target)
- Lingua selezionata

### Output (JSON)
```json
{
  "observations": [
    {
      "type": "incongruence | improve | valorize",
      "severity": "high | medium | low",
      "target": "experience | skill | education | general",
      "target_index": 0,
      "title": "Titolo osservazione",
      "detail": "Spiegazione dettagliata",
      "advice": "Consiglio specifico e actionable",
      "actions": ["remove", "reduce", "keep"] // o ["edit"] o ["apply", "ignore"]
    }
  ],
  "overall_fit": {
    "score": 72,
    "summary": "Valutazione complessiva del fit CV-ruolo"
  }
}
```

### Regole analyzer
1. Analizza OGNI esperienza rispetto al ruolo target
2. Ruolo divergente e non propedeutico → incongruence (high)
3. Ruolo complementare/propedeutico → valorize
4. Bullet generico/senza dati/irrilevante → improve
5. Skills irrilevanti per il target → incongruence (medium)
6. Skills mancanti dalla JD → improve (CHIEDI se l'utente la possiede, mai inventare)
7. Education in campo diverso → suggerisci posizionamento
8. overall_fit.score = stima fit CV-ruolo PRIMA dell'ottimizzazione

---

## Deploy

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [db]
    volumes: [uploads:/app/uploads]
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: cvmaker
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - certs:/etc/letsencrypt
    depends_on: [app]
    restart: unless-stopped

volumes:
  pgdata:
  uploads:
  certs:
```

- Fase 1: test locale (`docker compose up`)
- Fase 2: deploy su droplet, accesso via IP pubblico
- Fase 3: dominio + SSL (quando deciso)
