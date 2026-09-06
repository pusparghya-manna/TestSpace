/**
 * Appwrite Databases + Storage client for TestSpace.
 * Replaces Turso/libSQL. Uses node-appwrite server SDK with API key.
 */
import {
  Client,
  Databases,
  Storage,
  Users,
  Account,
  ID,
  Query,
  Permission,
  Role,
  type Models,
} from 'node-appwrite';
import { env } from '../config/env.js';

let client: Client | null = null;
let databases: Databases | null = null;
let storage: Storage | null = null;
let users: Users | null = null;

export function getAppwriteClient(): Client {
  if (client) return client;
  if (!env.appwriteEndpoint || !env.appwriteProjectId || !env.appwriteApiKey) {
    throw new Error(
      'Appwrite is not configured. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY'
    );
  }
  client = new Client()
    .setEndpoint(env.appwriteEndpoint)
    .setProject(env.appwriteProjectId)
    .setKey(env.appwriteApiKey);
  return client;
}

export function getDatabases(): Databases {
  if (!databases) databases = new Databases(getAppwriteClient());
  return databases;
}

export function getStorage(): Storage {
  if (!storage) storage = new Storage(getAppwriteClient());
  return storage;
}

export function getUsers(): Users {
  if (!users) users = new Users(getAppwriteClient());
  return users;
}

export const dbId = () => env.appwriteDatabaseId;
export const COLLECTIONS = {
  teachers: 'teachers',
  exams: 'exams',
  questions: 'questions',
  question_bank: 'question_bank',
  students: 'students',
  student_teachers: 'student_teachers',
  attempts: 'attempts',
  attempt_answers: 'attempt_answers',
  audit_logs: 'audit_logs',
  system_settings: 'system_settings',
  broadcast_jobs: 'broadcast_jobs',
  broadcast_recipients: 'broadcast_recipients',
  telegram_processed_updates: 'telegram_processed_updates',
  schema_meta: 'schema_meta',
} as const;

export const BUCKETS = {
  question_images: 'question_images',
  media: 'media',
} as const;

export { ID, Query, Permission, Role };
export type { Models };

