# Security — TestSpace (Appwrite)

- Production fails boot if JWT / Appwrite / Telegram env is invalid
- Server API key never exposed to the browser
- Prefer Appwrite Auth sessions; JWT only for auxiliary Telegram webapp tokens
- Telegram webhook secret validated when webhooks are enabled
