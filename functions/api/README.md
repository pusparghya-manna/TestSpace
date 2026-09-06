# TestSpace API — Appwrite Function

## Directory layout (mirrors `backend/`)

```
functions/api/
├── src/                    # Full backend TypeScript (same modules as backend/src)
│   ├── api/                # server.ts, webappRoutes.ts, middleware/
│   ├── services/           # geminiOcr.ts (full prompts), scoring, media
│   ├── telegram/           # bot, polling, webappAuth, …
│   ├── repositories/
│   ├── database/           # Appwrite Databases document client
│   ├── store.ts, auth.ts, config/, jobs/, cache/, types/, utils/
│   └── …
├── runtime/                # Live production entry (TablesDB HTTP API)
│   ├── main.js             # Deployed entrypoint
│   ├── store.js, auth.js, scoring.js, ocr.js, telegram.js, webappAuth.js
│   └── package.json
└── README.md
```

### Live deployment

- **Entrypoint:** `runtime/main.js`
- **Storage:** Appwrite TablesDB (`entity` / `record_id` / `payload`)
- **Features:** teacher auth, exams, questions, OCR, students, results, full webapp lifecycle, Telegram webhook

### Full Express (`src/`)

Identical to `backend/src`. Deploying it requires API key scopes for **Databases collections**.  
Until those scopes exist on the project key, production uses `runtime/`.
