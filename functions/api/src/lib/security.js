const isProd = () =>
  !!(process.env.APPWRITE_FUNCTION_ID || process.env.NODE_ENV === 'production');

export function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (secret.length >= 24) return secret;
  if (isProd()) {
    throw new Error('JWT_SECRET must be set to a random string of at least 24 characters');
  }
  console.warn('[security] JWT_SECRET weak or missing — dev only');
  return secret || 'dev-only-jwt-secret-change-me-now!!';
}

export function assertProductionSecrets() {
  if (!isProd()) return;
  getJwtSecret();
  if (!String(process.env.TELEGRAM_BOT_TOKEN || '').trim()) {
    throw new Error('TELEGRAM_BOT_TOKEN is required in production');
  }
  if (!String(process.env.APPWRITE_API_KEY || '').trim()) {
    throw new Error('APPWRITE_API_KEY is required in production');
  }
}

export function corsHeaders(req) {
  const raw = req?.headers || {};
  const origin = String(
    raw.origin || raw.Origin ||
    (typeof raw.get === 'function' ? raw.get('origin') : '') ||
    ''
  );
  const allowed = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = [
    'https://testspace-dashboard.appwrite.network',
    'https://testspace-webapp.appwrite.network',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  const list = allowed.length ? allowed : defaults;
  const ok =
    !origin ||
    list.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.appwrite\.network$/i.test(origin) ||
    /^https:\/\/web\.telegram\.org$/i.test(origin) ||
    origin === 'null';
  const allowOrigin = origin && ok ? origin : list[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Telegram-Init-Data, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Simple in-memory rate limit (per isolate). */
const buckets = new Map();
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    b = { start: now, n: 0 };
    buckets.set(key, b);
  }
  b.n += 1;
  return b.n <= limit;
}
