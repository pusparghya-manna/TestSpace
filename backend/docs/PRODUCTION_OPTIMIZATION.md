# Production optimization (main branch)

## Completed

### Database (normalized + safe migration)
- Tables: `exams`, `questions`, `students`, `student_teachers`, `attempts`, `attempt_answers`, `audit_logs`, `system_settings`, `question_bank`, `broadcast_jobs`, `app_data_backup`
- **Legacy `app_data` JSON blobs are never deleted**
- First boot with empty tables + existing blobs runs idempotent migration + backup snapshot
- Manual: `cd backend && npm run db:migrate`

### Memory / startup
- Startup runs schema ensure + optional migration
- Loads normalized SQL into store (teacher app + Telegram still use sync store API)
- Submitted attempt **answers** are not all loaded into memory; loaded on demand for detail views
- In-progress answers remain in memory for exam resume

### Telegram
- All outbound text via `sendSafeTelegramMessage` (`telegram/safeSend.ts`)
- `splitTelegramMessage` (~4000 chars), timeouts (12s), retries, 429 backoff
- Tests for 4095–50000 character messages

### Broadcast
- `POST /api/broadcast` **queues** and returns immediately
- Background worker rate-limits sends (~45ms gap)

### Ranking
- `updateExamRanks` runs on submit / attempt changes only (not on every results page open)
- Ranks persisted to SQL via `saveAttempt`

### APIs
- Teacher-scoped `/api/data` (compatibility)
- `GET /api/results?examId=&page=&limit=&practice=0|1` (paginated, slim rows)
- Attempt detail loads answers from SQL if missing in memory

### Security preserved
- Auth, ownership checks, webhook secret, simulate disabled in prod, rate limits

## Rollback
1. Keep using `app_data` / `app_data_backup` rows (never dropped by migration)
2. Redeploy previous git revision if needed
3. Normalized tables can be ignored; re-run migration is idempotent (`ON CONFLICT`)

## Verify
```bash
cd backend && npm test
```
