import type { Express, Request, Response } from 'express';
import { store } from '../store.js';
import { validateWebAppInitData } from '../telegram/webappAuth.js';
import { calculateAttemptScore, updateExamRanks } from '../services/scoringService.js';
import { effectiveExamStatus } from '../examStatus.js';
import {
  finalizeExpiredAttempt,
  finalizeExpiredAttempts,
  serverActiveElapsedSeconds,
  serverSecondsLeft,
} from '../services/attemptFinalizer.js';

function botToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || store.getSettings().telegramBotToken || '';
}

function authWebapp(req: Request, res: Response): { userId: number; user?: any } | null {
  const initData = String(req.body?.initData || '');
  const auth = validateWebAppInitData(initData, botToken());
  if (!auth.ok) {
    res.status(401).json({ error: auth.error || 'Unauthorized' });
    return null;
  }
  return { userId: auth.userId, user: auth.user };
}

/** Support both sync and async store methods. */
async function S<T>(v: T | Promise<T>): Promise<T> {
  return await Promise.resolve(v);
}

function summaryExam(e: any) {
  return {
    id: e.id,
    title: e.title,
    subject: e.subject || '',
    className: e.className || '',
    totalQuestions: e.totalQuestions || e.questions?.length || 0,
    durationMinutes: e.durationMinutes || 60,
    totalMarks: e.totalMarks || 0,
    startDate: e.startDate,
    status: effectiveExamStatus(e),
    resultVisibility: e.resultVisibility || 'PUBLISHED',
    leaderboardVisibility: e.leaderboardVisibility || 'PUBLISHED',
    negativeMarking: e.negativeMarking || 0,
  };
}

function publicQuestions(exam: any) {
  return (exam.questions || []).map((q: any) => ({
    id: q.id,
    question: q.question || '',
    options: q.options || [],
    marks: q.marks ?? 1,
    negativeMarks: q.negativeMarks ?? 0,
    subject: q.subject || exam.subject || '',
    imageFileId: q.image?.fileId || null,
    imageUrl: q.image?.fileId
      ? `/api/media/telegram/${encodeURIComponent(q.image.fileId)}`
      : null,
  }));
}

function secondsLeft(attempt: any): number {
  return serverSecondsLeft(attempt);
}

function activeElapsedSeconds(attempt: any, now = Date.now()): number {
  return serverActiveElapsedSeconds(attempt, now);
}

function findAttemptById(attemptId: string): any | undefined {
  const all = store.getAttempts() as any[];
  return all.find((a: any) => a.id === attemptId);
}

const pausePersistenceQueue = new Map<string, Promise<boolean>>();

function queuePausePersistence(attempt: any): Promise<boolean> {
  const snapshot = { ...attempt };
  const previous = pausePersistenceQueue.get(attempt.id) || Promise.resolve(true);
  const next = previous
    .catch(() => false)
    .then(() => (store as any).updateAttemptPause(snapshot));
  const tracked = next.finally(() => {
    if (pausePersistenceQueue.get(attempt.id) === tracked) {
      pausePersistenceQueue.delete(attempt.id);
    }
  });
  pausePersistenceQueue.set(attempt.id, tracked);
  return tracked;
}

