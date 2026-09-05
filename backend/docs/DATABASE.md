# Database

## Source of truth
Appwrite Databases (document collections). Schema is created automatically on first boot via server API key.

## Layers
HTTP/Telegram → services → repositories → Appwrite Documents API

## Collections
- teachers, exams, questions, question_bank
- students, student_teachers
- attempts, attempt_answers
- audit_logs, system_settings
- broadcast_jobs, broadcast_recipients
- telegram_processed_updates, schema_meta

## Storage buckets
- `question_images` — diagram / OCR source images
- `media` — general assets

## Compatibility
Legacy SQL-style `db.execute` / `withWriteTx` are stubs. Prefer `listDocs`, `getDoc`, `createDoc`, `updateDoc`, `deleteDoc` from `database/client.ts`.
