# Deployment — Appwrite only

1. Create Appwrite project + database `testspace` + API key.
2. Deploy backend as Appwrite Function (Node) or long-running Node process with Appwrite env vars.
3. Deploy frontend/webapp as Appwrite Sites.
4. Point Telegram webhook at Function URL `/api/telegram/webhook`.
5. Set CORS / ALLOWED_ORIGINS to Sites domains.

Do not use Railway, Vercel, or Turso.
