# Quiz Bot Student Mini App

Telegram WebApp for students. Talks to the Railway backend (`/api/webapp/*`) with Telegram `initData` auth. **No mock exams or leaderboards.**

Stable production URL: `https://quiz-bot-webapp-tg.vercel.app/`

## Deploy (Vercel)

1. New Vercel project from this repo
2. **Root Directory:** `webapp`
3. Install: `npm install`
4. Build: `npm run build`
5. Output: `dist`
6. Env: `VITE_API_URL=https://quiz-bot-by-pusparghya-production.up.railway.app`

## Local

```bash
cd webapp
npm install
VITE_API_URL=https://quiz-bot-by-pusparghya-production.up.railway.app npm run dev
```

Open from Telegram (initData required for real data). Railway must have `WEBAPP_URL` set to this Vercel URL.
