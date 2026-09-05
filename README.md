# TestSpace

Telegram exam platform for teachers and students — hosted entirely on **Appwrite Cloud**.

## Architecture

```
TestSpace/
├── frontend/          # Teacher dashboard (Vite + React) → Appwrite Site `dashboard`
├── webapp/            # Student Telegram Mini App → Appwrite Site `webapp`
├── functions/api/     # Backend HTTP API → Appwrite Function `api`
│   └── src/
│       ├── main.js        # Router / entry
│       ├── store.js       # TablesDB document store
│       ├── auth.js        # Teacher JWT auth
│       ├── scoring.js     # Marks + exam status
│       ├── ocr.js         # Gemini Photo OCR
│       ├── telegram.js    # Bot webhook helpers
│       └── webappAuth.js  # Telegram WebApp initData validation
├── backend/           # Legacy Express sources (reference only; not deployed)
└── appwrite.json      # Appwrite project metadata
```

## Live endpoints

| Service | URL |
|---------|-----|
| Teacher Dashboard | https://testspace-dashboard.appwrite.network |
| Student Mini App | https://testspace-webapp.appwrite.network |
| API | https://testspace-api.appwrite.network |
| Health | https://testspace-api.appwrite.network/health |

## Environment (Function `api`)

| Variable | Purpose |
|----------|---------|
| `APPWRITE_ENDPOINT` | `https://sgp.cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT_ID` | Project ID |
| `APPWRITE_API_KEY` | Server API key (secret) |
| `APPWRITE_DATABASE_ID` / `APPWRITE_TABLE_ID` | TablesDB |
| `APPWRITE_BUCKET_ID` | Storage |
| `JWT_SECRET` | Teacher tokens |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Photo OCR |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` | Bot + Mini App auth |
| `WEBAPP_URL` | Mini App public URL |

Sites need `VITE_API_URL=https://testspace-api.appwrite.network`.

## Deploy

```bash
# API
appwrite functions create-deployment --function-id api --code ./functions/api \
  --entrypoint src/main.js --commands "npm install" --activate true

# Dashboard
appwrite sites create-deployment --site-id dashboard --code ./frontend \
  --install-command "npm install" --build-command "npm run build" \
  --output-directory dist --activate true

# Mini App
appwrite sites create-deployment --site-id webapp --code ./webapp \
  --install-command "npm install" --build-command "npm run build" \
  --output-directory dist --activate true
```

## Telegram webhook

```
https://testspace-api.appwrite.network/api/telegram/webhook
```

Bot: [@TestxSpace_bot](https://t.me/TestxSpace_bot)