export function registerWebappRoutes(app: Express) {
  app.post('/api/webapp/session', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      let student = (await S(store.getStudentByTelegramId(auth.userId))) || null;
      // Soft-create student on first Mini App open so profile has a real studentId
      if (!student) {
        const name =
          [auth.user?.first_name, auth.user?.last_name].filter(Boolean).join(' ') ||
          auth.user?.username ||
          `Student ${auth.userId}`;
        const createdStudent = {
          id: `STU_${auth.userId}`,
          studentId: `TG-${auth.userId}`,
          name,
          className: '',
          telegramUserId: auth.userId,
          telegramUsername: auth.user?.username || null,
          linkCode: '',
          status: 'linked',
          teacherIds: [],
          joinedAt: new Date().toISOString(),
        } as any;
        student = createdStudent;
        await store.saveStudent(createdStudent);
      }
      const attempts = (await S(store.getAttempts())) as any[];
      const userActive = attempts.find(
        (a: any) => Number(a.telegramUserId) === auth.userId && a.status === 'IN_PROGRESS'
      );
      if (userActive) {
        await finalizeExpiredAttempt(userActive);
      }
      const ongoingRaw = attempts.find(
        (a: any) =>
          Number(a.telegramUserId) === auth.userId &&
          a.status === 'IN_PROGRESS' &&
          secondsLeft(a) > 0
      );
      let ongoing: any = null;
      if (ongoingRaw) {
        const exam = await S(store.getExamById(ongoingRaw.examId));
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
      res.json({
        user: {
          id: auth.userId,
          firstName: auth.user?.first_name,
          lastName: auth.user?.last_name,
          username: auth.user?.username,
        },
        student: student
          ? {
              id: student.id,
              name: student.name,
              studentId: student.studentId,
              className: student.className,
              telegramUserId: student.telegramUserId,
              status: student.status,
            }
          : null,
        ongoing,
      });
    } catch (e: any) {
      console.error('[webapp/session]', e?.message || e);
      res.status(500).json({ error: 'Session failed' });
    }
  });

  app.post('/api/webapp/profile', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const name = String(req.body?.name || '').trim().slice(0, 80);
      if (!name) return res.status(400).json({ error: 'Name required' });
      let student = await S(store.getStudentByTelegramId(auth.userId));
      if (!student) {
        return res.status(404).json({ error: 'Student not found — start an exam first' });
      }
      student = { ...student, name };
      await store.saveStudent(student);
      res.json({
        student: {
          id: student.id,
          name: student.name,
          studentId: student.studentId,
          className: student.className,
          telegramUserId: student.telegramUserId,
          status: student.status,
        },
      });
    } catch (e: any) {
      console.error('[webapp/profile]', e?.message || e);
      res.status(500).json({ error: 'Profile update failed' });
    }
  });

  app.post('/api/webapp/exams', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const student = await S(store.getStudentByTelegramId(auth.userId));
      const attempts = ((await S(store.getAttempts())) as any[]).filter(
        (a: any) => Number(a.telegramUserId) === auth.userId
      );
      const examIds = new Set(attempts.map((a: any) => a.examId));
      const all = (await S(store.getExams())) as any[];
      let exams = all
        .filter((e: any) => {
          if (examIds.has(e.id)) return true;
          if (student?.teacherIds?.includes(e.teacherId)) return true;
          return false;
        })
        .map(summaryExam);

      if (exams.length === 0) {
        exams = all
          .filter((e: any) => {
            const s = effectiveExamStatus(e);
            return s === 'LIVE' || s === 'SCHEDULED';
          })
          .slice(0, 30)
          .map(summaryExam);
      }
      res.json({ exams });
    } catch (e: any) {
      console.error('[webapp/exams]', e?.message || e);
      res.status(500).json({ error: 'Failed to load exams' });
    }
  });

  app.post('/api/webapp/exam', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const exam = await S(store.getExamById(String(req.body?.examId || '')));
      if (!exam) return res.status(404).json({ error: 'Exam not found' });
      res.json({ exam: summaryExam(exam) });
    } catch (e: any) {
      console.error('[webapp/exam]', e?.message || e);
      res.status(500).json({ error: 'Failed to load exam' });
    }
  });

  app.post('/api/webapp/start', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const examId = String(req.body?.examId || '');
      const forceNew = !!req.body?.forceNew;
      const exam = await S(store.getExamById(examId));
      if (!exam) return res.status(404).json({ error: 'Exam not found' });

      const windowStart = new Date(exam.startDate).getTime();
      if (Number.isFinite(windowStart) && Date.now() < windowStart) {
        return res.status(409).json({
          code: 'EXAM_NOT_STARTED',
          startTime: exam.startDate,
          error: 'This exam has not started yet.',
        });
      }

      let student = await S(store.getStudentByTelegramId(auth.userId));
      if (!student) {
        const name =
          [auth.user?.first_name, auth.user?.last_name].filter(Boolean).join(' ') ||
          auth.user?.username ||
          `Student ${auth.userId}`;
        const createdStudent = {
          id: `STU_${auth.userId}`,
          studentId: `TG-${auth.userId}`,
          name,
          className: '',
          telegramUserId: auth.userId,
          telegramUsername: auth.user?.username || null,
          linkCode: '',
          status: 'linked',
          teacherIds: exam.teacherId ? [exam.teacherId] : [],
          joinedAt: new Date().toISOString(),
        } as any;
        student = createdStudent;
        await store.saveStudent(createdStudent);
      }

      let attempt = await S(store.getAttempt(examId, auth.userId));
      if (attempt?.status === 'IN_PROGRESS') {
        attempt = await finalizeExpiredAttempt(attempt);
      }
      if (attempt && attempt.status === 'IN_PROGRESS' && !forceNew && secondsLeft(attempt) > 0) {
        await store.loadAttemptAnswers(attempt.id);
        return res.json({
          attempt,
          exam: summaryExam(exam),
          questions: publicQuestions(exam),
          secondsLeft: secondsLeft(attempt),
        });
      }

      if (!student) return res.status(500).json({ error: 'Student initialization failed' });

      if (exam.teacherId && !(student.teacherIds || []).includes(exam.teacherId)) {
        // Teacher visibility is eventual consistency and must never delay the
        // critical exam-start transaction or cause a client timeout.
        void (store as any).linkStudentTeacher?.(student.id, exam.teacherId).catch((error: any) => {
          console.warn('[webapp/start] deferred teacher link failed:', error?.message || error);
        });
      }

      const now = new Date();
      const attemptNumber = await store.nextAttemptNumber(examId, auth.userId);
      const windowEnd = Number.isFinite(windowStart)
        ? windowStart + Math.max(1, exam.durationMinutes || 60) * 60 * 1000
        : Number.POSITIVE_INFINITY;
      const windowOpen = Date.now() >= windowStart && Date.now() < windowEnd;
      const priorOfficial = (await S(store.getStudentAttempts(examId, auth.userId))).some(
        (a: any) =>
          a.isOfficial !== false && (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED')
      );
      // A forced reattempt is always practice, even while the official exam window is open.
      const isOfficial = !forceNew && windowOpen && !priorOfficial;
      let expiresMs = now.getTime() + Math.max(1, exam.durationMinutes || 60) * 60 * 1000;
      if (isOfficial) expiresMs = Math.min(expiresMs, windowEnd);

      const createdAttempt = {
        id: `ATT_${Date.now()}_${auth.userId}`,
        examId,
        studentId: student.studentId || student.id,
        telegramUserId: auth.userId,
        studentName: student.name,
        studentClass: student.className || '',
        startedAt: now.toISOString(),
        expiresAt: new Date(expiresMs).toISOString(),
        pausedAt: null,
        pausedSeconds: 0,
        submittedAt: null,
        status: 'IN_PROGRESS',
        currentQuestionIndex: 0,
        answers: {},
        score: 0,
        maxScore: exam.totalMarks || 0,
        percentage: 0,
        correctCount: 0,
        wrongCount: 0,
        skippedCount: 0,
        timeTakenSeconds: 0,
        rank: null,
        isOfficial,
        attemptNumber,
      } as any;
      attempt = createdAttempt;
      // MAX(attempt_number)+1 is only a hint under concurrent starts. The
      // database unique index is authoritative; retry the insert with the next
      // number if another request wins the race.
      for (let attemptInsert = 0; attemptInsert < 3; attemptInsert++) {
        try {
          await store.saveAttempt(createdAttempt);
          break;
        } catch (error: any) {
          const message = String(error?.message || error);
          const isAttemptNumberConflict =
            /unique|constraint/i.test(message) && /attempt/i.test(message);
          if (!isAttemptNumberConflict || attemptInsert === 2) throw error;
          createdAttempt.attemptNumber = await store.nextAttemptNumber(examId, auth.userId);
        }
      }

      res.json({
        attempt,
        exam: summaryExam(exam),
        questions: publicQuestions(exam),
        secondsLeft: secondsLeft(attempt),
      });
    } catch (e: any) {
      console.error('[webapp/start]', e?.message || e);
      res.status(500).json({ error: 'Failed to start exam' });
    }
  });

  app.post('/api/webapp/pause', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const attemptId = String(req.body?.attemptId || '');
      const shouldPause = Boolean(req.body?.pause);
      const attempt = findAttemptById(attemptId);
      if (!attempt || Number(attempt.telegramUserId) !== auth.userId) {
        return res.status(404).json({ error: 'Attempt not found' });
      }
      if (attempt.status === 'IN_PROGRESS') {
        const finalized = await finalizeExpiredAttempt(attempt);
        if (finalized) Object.assign(attempt, finalized);
      }
      if (attempt.status !== 'IN_PROGRESS') {
        return res.status(409).json({ error: 'Exam has already been finalized', attempt });
      }
      if (attempt.isOfficial !== false) {
        return res.status(400).json({ error: 'Pause is available for practice exams only' });
      }

      if (shouldPause) {
        if (!attempt.pausedAt) {
          if (secondsLeft(attempt) <= 0) {
            return res.status(400).json({ error: 'Time expired' });
          }
          attempt.pausedAt = new Date().toISOString();
        }
      } else if (attempt.pausedAt) {
        const pausedAt = new Date(attempt.pausedAt).getTime();
        if (Number.isFinite(pausedAt)) {
          attempt.pausedSeconds = Math.max(
            0,
            Number(attempt.pausedSeconds || 0) + Math.floor((Date.now() - pausedAt) / 1000)
          );
        }
        attempt.pausedAt = null;
      }

      if (typeof (store as any).updateAttemptPause === 'function') {
        // Do not make the student wait on a slow remote DB round trip. Writes
        // are serialized per attempt and continue in the background after a
        // short grace period, so rapid pause/resume taps remain ordered.
        const persisted = queuePausePersistence(attempt);
        await Promise.race([
          persisted,
          new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 1500)),
        ]);
      } else {
        await store.saveAttempt(attempt);
      }
      res.json({
        ok: true,
        paused: Boolean(attempt.pausedAt),
        pausedAt: attempt.pausedAt || null,
        pausedSeconds: attempt.pausedSeconds || 0,
        secondsLeft: secondsLeft(attempt),
      });
    } catch (e: any) {
      console.error('[webapp/pause]', e?.message || e);
      res.status(500).json({ error: 'Failed to update practice pause' });
    }
  });

  app.post('/api/webapp/sync', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const attemptId = String(req.body?.attemptId || '');
      const attempt = findAttemptById(attemptId);
      if (!attempt || Number(attempt.telegramUserId) !== auth.userId) {
        return res.status(404).json({ error: 'Attempt not found' });
      }
      if (attempt.status === 'IN_PROGRESS') {
        const finalized = await finalizeExpiredAttempt(attempt);
        if (finalized) Object.assign(attempt, finalized);
      }
      if (attempt.status !== 'IN_PROGRESS') {
        return res.status(200).json({ ok: true, attempt });
      }

      const changes = req.body?.changes;
      if (changes && typeof changes === 'object' && !Array.isArray(changes)) {
        for (const [questionId, rawValue] of Object.entries(changes)) {
          if (!questionId) continue;
          if (rawValue === null || rawValue === undefined) {
            await store.clearAnswer(attempt.id, questionId);
            continue;
          }
          const optionIndex = Number(rawValue);
          if (!Number.isInteger(optionIndex) || optionIndex < 0) continue;
          const ok = await store.saveAnswer(
            attempt.id,
            questionId,
            optionIndex,
            req.body?.currentQuestionIndex === undefined
              ? undefined
              : Number(req.body.currentQuestionIndex)
          );
          if (!ok) {
            const finalized = await finalizeExpiredAttempt(attempt);
            return res.status(200).json({ ok: true, attempt: finalized || attempt });
          }
        }
      }
      if (req.body?.currentQuestionIndex !== undefined) {
        await store.updateAttemptIndex(attempt.id, Number(req.body.currentQuestionIndex));
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[webapp/sync]', e?.message || e);
      res.status(500).json({ error: 'Failed to sync attempt' });
    }
  });

  app.post('/api/webapp/answer', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const attemptId = String(req.body?.attemptId || '');
      const questionId = String(req.body?.questionId || '');
      const optionIndex = req.body?.optionIndex;
      const attempt = findAttemptById(attemptId);
      if (!attempt || Number(attempt.telegramUserId) !== auth.userId) {
        return res.status(404).json({ error: 'Attempt not found' });
      }
      if (attempt.status === 'IN_PROGRESS') {
        const finalized = await finalizeExpiredAttempt(attempt);
        if (finalized) Object.assign(attempt, finalized);
      }
      if (attempt.status !== 'IN_PROGRESS') {
        return res.status(409).json({ error: 'Exam has already been finalized', attempt });
      }
      if (secondsLeft(attempt) <= 0) {
        const finalized = await finalizeExpiredAttempt(attempt);
        return res.status(409).json({ error: 'Time expired', attempt: finalized || attempt });
      }

      if (!questionId) return res.status(400).json({ error: 'Question id required' });
      if (optionIndex === null || optionIndex === undefined) {
        await store.clearAnswer(attempt.id, questionId);
      } else {
        const idx = Number(optionIndex);
        if (!Number.isInteger(idx) || idx < 0) return res.status(400).json({ error: 'Invalid answer' });
        await store.saveAnswer(attempt.id, questionId, idx, attempt.currentQuestionIndex);
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[webapp/answer]', e?.message || e);
      res.status(500).json({ error: 'Failed to save answer' });
    }
  });

  app.post('/api/webapp/index', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const attemptId = String(req.body?.attemptId || '');
      const index = Number(req.body?.index || 0);
      const attempt = findAttemptById(attemptId);
      if (!attempt || Number(attempt.telegramUserId) !== auth.userId) {
        return res.status(404).json({ error: 'Attempt not found' });
      }
      if (attempt.status === 'IN_PROGRESS') {
        const finalized = await finalizeExpiredAttempt(attempt);
        if (finalized) Object.assign(attempt, finalized);
      }
      if (attempt.status !== 'IN_PROGRESS') {
        return res.status(409).json({ error: 'Exam has already been finalized', attempt });
      }
      const ok = await store.updateAttemptIndex(attempt.id, index);
      if (!ok) return res.status(409).json({ error: 'Exam has already been finalized', attempt });
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[webapp/index]', e?.message || e);
      res.status(500).json({ error: 'Failed to update index' });
    }
  });

  app.post('/api/webapp/submit', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const attemptId = String(req.body?.attemptId || '');
      const attempt = findAttemptById(attemptId);
      if (!attempt || Number(attempt.telegramUserId) !== auth.userId) {
        return res.status(404).json({ error: 'Attempt not found' });
      }
      if (attempt.status === 'IN_PROGRESS') {
        const expired = await finalizeExpiredAttempt(attempt);
        if (expired) Object.assign(attempt, expired);
      }
      if (attempt.status !== 'IN_PROGRESS') {
        return res.json({ attempt });
      }
      const exam = await S(store.getExamById(attempt.examId));
      if (!exam) return res.status(404).json({ error: 'Exam not found' });

      // The server-side answer rows are authoritative. The browser must sync
      // changed answers before calling submit; no large snapshot is accepted.
      await store.loadAttemptAnswers(attempt.id);
      const timeTakenSeconds = activeElapsedSeconds(attempt);
      const scored = calculateAttemptScore(exam, attempt.answers || {}, timeTakenSeconds);
      Object.assign(attempt, scored, {
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        timeTakenSeconds,
        pausedAt: null,
      });

      const ok = await store.submitAttemptIfInProgress(attempt);
      if (!ok) {
        const existing = findAttemptById(attemptId);
        return res.json({ attempt: existing || attempt });
      }

      // Ranking is secondary to showing the student their completed result. Do not
      // keep the submit request open while every attempt rank is recalculated.
      void updateExamRanks(exam.id).catch((err: any) => {
        console.warn('[webapp/submit] deferred rank update failed:', err?.message || err);
      });
      res.json({ attempt });
    } catch (e: any) {
      console.error('[webapp/submit]', e?.message || e);
      res.status(500).json({ error: 'Failed to submit' });
    }
  });

  app.post('/api/webapp/results', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const attempts = ((await S(store.getAttempts())) as any[])
        .filter(
          (a: any) =>
            Number(a.telegramUserId) === auth.userId &&
            (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED')
        )
        .sort((a: any, b: any) =>
          String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''))
        )
        .slice(0, 50);

      const results = [];
      for (const a of attempts) {
        const exam = await S(store.getExamById(a.examId));
        const published = !exam || exam.resultVisibility === 'PUBLISHED';
        results.push({
          id: a.id,
          examId: a.examId,
          examTitle: exam?.title || 'Exam',
          status: a.status,
          submittedAt: a.submittedAt,
          startedAt: a.startedAt,
          timeTakenSeconds: a.timeTakenSeconds,
          rank: published ? a.rank : undefined,
          score: published ? a.score : undefined,
          maxScore: published ? a.maxScore : undefined,
          percentage: published ? a.percentage : undefined,
          correctCount: published ? a.correctCount : undefined,
          wrongCount: published ? a.wrongCount : undefined,
          skippedCount: published ? a.skippedCount : undefined,
          isOfficial: a.isOfficial,
          attemptNumber: a.attemptNumber,
          resultVisibility: exam?.resultVisibility || 'PUBLISHED',
        });
      }
      res.json({ results });
    } catch (e: any) {
      console.error('[webapp/results]', e?.message || e);
      res.status(500).json({ error: 'Failed to load results' });
    }
  });

  app.post('/api/webapp/review', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const attemptId = String(req.body?.attemptId || '');
      const attempt = findAttemptById(attemptId);
      if (!attempt || Number(attempt.telegramUserId) !== auth.userId) {
        return res.status(404).json({ error: 'Attempt not found' });
      }
      if (attempt.status !== 'SUBMITTED' && attempt.status !== 'AUTO_SUBMITTED') {
        return res.status(400).json({ error: 'Exam not submitted' });
      }
      const exam = await S(store.getExamById(attempt.examId));
      if (!exam) return res.status(404).json({ error: 'Exam not found' });
      if (exam.resultVisibility !== 'PUBLISHED') {
        return res.status(403).json({ error: 'Results not published' });
      }
      if (!attempt.answers || Object.keys(attempt.answers).length === 0) {
        try {
          if (typeof (store as any).loadAttemptAnswers === 'function') {
            await (store as any).loadAttemptAnswers(attempt.id);
          }
        } catch {
          /* */
        }
      }
      const questions = (exam.questions || []).map((q: any) => {
        const sel = attempt.answers?.[q.id];
        const has = sel !== undefined && sel !== null;
        let status: 'correct' | 'wrong' | 'unattempted' = 'unattempted';
        if (has) {
          status =
            q.answer !== null && Number(sel) === Number(q.answer) ? 'correct' : 'wrong';
        }
        return {
          id: q.id,
          question: q.question || '',
          options: q.options || [],
          marks: q.marks ?? 1,
          negativeMarks: q.negativeMarks ?? 0,
          subject: q.subject || exam.subject || '',
          imageFileId: q.image?.fileId || null,
          imageUrl: q.image?.fileId
            ? `/api/media/telegram/${encodeURIComponent(q.image.fileId)}`
            : null,
          explanation: q.explanation || '',
          selectedIndex: has ? Number(sel) : null,
          correctIndex: q.answer,
          status,
        };
      });
      res.json({
        exam: { id: exam.id, title: exam.title, subject: exam.subject || '' },
        attempt,
        questions,
      });
    } catch (e: any) {
      console.error('[webapp/review]', e?.message || e);
      res.status(500).json({ error: 'Failed to load review' });
    }
  });

  app.post('/api/webapp/leaderboard', async (req, res) => {
    try {
      const auth = authWebapp(req, res);
      if (!auth) return;
      const examId = String(req.body?.examId || '');
      const exam = await S(store.getExamById(examId));
      if (!exam) return res.status(404).json({ error: 'Exam not found' });
      if (exam.leaderboardVisibility !== 'PUBLISHED') {
        return res.status(403).json({ error: 'Leaderboard not published' });
      }
      const rows = ((await S(store.getAttempts(examId))) as any[])
        .filter(
          (a: any) =>
            (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED') &&
            a.isOfficial !== false
        )
        .slice()
        .sort(
          (a: any, b: any) =>
            (a.rank || 9999) - (b.rank || 9999) || (b.score || 0) - (a.score || 0)
        )
        .slice(0, 50)
        .map((a: any, i: number) => ({
          rank: a.rank || i + 1,
          name: a.studentName || 'Student',
          score: a.score,
          maxScore: a.maxScore,
          percentage: a.percentage,
          timeTakenSeconds: a.timeTakenSeconds,
          isMe: Number(a.telegramUserId) === auth.userId,
        }));
      res.json({ exam: { id: exam.id, title: exam.title }, rows });
    } catch (e: any) {
      console.error('[webapp/leaderboard]', e?.message || e);
      res.status(500).json({ error: 'Failed to load leaderboard' });
    }
  });
}
