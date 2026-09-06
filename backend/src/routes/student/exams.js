import { ID } from 'node-appwrite';
import { store } from '../../repositories/store.js';
import { studentFromHeaders } from '../../services/studentAuth.js';
import { calculateAttemptScore, withEffectiveStatus, secondsLeft } from '../../services/scoring.js';
import { json } from '../../utils/http.js';

async function hydrate(exam) {
  if (!exam) return exam;
  if (Array.isArray(exam.questions) && exam.questions.length) return exam;
  exam.questions = await store.getQuestions(exam.id);
  return exam;
}

function publicQuestions(exam) {
  return (exam.questions || []).map((q) => ({
    id: q.id,
    question: q.question || q.text || '',
    options: q.options || [],
    marks: q.marks ?? 1,
    imageFileId: q.image?.fileId || q.imageFileId || null,
  }));
}

export async function handleStudentExams(method, path, body, req, res) {
  if (path === '/api/student/exams' && method === 'GET') {
    const s = studentFromHeaders(req.headers || {});
    if (!s) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const student = await store.getStudentById(s.id);
    const opened = new Set(Array.isArray(student?.openedExamIds) ? student.openedExamIds : []);
    const attempts = await store.getAttempts();
    for (const a of attempts) {
      if (a.studentId === s.id && a.examId) opened.add(a.examId);
    }
    const exams = (await store.getExams())
      .filter((e) => opened.has(e.id))
      .filter((e) => e.status !== 'DRAFT' && e.status !== 'CANCELLED')
      .map(withEffectiveStatus)
      .map((e) => ({
        id: e.id,
        title: e.title,
        subject: e.subject || '',
        durationMinutes: e.durationMinutes || 60,
        totalQuestions: (e.questions || []).length || e.totalQuestions || 0,
        status: e.status,
        startDate: e.startDate,
        resultVisibility: e.resultVisibility || 'PUBLISHED',
        leaderboardVisibility: e.leaderboardVisibility || 'PUBLISHED',
      }));
    return json(res, 200, { exams }, req);
  }

  if ((path === '/api/student/open' || path === '/api/student/exam') && method === 'POST') {
    const s = studentFromHeaders(req.headers || {});
    if (!s) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const examId = body.examId || body.id;
    if (!examId) return json(res, 400, { error: 'examId required' }, req);
    let exam = await hydrate(await store.getExamById(examId));
    if (!exam) return json(res, 404, { error: 'Exam not found' }, req);
    if (exam.status === 'DRAFT' || exam.status === 'CANCELLED') {
      return json(res, 403, { error: 'This exam is not available' }, req);
    }
    await store.grantExamAccess(s.id, exam.id);
    exam = withEffectiveStatus(exam);
    return json(res, 200, {
      exam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject || '',
        durationMinutes: exam.durationMinutes || 60,
        totalQuestions: (exam.questions || []).length || exam.totalQuestions || 0,
        status: exam.status,
        startDate: exam.startDate,
        resultVisibility: exam.resultVisibility || 'PUBLISHED',
        leaderboardVisibility: exam.leaderboardVisibility || 'PUBLISHED',
        totalMarks: exam.totalMarks || 0,
        className: exam.className || '',
      },
    }, req);
  }

  if (path === '/api/student/leaderboard' && method === 'POST') {
    const s = studentFromHeaders(req.headers || {});
    if (!s) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const examId = body.examId;
    if (!examId) return json(res, 400, { error: 'examId required' }, req);
    const exam = await store.getExamById(examId);
    if (!exam) return json(res, 404, { error: 'Exam not found' }, req);
    const student = await store.getStudentById(s.id);
    const opened = new Set(Array.isArray(student?.openedExamIds) ? student.openedExamIds : []);
    const attemptsAll = await store.getAttempts(examId);
    if (!opened.has(examId) && !attemptsAll.some((a) => a.studentId === s.id)) {
      return json(res, 403, { error: 'Open this exam from your teacher link first' }, req);
    }
    if (String(exam.leaderboardVisibility || 'PUBLISHED').toUpperCase() === 'HIDDEN') {
      return json(res, 403, { error: 'Leaderboard is hidden' }, req);
    }
    const official = attemptsAll.filter(
      (a) => !a.practice && (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED')
    );
    official.sort((a, b) => {
      const ps = (Number(b.percentage) || 0) - (Number(a.percentage) || 0);
      if (ps) return ps;
      return (Number(a.timeTakenSeconds) || 0) - (Number(b.timeTakenSeconds) || 0);
    });
    const rows = official.map((a, i) => ({
      rank: i + 1,
      name: a.studentName || 'Student',
      score: a.score || 0,
      maxScore: a.maxScore || 0,
      percentage: a.percentage || 0,
      timeTakenSeconds: a.timeTakenSeconds || 0,
      isMe: a.studentId === s.id,
    }));
    return json(res, 200, { exam: { id: exam.id, title: exam.title }, rows }, req);
  }

  if (path === '/api/student/start' && method === 'POST') {
    const s = studentFromHeaders(req.headers || {});
    if (!s) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    let exam = await hydrate(await store.getExamById(body.examId));
    if (!exam) return json(res, 404, { error: 'Exam not found' }, req);
    if (exam.status === 'DRAFT' || exam.status === 'CANCELLED') {
      return json(res, 403, { error: 'This exam is not available' }, req);
    }
    await store.grantExamAccess(s.id, exam.id);
    const questions = publicQuestions(exam);
    if (!questions.length) return json(res, 400, { error: 'Exam has no questions' }, req);
    const student = (await store.getStudentById(s.id)) || { id: s.id, name: s.name, email: s.email };
    if (!body.forceNew) {
      const existing = (await store.getStudentAttempts(exam.id, student.id)).find((a) => a.status === 'IN_PROGRESS');
      if (existing && secondsLeft(existing) > 0) {
        return json(res, 200, {
          attempt: existing,
          exam: { id: exam.id, title: exam.title, durationMinutes: exam.durationMinutes },
          questions,
          secondsLeft: secondsLeft(existing),
        }, req);
      }
    }
    const durationMinutes = Number(exam.durationMinutes) || 60;
    const startedAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    const attempt = {
      id: ID.unique(),
      examId: exam.id,
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      status: 'IN_PROGRESS',
      answers: {},
      currentQuestionIndex: 0,
      startedAt,
      endsAt,
      expiresAt: endsAt,
      durationMinutes,
      attemptNumber: await store.nextAttemptNumber(exam.id, student.id),
      practice: !!body.practice,
      isOfficial: !body.practice,
      pausedAt: null,
      pausedSeconds: 0,
    };
    await store.saveAttempt(attempt);
    return json(res, 200, {
      attempt,
      exam: { id: exam.id, title: exam.title, durationMinutes },
      questions,
      secondsLeft: secondsLeft(attempt),
    }, req);
  }

  if (path === '/api/student/sync' && method === 'POST') {
    const s = studentFromHeaders(req.headers || {});
    if (!s) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const attempt = (await store.getAttempts()).find((a) => a.id === body.attemptId && a.studentId === s.id);
    if (!attempt) return json(res, 404, { error: 'Attempt not found' }, req);
    if (attempt.status !== 'IN_PROGRESS') return json(res, 200, { attempt, secondsLeft: 0 }, req);
    if (!attempt.answers) attempt.answers = {};
    for (const ch of body.changes || []) {
      if (!ch.questionId) continue;
      if (ch.clear || ch.selectedIndex === null || ch.selectedIndex === undefined) delete attempt.answers[ch.questionId];
      else attempt.answers[ch.questionId] = Number(ch.selectedIndex);
    }
    if (body.currentQuestionIndex != null) attempt.currentQuestionIndex = Number(body.currentQuestionIndex) || 0;
    await store.saveAttempt(attempt);
    return json(res, 200, { attempt, secondsLeft: secondsLeft(attempt) }, req);
  }

  if (path === '/api/student/pause' && method === 'POST') {
    const s = studentFromHeaders(req.headers || {});
    if (!s) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const attempt = (await store.getAttempts()).find((a) => a.id === body.attemptId && a.studentId === s.id);
    if (!attempt) return json(res, 404, { error: 'Not found' }, req);
    if (attempt.status !== 'IN_PROGRESS') return json(res, 400, { error: 'Not in progress' }, req);
    if (attempt.isOfficial !== false && attempt.practice !== true) {
      return json(res, 403, { error: 'Pause is only allowed for practice attempts' }, req);
    }
    const shouldPause = body.pause !== false && body.pause !== 'false';
    if (shouldPause) {
      if (!attempt.pausedAt) attempt.pausedAt = new Date().toISOString();
    } else if (attempt.pausedAt) {
      const pausedAt = new Date(attempt.pausedAt).getTime();
      if (Number.isFinite(pausedAt)) {
        const delta = Math.floor((Date.now() - pausedAt) / 1000);
        attempt.pausedSeconds = Math.max(0, Number(attempt.pausedSeconds || 0) + delta);
        const end = new Date(attempt.expiresAt || attempt.endsAt).getTime();
        if (Number.isFinite(end)) {
          const newEnd = new Date(end + delta * 1000).toISOString();
          attempt.expiresAt = newEnd;
          attempt.endsAt = newEnd;
        }
      }
      attempt.pausedAt = null;
    }
    await store.updateAttemptPause(attempt);
    return json(res, 200, { ok: true, paused: Boolean(attempt.pausedAt), secondsLeft: secondsLeft(attempt), attempt }, req);
  }

  if (path === '/api/student/submit' && method === 'POST') {
    const s = studentFromHeaders(req.headers || {});
    if (!s) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    let attempt = (await store.getAttempts()).find((a) => a.id === body.attemptId && a.studentId === s.id);
    if (!attempt) return json(res, 404, { error: 'Attempt not found' }, req);
    if (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED') {
      return json(res, 200, { attempt }, req);
    }
    if (body.answers) attempt.answers = { ...(attempt.answers || {}), ...body.answers };
    let exam = await hydrate(await store.getExamById(attempt.examId));
    const started = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
    const timeTaken = Math.max(0, Math.floor((Date.now() - started) / 1000) - Number(attempt.pausedSeconds || 0));
    const stats = calculateAttemptScore(exam, attempt.answers || {}, timeTaken);
    Object.assign(attempt, stats, {
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
      timeTakenSeconds: timeTaken,
    });
    await store.saveAttempt(attempt);
    return json(res, 200, { attempt, exam: { id: exam?.id, title: exam?.title } }, req);
  }

  if (path === '/api/student/results' && method === 'GET') {
    const s = studentFromHeaders(req.headers || {});
    if (!s) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const attempts = (await store.getAttempts()).filter(
      (a) => a.studentId === s.id && (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED')
    );
    return json(res, 200, { attempts }, req);
  }

  if (path === '/api/student/review' && method === 'POST') {
    const s = studentFromHeaders(req.headers || {});
    if (!s) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const attempt = (await store.getAttempts()).find((a) => a.id === body.attemptId && a.studentId === s.id);
    if (!attempt) return json(res, 404, { error: 'Not found' }, req);
    const exam = await hydrate(await store.getExamById(attempt.examId));
    if (exam?.resultVisibility === 'HIDDEN') return json(res, 403, { error: 'Results not published' }, req);
    const questions = (exam?.questions || []).map((q) => {
      const sel = attempt.answers?.[q.id];
      const has = sel !== undefined && sel !== null && sel !== '';
      let status = 'unattempted';
      if (has) status = Number(sel) === Number(q.answer) ? 'correct' : 'wrong';
      return {
        id: q.id,
        question: q.question || '',
        options: q.options || [],
        marks: q.marks ?? 1,
        selectedIndex: has ? Number(sel) : null,
        correctIndex: q.answer,
        status,
      };
    });
    return json(res, 200, { exam: { id: exam.id, title: exam.title }, attempt, questions }, req);
  }

  return null;
}
