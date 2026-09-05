/**
 * TestSpace API — full Appwrite Function port of Quiz Bot backend
 */
import { ID } from 'node-appwrite';
import { store } from './store.js';
import { registerTeacher, loginTeacher, teacherFromHeaders } from './auth.js';
import { effectiveExamStatus, withEffectiveStatus, calculateAttemptScore, secondsLeft } from './scoring.js';
import { parseQuestionsFromMedia } from './ocr.js';
import { validateTelegramWebAppData } from './webappAuth.js';
import { processTelegramUpdate, sendMessage } from './telegram.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Init-Data',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

function json(res, status, body) {
  return res.json(body, status, CORS);
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function requireTeacher(req, res) {
  const t = teacherFromHeaders(req.headers || {});
  if (!t) {
    json(res, 401, { error: 'Unauthorized' });
    return null;
  }
  return t;
}

function match(path, pattern) {
  const pp = pattern.split('/').filter(Boolean);
  const sp = path.split('/').filter(Boolean);
  if (pp.length !== sp.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(sp[i]);
    else if (pp[i] !== sp[i]) return null;
  }
  return params;
}

async function finalizeExpiredAttempt(attempt) {
  if (!attempt || attempt.status !== 'IN_PROGRESS') return attempt;
  if (secondsLeft(attempt) > 0) return attempt;
  const exam = await store.getExamById(attempt.examId);
  const stats = calculateAttemptScore(exam, attempt.answers || {}, attempt.timeTakenSeconds || 0);
  Object.assign(attempt, stats, {
    status: 'AUTO_SUBMITTED',
    submittedAt: new Date().toISOString(),
  });
  await store.saveAttempt(attempt);
  return attempt;
}

function authWebapp(req, res) {
  const headers = req.headers || {};
  const body = parseBody(req);
  const initData =
    headers['x-telegram-init-data'] ||
    headers['X-Telegram-Init-Data'] ||
    body.initData ||
    body.tgWebAppData ||
    '';
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!botToken) {
    // Dev fallback: accept explicit telegramUserId only when bot token missing (not ideal)
    const uid = Number(body.telegramUserId || headers['x-telegram-user-id'] || 0);
    if (uid) return { userId: uid, user: { id: uid, first_name: 'Student' } };
    json(res, 503, { error: 'TELEGRAM_BOT_TOKEN not configured' });
    return null;
  }
  const auth = validateTelegramWebAppData(String(initData), botToken);
  if (!auth) {
    json(res, 401, { error: 'Invalid Telegram WebApp auth' });
    return null;
  }
  return auth;
}

