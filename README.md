# TestSpace

Telegram quiz / exam platform with a multi-teacher dashboard — powered entirely by **Appwrite**.

| Layer | Host | Stack |
|--------|------|--------|
| **Frontend** | Appwrite Sites | React + Vite + Tailwind |
| **Backend / API** | Appwrite Functions | Node + Express-compatible HTTP |
| **Database** | Appwrite Databases | Document collections |
| **Auth** | Appwrite Auth | Email / password sessions |
| **Storage** | Appwrite Storage | Question images & media |
| **OCR** | Google Gemini | Photo → questions JSON |

---

## Environment variables

### Backend (Appwrite Function / local)

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | **Yes** | Token from [@BotFather](https://t.me/BotFather) |
| `APPWRITE_ENDPOINT` | **Yes** | e.g. `https://cloud.appwrite.io/v1` or self-hosted URL |
| `APPWRITE_PROJECT_ID` | **Yes** | Project ID from Appwrite console |
| `APPWRITE_API_KEY` | **Yes** | Server API key with Databases, Storage, Users scopes |
| `APPWRITE_DATABASE_ID` | **Yes** | Database ID (default `testspace`) |
| `JWT_SECRET` | **Yes** | Long random string for auxiliary tokens (≥24 chars) |
| `GEMINI_API_KEY` | **Yes** | Google AI / Gemini API key (photo OCR) |
| `PORT` | No | HTTP port (default `3000`) |
| `GEMINI_MODEL` | No | Model id (default: `gemini-2.0-flash`) |
| `TEACHER_USERNAME` / `TEACHER_PASSWORD` | No | Optional seed teacher (legacy) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `TELEGRAM_POLLING_ENABLED` | No | `true` only for local long-polling; use webhooks in production |
| `APPWRITE_BUCKET_ID` | No | Storage bucket (default `question_images`) |

**Notes**
- Never commit real secrets. Set variables in the Appwrite Function / Sites console.
- Prefer **Appwrite Auth** (email/password) for teachers. Legacy JWT username/password still works during migration.
- Configure a Telegram **webhook** pointing at your Appwrite Function HTTP endpoint (e.g. `/api/telegram/webhook`).

### Frontend (Appwrite Sites)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend Function URL (if not same-origin) |
| `VITE_APPWRITE_ENDPOINT` | Yes | Same as backend |
| `VITE_APPWRITE_PROJECT_ID` | Yes | Project ID |
| `VITE_APPWRITE_DATABASE_ID` | No | Default `testspace` |

---

## Deploy with Appwrite

### 1. Create project
1. Open [Appwrite Cloud](https://cloud.appwrite.io) or self-host Appwrite.
2. Create a project named **TestSpace**.
3. Create a Database with ID `testspace`.
4. Create an API key with scopes: `databases.*`, `storage.*`, `users.*`, `functions.*`.

### 2. Backend — Appwrite Function
1. Deploy the `backend` folder as a Node.js Function (or run the Express server and put a reverse proxy in front).
2. Set all **required** environment variables.
3. Expose HTTP path for API + Telegram webhook.
4. Confirm `GET /health` returns `{"ok":true}`.

On first boot the backend creates collections and storage buckets automatically (via server API key).

### 3. Frontend — Appwrite Sites
1. Deploy the `frontend` (teacher dashboard) and optionally `webapp` (Telegram mini-app) as Sites.
2. Set `VITE_*` variables.
3. Add Site domains to `ALLOWED_ORIGINS` on the backend.

### 4. Teacher access
- Open the Sites URL → **Register** with email/password (Appwrite Auth), or  
- Use seeded `TEACHER_USERNAME` / `TEACHER_PASSWORD` if configured.

---

## Local development

```bash
# Backend
cd backend
cp .env.example .env   # fill in Appwrite + Telegram + Gemini
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
# set VITE_APPWRITE_* and VITE_API_URL=http://localhost:3000
npm run dev
```

---

## Architecture notes

- **Auth**: Appwrite Account sessions for teachers; JWT kept for Telegram webapp validation.
- **Database**: Appwrite document collections mirror the previous schema (exams, questions, attempts, students, …).
- **Storage**: Question diagram images live in the `question_images` bucket.
- **Functions**: Prefer Telegram webhooks over long-polling when running serverless.
- **No Turso / Railway / Vercel** — everything runs on Appwrite.

---

## License / ownership

Project: **TestSpace**

See [SECURITY.md](./SECURITY.md) for security notes.
