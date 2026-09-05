import dotenv from 'dotenv';
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] || fallback;
  if (!v) {
    console.warn(`[config] Missing ${name}`);
  }
  return v || '';
}

const isProd = process.env.NODE_ENV === 'production' || !!process.env.APPWRITE_FUNCTION_ID;

/** JWT secret — still used for short-lived webapp / telegram session tokens when needed */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.APPWRITE_API_KEY || '';
  if (secret.length >= 24) return secret;
  if (isProd) {
    console.error('[security] FATAL: JWT_SECRET must be set to a long random string (≥24 chars) in production');
    process.exit(1);
  }
  return secret || 'dev-only-jwt-secret-change-me-testspace';
}

/**
 * Validate production-required env vars for Appwrite deployment.
 */
export function assertSecureConfig(): void {
  if (!isProd) return;

  getJwtSecret();

  const missing: string[] = [];
  if (!process.env.APPWRITE_ENDPOINT?.trim()) missing.push('APPWRITE_ENDPOINT');
  if (!process.env.APPWRITE_PROJECT_ID?.trim()) missing.push('APPWRITE_PROJECT_ID');
  if (!process.env.APPWRITE_API_KEY?.trim()) missing.push('APPWRITE_API_KEY');
  if (!process.env.APPWRITE_DATABASE_ID?.trim()) missing.push('APPWRITE_DATABASE_ID');
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) missing.push('TELEGRAM_BOT_TOKEN');

  if (missing.length) {
    console.error(`[config] FATAL: Missing required production env: ${missing.join(', ')}`);
    process.exit(1);
  }

  const port = Number(process.env.PORT);
  if (process.env.PORT && (!Number.isFinite(port) || port <= 0)) {
    console.error(`[config] FATAL: Invalid PORT="${process.env.PORT}"`);
    process.exit(1);
  }
}

export const env = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  /** Appwrite */
  appwriteEndpoint: process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  appwriteProjectId: process.env.APPWRITE_PROJECT_ID || '',
  appwriteApiKey: process.env.APPWRITE_API_KEY || '',
  appwriteDatabaseId: process.env.APPWRITE_DATABASE_ID || 'testspace',
  appwriteBucketId: process.env.APPWRITE_BUCKET_ID || 'question_images',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ||
    'http://localhost:5173,http://localhost:3000,https://cloud.appwrite.io')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  teacherUsername: process.env.TEACHER_USERNAME || '',
  teacherPassword: process.env.TEACHER_PASSWORD || '',
  teacherName: process.env.TEACHER_NAME || '',
  maxOcrBase64Chars: Number(process.env.MAX_OCR_BASE64_CHARS) || 10_000_000,
  maxMessageLength: Number(process.env.MAX_MESSAGE_LENGTH) || 3500,
  enableDangerousReseed: process.env.ENABLE_RESEED === 'true',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  /** Prefer webhooks on Appwrite Functions; polling optional for local/dev */
  telegramPollingEnabled: process.env.TELEGRAM_POLLING_ENABLED === 'true',
  /** Legacy Firebase fields kept for migration compatibility (disabled by default) */
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || '',
  firebaseWebApiKey: process.env.FIREBASE_WEB_API_KEY || '',
};

export function corsOriginDelegate(
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean | string) => void
) {
  if (!origin) return cb(null, true);
  if (env.allowedOrigins.includes(origin) || env.allowedOrigins.includes('*')) {
    return cb(null, origin);
  }
  if (
    /^https:\/\/[a-z0-9-]+\.appwrite\.network$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.appwrite\.io$/i.test(origin) ||
    /^https:\/\/cloud\.appwrite\.io$/i.test(origin)
  ) {
    return cb(null, origin);
  }
  console.warn('[cors] Blocked origin:', origin);
  return cb(null, false);
}
