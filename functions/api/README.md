# TestSpace API (Appwrite Function)

Node 22 HTTP function. Entry: `src/main.js`.

Modules:
- `store.js` — Appwrite TablesDB entity store (`exam`, `question`, `student`, `attempt`, `teacher`, …)
- `auth.js` — bcrypt + JWT teachers
- `scoring.js` — marking + exam window status
- `ocr.js` — Gemini structured OCR
- `telegram.js` / `webappAuth.js` — bot + Mini App

All routes are path-matched in `main.js` (no Express). CORS is open for dashboard + webapp origins.
