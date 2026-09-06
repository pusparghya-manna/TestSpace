# TestSpace API — Appwrite Function (production)

**Entrypoint:** `src/main.js`  
**Version:** 4.0.0

```
src/
  main.js                 # HTTP router (Appwrite Function entry)
  lib/
    store.js              # TablesDB entity store
    auth.js               # Teacher JWT + bcrypt
    security.js           # JWT secret, CORS, rate limit
    ownership.js          # Teacher resource ownership
    scoring.js            # Score, timer, ranks
    webappAuth.js         # Telegram initData HMAC + auth_date
  services/
    ocr.js                # Gemini OCR parse
    media.js              # Appwrite Storage upload + crop (sharp)
    telegram.js           # Bot + broadcast job processor
  __tests__/
    parity.unit.test.js
```

`runtime/` is deprecated. `backend/` is reference-only (not deployed).

## Cron

`POST /api/cron/sweep` with header `X-Cron-Secret: <CRON_SECRET or JWT_SECRET>`  
Finalizes expired attempts and processes pending broadcasts.