/** Ensure core collections exist (idempotent). Call once on boot. */
export async function ensureAppwriteSchema(): Promise<void> {
  const dbs = getDatabases();
  const databaseId = dbId();

  // Database itself must already exist in Appwrite console (or create via API key).
  try {
    await dbs.get(databaseId);
  } catch {
    await dbs.create(databaseId, 'TestSpace');
    console.log('[appwrite] created database', databaseId);
  }

  const ensureCollection = async (
    id: string,
    name: string,
    attributes: Array<{ key: string; type: string; size?: number; required?: boolean; array?: boolean; default?: any }>
  ) => {
    try {
      await dbs.getCollection(databaseId, id);
    } catch {
      await dbs.createCollection(databaseId, id, name, [
        Permission.read(Role.any()),
        Permission.write(Role.any()),
      ], true);
      console.log('[appwrite] created collection', id);
      for (const attr of attributes) {
        try {
          if (attr.type === 'string') {
            await dbs.createStringAttribute(databaseId, id, attr.key, attr.size || 255, !!attr.required, attr.default, attr.array);
          } else if (attr.type === 'integer') {
            await dbs.createIntegerAttribute(databaseId, id, attr.key, !!attr.required, undefined, undefined, attr.default, attr.array);
          } else if (attr.type === 'float') {
            await dbs.createFloatAttribute(databaseId, id, attr.key, !!attr.required, undefined, undefined, attr.default, attr.array);
          } else if (attr.type === 'boolean') {
            await dbs.createBooleanAttribute(databaseId, id, attr.key, !!attr.required, attr.default, attr.array);
          } else if (attr.type === 'datetime') {
            await dbs.createDatetimeAttribute(databaseId, id, attr.key, !!attr.required, attr.default, attr.array);
          }
        } catch (e: any) {
          // attribute may already exist on retry
          if (!String(e?.message || e).includes('already exists')) {
            console.warn(`[appwrite] attr ${id}.${attr.key}:`, e?.message || e);
          }
        }
      }
      // Appwrite needs a short delay for attributes to become available
      await new Promise((r) => setTimeout(r, 1500));
    }
  };

  await ensureCollection(COLLECTIONS.teachers, 'Teachers', [
    { key: 'username', type: 'string', size: 64, required: true },
    { key: 'name', type: 'string', size: 128, required: true },
    { key: 'password_hash', type: 'string', size: 255, required: false },
    { key: 'email', type: 'string', size: 255, required: false },
    { key: 'firebase_uid', type: 'string', size: 128, required: false },
    { key: 'email_verified', type: 'boolean', required: false, default: false },
    { key: 'auth_provider', type: 'string', size: 32, required: false, default: 'appwrite' },
    { key: 'appwrite_user_id', type: 'string', size: 64, required: false },
    { key: 'created_at', type: 'string', size: 40, required: true },
  ]);

  await ensureCollection(COLLECTIONS.exams, 'Exams', [
    { key: 'teacher_id', type: 'string', size: 64, required: true },
    { key: 'title', type: 'string', size: 255, required: true },
    { key: 'subject', type: 'string', size: 128, required: false },
    { key: 'class_name', type: 'string', size: 64, required: false },
    { key: 'test_number', type: 'string', size: 64, required: false },
    { key: 'total_questions', type: 'integer', required: false, default: 0 },
    { key: 'start_date', type: 'string', size: 40, required: true },
    { key: 'duration_minutes', type: 'integer', required: false, default: 60 },
    { key: 'total_marks', type: 'float', required: false, default: 0 },
    { key: 'negative_marking', type: 'float', required: false, default: 0 },
    { key: 'randomize_questions', type: 'boolean', required: false, default: false },
    { key: 'randomize_options', type: 'boolean', required: false, default: false },
    { key: 'result_visibility', type: 'string', size: 32, required: false, default: 'PUBLISHED' },
    { key: 'leaderboard_visibility', type: 'string', size: 32, required: false, default: 'PUBLISHED' },
    { key: 'status', type: 'string', size: 32, required: false, default: 'SCHEDULED' },
    { key: 'created_at', type: 'string', size: 40, required: true },
    { key: 'updated_at', type: 'string', size: 40, required: true },
  ]);

  await ensureCollection(COLLECTIONS.questions, 'Questions', [
    { key: 'exam_id', type: 'string', size: 64, required: true },
    { key: 'teacher_id', type: 'string', size: 64, required: false },
    { key: 'question', type: 'string', size: 8000, required: true },
    { key: 'options_json', type: 'string', size: 8000, required: false, default: '[]' },
    { key: 'answer', type: 'integer', required: false },
    { key: 'marks', type: 'float', required: false, default: 1 },
    { key: 'negative_marks', type: 'float', required: false, default: 0 },
    { key: 'explanation', type: 'string', size: 4000, required: false },
    { key: 'subject', type: 'string', size: 128, required: false },
    { key: 'sort_order', type: 'integer', required: false, default: 0 },
    { key: 'image_file_id', type: 'string', size: 128, required: false },
    { key: 'image_mime_type', type: 'string', size: 64, required: false },
    { key: 'image_width', type: 'integer', required: false },
    { key: 'image_height', type: 'integer', required: false },
  ]);

  await ensureCollection(COLLECTIONS.question_bank, 'Question Bank', [
    { key: 'teacher_id', type: 'string', size: 64, required: true },
    { key: 'question', type: 'string', size: 8000, required: true },
    { key: 'options_json', type: 'string', size: 8000, required: false, default: '[]' },
    { key: 'answer', type: 'integer', required: false },
    { key: 'marks', type: 'float', required: false, default: 1 },
    { key: 'negative_marks', type: 'float', required: false, default: 0 },
    { key: 'explanation', type: 'string', size: 4000, required: false },
    { key: 'subject', type: 'string', size: 128, required: false },
    { key: 'image_file_id', type: 'string', size: 128, required: false },
    { key: 'image_mime_type', type: 'string', size: 64, required: false },
    { key: 'image_width', type: 'integer', required: false },
    { key: 'image_height', type: 'integer', required: false },
  ]);

  await ensureCollection(COLLECTIONS.students, 'Students', [
    { key: 'student_code', type: 'string', size: 64, required: true },
    { key: 'name', type: 'string', size: 128, required: true },
    { key: 'class_name', type: 'string', size: 64, required: false },
    { key: 'telegram_user_id', type: 'integer', required: false },
    { key: 'telegram_username', type: 'string', size: 64, required: false },
    { key: 'link_code', type: 'string', size: 32, required: false },
    { key: 'status', type: 'string', size: 32, required: false, default: 'ACTIVE' },
    { key: 'joined_at', type: 'string', size: 40, required: false },
  ]);

  await ensureCollection(COLLECTIONS.student_teachers, 'Student Teachers', [
    { key: 'student_id', type: 'string', size: 64, required: true },
    { key: 'teacher_id', type: 'string', size: 64, required: true },
  ]);

  await ensureCollection(COLLECTIONS.attempts, 'Attempts', [
    { key: 'exam_id', type: 'string', size: 64, required: true },
    { key: 'student_id', type: 'string', size: 64, required: false },
    { key: 'telegram_user_id', type: 'integer', required: true },
    { key: 'student_name', type: 'string', size: 128, required: false },
    { key: 'student_class', type: 'string', size: 64, required: false },
    { key: 'started_at', type: 'string', size: 40, required: true },
    { key: 'expires_at', type: 'string', size: 40, required: true },
    { key: 'paused_at', type: 'string', size: 40, required: false },
    { key: 'paused_seconds', type: 'integer', required: false, default: 0 },
    { key: 'submitted_at', type: 'string', size: 40, required: false },
    { key: 'status', type: 'string', size: 32, required: true },
    { key: 'current_question_index', type: 'integer', required: false, default: 0 },
    { key: 'score', type: 'float', required: false, default: 0 },
    { key: 'max_score', type: 'float', required: false, default: 0 },
    { key: 'percentage', type: 'float', required: false, default: 0 },
    { key: 'correct_count', type: 'integer', required: false, default: 0 },
    { key: 'wrong_count', type: 'integer', required: false, default: 0 },
    { key: 'skipped_count', type: 'integer', required: false, default: 0 },
    { key: 'time_taken_seconds', type: 'integer', required: false, default: 0 },
    { key: 'rank', type: 'integer', required: false },
    { key: 'is_official', type: 'boolean', required: false, default: true },
    { key: 'attempt_number', type: 'integer', required: false, default: 1 },
  ]);

  await ensureCollection(COLLECTIONS.attempt_answers, 'Attempt Answers', [
    { key: 'attempt_id', type: 'string', size: 64, required: true },
    { key: 'question_id', type: 'string', size: 64, required: true },
    { key: 'option_index', type: 'integer', required: true },
    { key: 'updated_at', type: 'string', size: 40, required: false },
  ]);

  await ensureCollection(COLLECTIONS.audit_logs, 'Audit Logs', [
    { key: 'timestamp', type: 'string', size: 40, required: true },
    { key: 'action', type: 'string', size: 128, required: true },
    { key: 'details', type: 'string', size: 4000, required: false },
    { key: 'actor', type: 'string', size: 128, required: false },
    { key: 'teacher_id', type: 'string', size: 64, required: false },
  ]);

  await ensureCollection(COLLECTIONS.system_settings, 'System Settings', [
    { key: 'bot_username', type: 'string', size: 64, required: false },
    { key: 'system_notice', type: 'string', size: 2000, required: false },
    { key: 'bot_active', type: 'boolean', required: false, default: true },
    { key: 'auto_publish_results', type: 'boolean', required: false, default: true },
    { key: 'webhook_url', type: 'string', size: 512, required: false },
    { key: 'telegram_bot_token', type: 'string', size: 128, required: false },
  ]);

  await ensureCollection(COLLECTIONS.broadcast_jobs, 'Broadcast Jobs', [
    { key: 'teacher_id', type: 'string', size: 64, required: true },
    { key: 'message', type: 'string', size: 4000, required: true },
    { key: 'status', type: 'string', size: 32, required: false, default: 'pending' },
    { key: 'total', type: 'integer', required: false, default: 0 },
    { key: 'sent', type: 'integer', required: false, default: 0 },
    { key: 'failed', type: 'integer', required: false, default: 0 },
    { key: 'created_at', type: 'string', size: 40, required: true },
    { key: 'finished_at', type: 'string', size: 40, required: false },
  ]);

  await ensureCollection(COLLECTIONS.broadcast_recipients, 'Broadcast Recipients', [
    { key: 'job_id', type: 'string', size: 64, required: true },
    { key: 'telegram_user_id', type: 'integer', required: true },
    { key: 'status', type: 'string', size: 32, required: false, default: 'pending' },
    { key: 'error', type: 'string', size: 512, required: false },
  ]);

  await ensureCollection(COLLECTIONS.telegram_processed_updates, 'Telegram Processed Updates', [
    { key: 'update_id', type: 'integer', required: true },
    { key: 'processed_at', type: 'string', size: 40, required: true },
  ]);

  await ensureCollection(COLLECTIONS.schema_meta, 'Schema Meta', [
    { key: 'value', type: 'string', size: 512, required: true },
  ]);

  // Storage buckets
  const st = getStorage();
  for (const [key, bucketId] of Object.entries(BUCKETS)) {
    try {
      await st.getBucket(bucketId);
    } catch {
      await st.createBucket(bucketId, key, [
        Permission.read(Role.any()),
        Permission.write(Role.any()),
      ], false, true, undefined, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf']);
      console.log('[appwrite] created bucket', bucketId);
    }
  }

  console.log('[appwrite] schema ready');
}
