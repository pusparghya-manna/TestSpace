# TestSpace API — Appwrite Function (converted)

This is **not** a copy of Express `backend/`. It is an Appwrite Function:

- Entry: `src/main.js` (`export default async ({ req, res, log, error })`)
- Data: Appwrite TablesDB (`lib/store.js`)
- Auth: JWT teachers + Telegram Mini App `initData`
- Telegram: Bot HTTP API (`services/telegram.js`)
- OCR: Gemini (`services/ocr.js`)

```
src/
  main.js                 # Appwrite router
  lib/store.js            # TablesDB
  lib/auth.js             # teacher JWT
  lib/scoring.js
  lib/webappAuth.js
  services/ocr.js         # converted from services/geminiOcr.ts
  services/telegram.js    # converted from telegram/bot.ts commands
```

`backend/` remains the original Express source for reference.
