# Security

- JWT auth for teacher API; ownership checks on exams/students/attempts
- Parameterized SQL only
- Telegram webhook secret verification when configured
- Rate limits on auth/OCR
- Secrets never returned in API (`telegramBotToken` masked)
- Production fails boot if JWT/Turso/Telegram env invalid
- Do not commit `.env` or tokens
