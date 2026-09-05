# TestSpace — Student Mini App

Telegram WebApp for students. Talks to the Appwrite-hosted backend (`/api/webapp/*`) with Telegram `initData` auth.

## Setup

1. Deploy as Appwrite Site (or any static host).
2. Set `VITE_API_URL` to your Appwrite Function / API base URL.
3. Set `WEBAPP_URL` on the backend to this Site URL.
4. Configure Telegram bot menu button / web_app URL to this Site.

```bash
npm install
VITE_API_URL=https://YOUR_FUNCTION_URL npm run dev
```
