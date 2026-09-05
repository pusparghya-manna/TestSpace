import { splitTelegramMessage } from '../utils/telegramSplit.js';
import { SCHEMA_SQL } from '../database/schema.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS exams'), 'exams table');
assert(SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS attempts'), 'attempts table');
assert(SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS attempt_answers'), 'answers table');
assert(SCHEMA_SQL.includes('app_data_backup'), 'backup table');
assert(SCHEMA_SQL.includes('broadcast_jobs'), 'broadcast jobs');
const migrationSource = readFileSync(
  fileURLToPath(new URL('../database/migrateFromBlobs.ts', import.meta.url)),
  'utf8',
);
assert(migrationSource.includes('status, joined_at'), 'student migration uses joined_at');
assert(!migrationSource.includes('status, linked_at'), 'student migration must not use linked_at');

const huge = 'A'.repeat(50000);
const chunks = splitTelegramMessage(huge);
assert(chunks.length >= 12, 'expected many chunks');
assert(chunks.every((c) => c.length <= 4000), 'over limit');

console.log('migration.smoke tests passed');
