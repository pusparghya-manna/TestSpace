/**
 * TestSpace Backend v5.1 — Appwrite Function entry
 * Modular routes. No Telegram. No Railway.
 */
import { store } from './repositories/store.js';
import { secondsLeft } from './services/scoring.js';
import { corsHeaders, getJwtSecret } from './middleware/security.js';
import { json, parseBody, getPath } from './utils/http.js';
import { handleTeacherAuth } from './routes/auth/teacher.js';
import { handleStudentAuth } from './routes/student/auth.js';
import { handleStudentExams } from './routes/student/exams.js';
import { handleTeacherRoutes } from './routes/teacher/index.js';

async function finalizeExpiredAttempt(attempt) {
  if (!attempt || attempt.status !== 'IN_PROGRESS') return attempt;
  if (secondsLeft(attempt) > 0) return attempt;
  const { calculateAttemptScore } = await import('./services/scoring.js');
  const exam = await store.getExamById(attempt.examId);
  if (exam && !exam.questions?.length) exam.questions = await store.getQuestions(exam.id);
  const started = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
  const timeTaken = Math.max(0, Math.floor((Date.now() - started) / 1000) - Number(attempt.pausedSeconds || 0));
  const stats = calculateAttemptScore(exam, attempt.answers || {}, timeTaken);
  Object.assign(attempt, stats, {
    status: 'AUTO_SUBMITTED',
    submittedAt: new Date().toISOString(),
    timeTakenSeconds: timeTaken,
  });
  await store.saveAttempt(attempt);
  return attempt;
}

export default async ({ req, res, log, error }) => {
  const trigger = String(req.headers?.['x-appwrite-trigger'] || req.headers?.['X-Appwrite-Trigger'] || '').toLowerCase();
  if (trigger === 'schedule' || trigger === 'timer') {
    try {
      let finalized = 0;
      for (const a of await store.getAttempts()) {
        if (a.status === 'IN_PROGRESS' && secondsLeft(a) <= 0) {
          await finalizeExpiredAttempt(a);
          finalized++;
        }
      }
      return json(res, 200, { ok: true, source: 'schedule', finalized });
    } catch (e) {
      error(String(e?.message || e));
      return json(res, 500, { error: 'schedule failed' });
    }
  }

  if ((req.method || '').toUpperCase() === 'OPTIONS') {
    return res.text('', 204, corsHeaders(req));
  }

  const method = (req.method || 'GET').toUpperCase();
  const path = getPath(req);
  const body = parseBody(req);
  log(`${method} ${path}`);

  try {
    try {
      getJwtSecret();
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }

    if (path === '/api/cron/sweep' && method === 'POST') {
      const secret = String(process.env.CRON_SECRET || '').trim();
      const hdr = String(req.headers?.['x-cron-secret'] || req.headers?.['X-Cron-Secret'] || '').trim();
      if (!secret || hdr !== secret) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
      let finalized = 0;
      for (const a of await store.getAttempts()) {
        if (a.status === 'IN_PROGRESS' && secondsLeft(a) <= 0) {
          await finalizeExpiredAttempt(a);
          finalized++;
        }
      }
      return json(res, 200, { ok: true, finalized }, req);
    }

    if ((path === '/' || path === '/health') && method === 'GET') {
      return json(
        res,
        200,
        {
          ok: true,
          service: 'testspace-backend',
          version: '5.1.0',
          architecture: ['teacher', 'student', 'backend'],
          features: ['teacher-auth', 'student-auth', 'student-google-auth', 'exams', 'questions', 'ocr', 'results'],
          ocrConfigured: !!process.env.GEMINI_API_KEY,
          googleAuthConfigured: !!(process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLIENT_ID),
        },
        req
      );
    }

    // Deprecated Telegram / Mini App
    if (path.startsWith('/api/telegram') || path.startsWith('/api/webapp')) {
      return json(res, 410, { error: 'Telegram APIs removed. Use /api/student/* with email or Google login.' }, req);
    }
    if (path === '/api/auth/firebase/exchange' && method === 'POST') {
      // Teachers: redirect intention — students use /api/student/auth/google
      return json(res, 410, { error: 'Use /api/student/auth/google for student Google login.' }, req);
    }

    let handled =
      (await handleTeacherAuth(method, path, body, req, res)) ||
      (await handleStudentAuth(method, path, body, req, res)) ||
      (await handleStudentExams(method, path, body, req, res)) ||
      (await handleTeacherRoutes(method, path, body, req, res));

    if (handled) return handled;
    return json(res, 404, { error: 'Not found', path, method }, req);
  } catch (e) {
    error(String(e?.stack || e?.message || e));
    return json(res, 500, { error: 'Internal server error' }, req);
  }
};
