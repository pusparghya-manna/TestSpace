# Security — TestSpace

- Secrets only in Appwrite Function / Sites environment variables.
- Prefer Appwrite Auth sessions for teachers.
- Telegram webhook secret should be validated when using webhooks.
- API key must never be exposed to the browser; client uses only project ID + endpoint.