export default async ({ req, res, log, error }) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});

  const method = (req.method || 'GET').toUpperCase();
  let path = req.path || '/';
  // Appwrite may pass path without leading structure
  if (!path.startsWith('/')) path = '/' + path;
  path = path.replace(/\/+$/, '') || '/';
  const body = parseBody(req);
  log(`${method} ${path}`);

  try {
    // Health
    if ((path === '/' || path === '/health') && method === 'GET') {
      return json(res, 200, {
        ok: true,
        service: 'testspace-api',
        version: '2.0.0',
        features: ['auth', 'exams', 'questions', 'students', 'results', 'ocr', 'webapp', 'telegram'],
        ocrConfigured: !!process.env.GEMINI_API_KEY,
        telegramConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
      });
    }
    if (path === '/ready' && method === 'GET') {
      await store.getSettings();
      return json(res, 200, { ok: true, ready: true });
    }

    // ---------- AUTH ----------
    if (path === '/api/auth/register' && method === 'POST') {
      try {
        const out = await registerTeacher(body.username, body.password, body.name, body.email);
        await store.addAuditLog('TEACHER_REGISTER', `Registered ${out.teacher.username}`, out.teacher.username);
        return json(res, 201, out);
      } catch (e) {
        return json(res, e.status || 400, { error: e.message });
      }
    }
    if (path === '/api/auth/login' && method === 'POST') {
      try {
        const out = await loginTeacher(body.username || body.email, body.password);
        return json(res, 200, out);
      } catch (e) {
        return json(res, e.status || 401, { error: e.message });
      }
    }
    if (path === '/api/auth/me' && method === 'GET') {
      const t = teacherFromHeaders(req.headers || {});
      if (!t) return json(res, 401, { error: 'Unauthorized' });
      return json(res, 200, { teacher: t });
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      return json(res, 200, { ok: true });
    }
    if (path === '/api/auth/forgot-password' && method === 'POST') {
      return json(res, 200, { ok: true, message: 'If an account exists, reset instructions were sent.' });
    }
    if (path === '/api/auth/firebase/exchange' && method === 'POST') {
      return json(res, 501, { error: 'Firebase auth not configured on Appwrite deployment' });
    }

    // ---------- DASHBOARD DATA ----------
    if (path === '/api/data' && method === 'GET') {
      const t = requireTeacher(req, res);
      if (!t) return;
      const [exams, students, attempts, settings] = await Promise.all([
        store.getExams(),
        store.getStudents(),
        store.getAttempts(),
        store.getSettings(),
      ]);
      const myExams = exams.filter((e) => !e.teacherId || e.teacherId === t.username).map(withEffectiveStatus);
      const myExamIds = new Set(myExams.map((e) => e.id));
      const myAttempts = attempts.filter((a) => myExamIds.has(a.examId));
      const myStudents = students.filter(
        (s) => !s.teacherIds?.length || s.teacherIds.includes(t.username)
      );
      return json(res, 200, {
        exams: myExams,
        students: myStudents,
        attempts: myAttempts,
        settings,
        teacher: t,
      });
    }

    if (path === '/api/dashboard/summary' && method === 'GET') {
      const t = requireTeacher(req, res);
      if (!t) return;
      const exams = (await store.getExams()).filter((e) => !e.teacherId || e.teacherId === t.username);
      const attempts = await store.getAttempts();
      const myIds = new Set(exams.map((e) => e.id));
      const myAttempts = attempts.filter((a) => myIds.has(a.examId));
      const students = await store.getStudents();
      return json(res, 200, {
        examCount: exams.length,
        liveCount: exams.filter((e) => effectiveExamStatus(e) === 'LIVE').length,
        studentCount: students.length,
        attemptCount: myAttempts.length,
        submittedCount: myAttempts.filter((a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED').length,
      });
    }

    if (path === '/api/stats' && method === 'GET') {
      const exams = await store.getExams();
      const students = await store.getStudents();
      const attempts = await store.getAttempts();
      return json(res, 200, {
        exams: exams.length,
        students: students.length,
        attempts: attempts.length,
      });
    }

    // ---------- EXAMS ----------
    if (path === '/api/exams' && method === 'GET') {
      const t = teacherFromHeaders(req.headers || {});
      let exams = await store.getExams();
      if (t) exams = exams.filter((e) => !e.teacherId || e.teacherId === t.username);
      return json(res, 200, { exams: exams.map(withEffectiveStatus) });
    }

    {
      const m = match(path, '/api/exams/:id');
      if (m && method === 'GET') {
        const exam = await store.getExamById(m.id);
        if (!exam) return json(res, 404, { error: 'Exam not found' });
        return json(res, 200, withEffectiveStatus(exam));
      }
      if (m && method === 'PUT') {
        const t = requireTeacher(req, res);
        if (!t) return;
        const exam = await store.getExamById(m.id);
        if (!exam) return json(res, 404, { error: 'Exam not found' });
        if (exam.teacherId && exam.teacherId !== t.username) return json(res, 403, { error: 'Not your exam' });
        const updated = {
          ...exam,
          ...body,
          id: exam.id,
          teacherId: exam.teacherId || t.username,
          totalQuestions: body.questions ? body.questions.length : exam.totalQuestions,
          updatedAt: new Date().toISOString(),
        };
        updated.status = effectiveExamStatus(updated);
        await store.saveExam(updated);
        await store.addAuditLog('EXAM_UPDATED', `Updated exam "${updated.title}"`, t.username);
        return json(res, 200, withEffectiveStatus(updated));
      }
      if (m && method === 'DELETE') {
        const t = requireTeacher(req, res);
        if (!t) return;
        const exam = await store.getExamById(m.id);
        if (!exam) return json(res, 404, { error: 'Exam not found' });
        if (exam.teacherId && exam.teacherId !== t.username) return json(res, 403, { error: 'Not your exam' });
        await store.deleteExam(m.id);
        await store.addAuditLog('EXAM_DELETED', `Deleted exam "${exam.title}"`, t.username);
        return json(res, 200, { success: true });
      }
    }

    if (path === '/api/exams' && method === 'POST') {
      const t = requireTeacher(req, res);
      if (!t) return;
      const exam = body.exam || body;
      if (!exam.title) return json(res, 400, { error: 'title required' });
      exam.id = exam.id || ID.unique();
      exam.teacherId = t.username;
      exam.questions = Array.isArray(exam.questions) ? exam.questions : [];
      exam.totalQuestions = exam.questions.length;
      exam.createdAt = exam.createdAt || new Date().toISOString();
      exam.updatedAt = new Date().toISOString();
      exam.status = effectiveExamStatus(exam);
      // ensure question ids
      exam.questions = exam.questions.map((q, i) => ({
        ...q,
        id: q.id || ID.unique(),
        examId: exam.id,
        sort_order: i,
      }));
      await store.saveExam(exam);
      for (const q of exam.questions) await store.saveQuestion(q);
      await store.addAuditLog('EXAM_CREATED', `Created exam "${exam.title}"`, t.username);
      return json(res, 200, withEffectiveStatus(exam));
    }

    {
      const m = match(path, '/api/exams/:id/recalculate');
      if (m && method === 'POST') {
        const t = requireTeacher(req, res);
        if (!t) return;
        const exam = await store.getExamById(m.id);
        if (!exam) return json(res, 404, { error: 'Exam not found' });
        const attempts = await store.getAttempts(exam.id);
        for (const att of attempts) {
          if (att.status !== 'SUBMITTED' && att.status !== 'AUTO_SUBMITTED') continue;
          const stats = calculateAttemptScore(exam, att.answers || {}, att.timeTakenSeconds || 0);
          Object.assign(att, stats);
          await store.saveAttempt(att);
        }
        return json(res, 200, { ok: true, recalculated: attempts.length });
      }
    }

    // ---------- QUESTIONS ----------
    if (path === '/api/questions' && method === 'GET') {
      const qs = await store.getQuestions();
      return json(res, 200, { questions: qs });
    }
    if (path === '/api/questions' && method === 'POST') {
      const t = requireTeacher(req, res);
      if (!t) return;
      const q = body.question || body;
      q.id = q.id || ID.unique();
      q.teacherId = t.username;
      await store.saveQuestion(q);
      return json(res, 200, { question: q });
    }
    {
      const m = match(path, '/api/questions/:id');
      if (m && method === 'PUT') {
        const t = requireTeacher(req, res);
        if (!t) return;
        const existing = await store.getQuestions().then((qs) => qs.find((x) => x.id === m.id));
        if (!existing) return json(res, 404, { error: 'Not found' });
        const q = { ...existing, ...body, id: m.id };
        await store.saveQuestion(q);
        return json(res, 200, { question: q });
      }
      if (m && method === 'DELETE') {
        const t = requireTeacher(req, res);
        if (!t) return;
        await store.deleteQuestion(m.id);
        return json(res, 200, { success: true });
      }
    }
    if (path === '/api/questions/import-json' && method === 'POST') {
      const t = requireTeacher(req, res);
      if (!t) return;
      const list = Array.isArray(body.questions) ? body.questions : [];
      const saved = [];
      for (const raw of list) {
        const q = {
          id: ID.unique(),
          teacherId: t.username,
          question: raw.question || raw.text || '',
          options: raw.options || [],
          answer: raw.answer ?? null,
          marks: raw.marks ?? 1,
          negativeMarks: raw.negativeMarks ?? 0,
          subject: raw.subject || '',
        };
        await store.saveQuestion(q);
        saved.push(q);
      }
      return json(res, 200, { questions: saved, count: saved.length });
    }

    // ---------- OCR ----------
    if (path === '/api/ocr/parse' && method === 'POST') {
      const t = requireTeacher(req, res);
      if (!t) return;
      let fileBase64 = String(body.fileBase64 || body.image || body.base64 || '');
      if (fileBase64.includes(',')) fileBase64 = fileBase64.split(',').pop() || '';
      if (!fileBase64) return json(res, 400, { error: 'fileBase64 required' });
      if (fileBase64.length > Number(process.env.MAX_OCR_BASE64_CHARS || 10_000_000)) {
        return json(res, 413, { error: 'Image too large' });
      }
      log(`OCR by ${t.username} chars=${fileBase64.length}`);
      const result = await parseQuestionsFromMedia(fileBase64, body.mimeType || 'image/jpeg');
      return json(res, 200, result);
    }
    if (path === '/api/ocr/upload-image' && method === 'POST') {
      const t = requireTeacher(req, res);
      if (!t) return;
      // Store metadata; binary storage can use Appwrite Storage later
      return json(res, 200, { ok: true, fileId: body.fileId || ID.unique(), message: 'Image registered' });
    }
    if (path === '/api/ocr/commit-crops' && method === 'POST') {
      const t = requireTeacher(req, res);
      if (!t) return;
      return json(res, 200, { ok: true, questions: body.questions || [] });
    }

    // ---------- STUDENTS ----------
    if (path === '/api/students' && method === 'GET') {
      const students = await store.getStudents();
      return json(res, 200, { students });
    }
    if (path === '/api/students' && method === 'POST') {
      const t = requireTeacher(req, res);
      if (!t) return;
      const student = body.student || body;
      student.id = student.id || ID.unique();
      student.teacherIds = Array.from(new Set([...(student.teacherIds || []), t.username]));
      await store.saveStudent(student);
      return json(res, 200, { student });
    }
    {
      const m = match(path, '/api/students/:id');
      if (m && method === 'PUT') {
        const t = requireTeacher(req, res);
        if (!t) return;
        const existing = await store.getStudentById(m.id);
        if (!existing) return json(res, 404, { error: 'Not found' });
        const student = { ...existing, ...body, id: m.id };
        await store.saveStudent(student);
        return json(res, 200, { student });
      }
      if (m && method === 'DELETE') {
        const t = requireTeacher(req, res);
        if (!t) return;
        await store.deleteStudent(m.id);
        return json(res, 200, { success: true });
      }
    }
    {
      const m = match(path, '/api/students/:id/reset-attempt');
      if (m && method === 'POST') {
        const t = requireTeacher(req, res);
        if (!t) return;
        const examId = body.examId;
        const student = await store.getStudentById(m.id);
        if (!student) return json(res, 404, { error: 'Student not found' });
        const attempts = await store.getStudentAttempts(examId, student.telegramUserId);
        for (const a of attempts) await store.deleteAttempt(a.id);
        return json(res, 200, { ok: true, deleted: attempts.length });
      }
    }

    // ---------- ATTEMPTS / RESULTS ----------
    {
      const m = match(path, '/api/attempts/:id');
      if (m && method === 'DELETE') {
        const t = requireTeacher(req, res);
        if (!t) return;
        await store.deleteAttempt(m.id);
        return json(res, 200, { success: true });
      }
    }
    {
      const m = match(path, '/api/attempts/:id/detail');
      if (m && method === 'GET') {
        const t = requireTeacher(req, res);
        if (!t) return;
        const attempts = await store.getAttempts();
        const attempt = attempts.find((a) => a.id === m.id);
        if (!attempt) return json(res, 404, { error: 'Not found' });
        const exam = await store.getExamById(attempt.examId);
        return json(res, 200, { attempt, exam });
      }
    }

    if (path === '/api/results' && method === 'GET') {
      const t = teacherFromHeaders(req.headers || {});
      let attempts = await store.getAttempts();
      let exams = await store.getExams();
      if (t) {
        exams = exams.filter((e) => !e.teacherId || e.teacherId === t.username);
        const ids = new Set(exams.map((e) => e.id));
        attempts = attempts.filter((a) => ids.has(a.examId));
      }
      const students = await store.getStudents();
      return json(res, 200, { attempts, exams, students });
    }

    if (path === '/api/results/export' && method === 'GET') {
      // query from path - Appwrite may put query on req.query
      const attempts = await store.getAttempts();
      const rows = [['attemptId', 'examId', 'student', 'score', 'maxScore', 'percentage', 'status']];
      for (const a of attempts) {
        rows.push([a.id, a.examId, a.studentName || a.telegramUserId, a.score, a.maxScore, a.percentage, a.status]);
      }
      const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      return res.send(csv, 200, { ...CORS, 'Content-Type': 'text/csv' });
    }

    if (path === '/api/leaderboard' && method === 'GET') {
      const attempts = (await store.getAttempts()).filter((a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED');
      attempts.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
      return json(res, 200, { leaderboard: attempts.slice(0, 100) });
    }

    // ---------- SETTINGS / MESSAGING ----------
    if (path === '/api/settings' && method === 'GET') {
      return json(res, 200, await store.getSettings());
    }
    if ((path === '/api/settings' && (method === 'PUT' || method === 'POST'))) {
      const t = requireTeacher(req, res);
      if (!t) return;
      const s = await store.updateSettings(body);
      return json(res, 200, s);
    }
    if (path === '/api/message' && method === 'POST') {
      const t = requireTeacher(req, res);
      if (!t) return;
      const chatId = body.telegramUserId;
      const message = body.message;
      if (!chatId || !message) return json(res, 400, { error: 'telegramUserId and message required' });
      const result = await sendMessage(chatId, message);
      return json(res, 200, { ok: !!result.ok, result });
    }
    if (path === '/api/broadcast' && method === 'POST') {
      const t = requireTeacher(req, res);
      if (!t) return;
      const message = body.message;
      if (!message) return json(res, 400, { error: 'message required' });
      const students = (await store.getStudents()).filter((s) => s.telegramUserId);
      let sent = 0;
      for (const s of students) {
        const r = await sendMessage(s.telegramUserId, message);
        if (r.ok) sent++;
      }
      await store.addAuditLog('BROADCAST', `Sent to ${sent}/${students.length}`, t.username);
      return json(res, 200, { ok: true, sent, total: students.length });
    }
    if (path === '/api/audit-logs' && method === 'GET') {
      const t = requireTeacher(req, res);
      if (!t) return;
      return json(res, 200, { logs: await store.getAuditLogs() });
    }

    // ---------- TELEGRAM ----------
    if (path === '/api/telegram/webhook' && method === 'POST') {
      const update = body;
      const updateId = update.update_id;
      if (updateId != null) {
        const claimed = await store.claimTelegramUpdate(updateId);
        if (!claimed) return json(res, 200, { ok: true, duplicate: true });
      }
      await processTelegramUpdate(update, store, process.env.WEBAPP_URL);
      return json(res, 200, { ok: true });
    }
    if (path === '/api/telegram/simulate' && method === 'POST') {
      await processTelegramUpdate(body, store, process.env.WEBAPP_URL);
      return json(res, 200, { ok: true });
    }
    if (path === '/api/telegram/webapp-review' && method === 'POST') {
      return json(res, 200, { ok: true });
    }

    // ---------- WEBAPP (student mini-app) ----------
    if (path === '/api/webapp/session' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      let student = await store.getStudentByTelegramId(auth.userId);
      if (!student) {
        student = {
          id: `STU_${auth.userId}`,
          studentId: `TG-${auth.userId}`,
          name: [auth.user?.first_name, auth.user?.last_name].filter(Boolean).join(' ') || auth.user?.username || `Student ${auth.userId}`,
          className: '',
          telegramUserId: auth.userId,
          telegramUsername: auth.user?.username || null,
          status: 'linked',
          teacherIds: [],
          joinedAt: new Date().toISOString(),
        };
        await store.saveStudent(student);
      }
      const attempts = await store.getAttempts();
      let userActive = attempts.find((a) => Number(a.telegramUserId) === auth.userId && a.status === 'IN_PROGRESS');
      if (userActive) userActive = await finalizeExpiredAttempt(userActive);
      const ongoingRaw = (await store.getAttempts()).find(
        (a) => Number(a.telegramUserId) === auth.userId && a.status === 'IN_PROGRESS' && secondsLeft(a) > 0
      );
      let ongoing = null;
      if (ongoingRaw) {
        const exam = await store.getExamById(ongoingRaw.examId);
        ongoing = {
          attemptId: ongoingRaw.id,
          examId: ongoingRaw.examId,
          examTitle: exam?.title || 'Exam',
          secondsLeft: secondsLeft(ongoingRaw),
          currentQuestionIndex: ongoingRaw.currentQuestionIndex || 0,
          answeredCount: Object.keys(ongoingRaw.answers || {}).length,
          totalQuestions: exam?.totalQuestions || exam?.questions?.length || 0,
        };
      }
      return json(res, 200, {
        user: { id: auth.userId, firstName: auth.user?.first_name, lastName: auth.user?.last_name, username: auth.user?.username },
        student: student
          ? { id: student.id, name: student.name, studentId: student.studentId, className: student.className, telegramUserId: student.telegramUserId, status: student.status }
          : null,
        ongoing,
      });
    }

    if (path === '/api/webapp/profile' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      let student = await store.getStudentByTelegramId(auth.userId);
      if (!student) return json(res, 404, { error: 'Student not found' });
      if (body.name) student.name = String(body.name).trim();
      if (body.className !== undefined) student.className = String(body.className);
      if (body.studentId) student.studentId = String(body.studentId);
      await store.saveStudent(student);
      return json(res, 200, { student });
    }

    if (path === '/api/webapp/exams' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const exams = (await store.getExams())
        .map(withEffectiveStatus)
        .filter((e) => e.status !== 'DRAFT' && e.status !== 'CANCELLED')
        .map((e) => ({
          id: e.id,
          title: e.title,
          subject: e.subject || '',
          className: e.className || e.class_name || '',
          totalQuestions: e.totalQuestions || e.questions?.length || 0,
          durationMinutes: e.durationMinutes || 60,
          startDate: e.startDate,
          status: e.status,
          totalMarks: e.totalMarks,
        }));
      return json(res, 200, { exams });
    }

    if (path === '/api/webapp/exam' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const exam = await store.getExamById(body.examId);
      if (!exam) return json(res, 404, { error: 'Exam not found' });
      return json(res, 200, {
        exam: withEffectiveStatus({
          ...exam,
          questions: (exam.questions || []).map((q) => ({
            id: q.id,
            marks: q.marks,
            subject: q.subject,
            // hide answers until submit review
          })),
        }),
      });
    }

    if (path === '/api/webapp/start' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const exam = await store.getExamById(body.examId);
      if (!exam) return json(res, 404, { error: 'Exam not found' });
      const status = effectiveExamStatus(exam);
      if (status !== 'LIVE' && status !== 'SCHEDULED' && !body.practice) {
        // allow scheduled for practice
      }
      const student = await store.getStudentByTelegramId(auth.userId);
      const existing = (await store.getStudentAttempts(exam.id, auth.userId)).find((a) => a.status === 'IN_PROGRESS');
      if (existing && secondsLeft(existing) > 0) {
        return json(res, 200, {
          attempt: existing,
          exam: sanitizeExamForStudent(exam),
          secondsLeft: secondsLeft(existing),
        });
      }
      const durationMinutes = Number(exam.durationMinutes) || 60;
      const startedAt = new Date().toISOString();
      const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      const attempt = {
        id: ID.unique(),
        examId: exam.id,
        telegramUserId: auth.userId,
        studentId: student?.id,
        studentName: student?.name,
        status: 'IN_PROGRESS',
        answers: {},
        currentQuestionIndex: 0,
        startedAt,
        endsAt,
        durationMinutes,
        attemptNumber: await store.nextAttemptNumber(exam.id, auth.userId),
        practice: !!body.practice,
      };
      await store.saveAttempt(attempt);
      return json(res, 200, {
        attempt,
        exam: sanitizeExamForStudent(exam),
        secondsLeft: secondsLeft(attempt),
      });
    }

    if (path === '/api/webapp/pause' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const attempt = (await store.getAttempts()).find((a) => a.id === body.attemptId);
      if (!attempt || Number(attempt.telegramUserId) !== auth.userId) return json(res, 404, { error: 'Attempt not found' });
      attempt.pausedAt = new Date().toISOString();
      await store.updateAttemptPause(attempt);
      return json(res, 200, { ok: true, attempt });
    }

    if (path === '/api/webapp/sync' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      let attempt = (await store.getAttempts()).find((a) => a.id === body.attemptId);
      if (!attempt || Number(attempt.telegramUserId) !== auth.userId) return json(res, 404, { error: 'Attempt not found' });
      attempt = await finalizeExpiredAttempt(attempt);
      return json(res, 200, {
        attempt,
        secondsLeft: secondsLeft(attempt),
        status: attempt.status,
      });
    }

    if (path === '/api/webapp/answer' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const attempt = (await store.getAttempts()).find((a) => a.id === body.attemptId);
      if (!attempt || Number(attempt.telegramUserId) !== auth.userId) return json(res, 404, { error: 'Attempt not found' });
      if (attempt.status !== 'IN_PROGRESS') return json(res, 400, { error: 'Attempt not in progress' });
      await store.saveAnswer(attempt.id, body.questionId, body.optionIndex, body.currentQuestionIndex);
      return json(res, 200, { ok: true });
    }

    if (path === '/api/webapp/index' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      await store.updateAttemptIndex(body.attemptId, body.index);
      return json(res, 200, { ok: true });
    }

    if (path === '/api/webapp/submit' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      let attempt = (await store.getAttempts()).find((a) => a.id === body.attemptId);
      if (!attempt || Number(attempt.telegramUserId) !== auth.userId) return json(res, 404, { error: 'Attempt not found' });
      if (attempt.status !== 'IN_PROGRESS') return json(res, 400, { error: 'Already submitted' });
      if (body.answers && typeof body.answers === 'object') attempt.answers = { ...attempt.answers, ...body.answers };
      const exam = await store.getExamById(attempt.examId);
      const timeTaken = Math.max(0, Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000));
      const stats = calculateAttemptScore(exam, attempt.answers || {}, timeTaken);
      Object.assign(attempt, stats, {
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        timeTakenSeconds: timeTaken,
      });
      await store.saveAttempt(attempt);
      return json(res, 200, { attempt, exam: { id: exam?.id, title: exam?.title, resultVisibility: exam?.resultVisibility || 'PUBLISHED' } });
    }

    if (path === '/api/webapp/results' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const attempts = (await store.getAttempts()).filter(
        (a) => Number(a.telegramUserId) === auth.userId && (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED')
      );
      const exams = await store.getExams();
      const examMap = Object.fromEntries(exams.map((e) => [e.id, e]));
      return json(res, 200, {
        results: attempts.map((a) => ({
          ...a,
          examTitle: examMap[a.examId]?.title || 'Exam',
          resultVisibility: examMap[a.examId]?.resultVisibility || 'PUBLISHED',
        })),
      });
    }

    if (path === '/api/webapp/review' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const attempt = (await store.getAttempts()).find((a) => a.id === body.attemptId);
      if (!attempt || Number(attempt.telegramUserId) !== auth.userId) return json(res, 404, { error: 'Attempt not found' });
      if (attempt.status !== 'SUBMITTED' && attempt.status !== 'AUTO_SUBMITTED') return json(res, 400, { error: 'Exam not submitted' });
      const exam = await store.getExamById(attempt.examId);
      if (!exam) return json(res, 404, { error: 'Exam not found' });
      if (exam.resultVisibility && exam.resultVisibility !== 'PUBLISHED') return json(res, 403, { error: 'Results not published' });
      const questions = (exam.questions || []).map((q) => {
        const sel = attempt.answers?.[q.id];
        const has = sel !== undefined && sel !== null;
        let status = 'unattempted';
        if (has) status = q.answer !== null && Number(sel) === Number(q.answer) ? 'correct' : 'wrong';
        return {
          id: q.id,
          question: q.question || '',
          options: q.options || [],
          marks: q.marks ?? 1,
          negativeMarks: q.negativeMarks ?? 0,
          subject: q.subject || exam.subject || '',
          explanation: q.explanation || '',
          selectedIndex: has ? Number(sel) : null,
          correctIndex: q.answer,
          status,
        };
      });
      return json(res, 200, { exam: { id: exam.id, title: exam.title, subject: exam.subject || '' }, attempt, questions });
    }

    if (path === '/api/webapp/leaderboard' && method === 'POST') {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const examId = body.examId;
      let attempts = (await store.getAttempts()).filter((a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED');
      if (examId) attempts = attempts.filter((a) => a.examId === examId);
      attempts.sort((a, b) => (b.percentage || 0) - (a.percentage || 0) || (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0));
      return json(res, 200, {
        leaderboard: attempts.slice(0, 50).map((a, i) => ({
          rank: i + 1,
          name: a.studentName || `User ${a.telegramUserId}`,
          score: a.score,
          maxScore: a.maxScore,
          percentage: a.percentage,
          isMe: Number(a.telegramUserId) === auth.userId,
        })),
      });
    }

    return json(res, 404, { error: 'Not found', path, method });
  } catch (e) {
    error(String(e?.stack || e?.message || e));
    return json(res, 500, { error: String(e?.message || e) });
  }
};

function sanitizeExamForStudent(exam) {
  if (!exam) return null;
  return {
    id: exam.id,
    title: exam.title,
    subject: exam.subject || '',
    durationMinutes: exam.durationMinutes || 60,
    totalQuestions: exam.totalQuestions || exam.questions?.length || 0,
    totalMarks: exam.totalMarks,
    negativeMarking: exam.negativeMarking,
    questions: (exam.questions || []).map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options || [],
      marks: q.marks ?? 1,
      negativeMarks: q.negativeMarks ?? 0,
      subject: q.subject || '',
      has_image: q.has_image,
      image: q.image,
      // answers intentionally omitted
    })),
  };
}
