import assert from 'node:assert/strict';
import { db } from '../database/client.js';
import { ensureSchema } from '../database/migrateFromBlobs.js';
import { store } from '../store.js';
import { finalizeExpiredAttempt } from '../services/attemptFinalizer.js';

const examId = 'EX_WEBAPP_FLOW';
const activeAttemptId = 'ATT_WEBAPP_ACTIVE';
const expiredAttemptId = 'ATT_WEBAPP_EXPIRED';

async function clean() {
  await ensureSchema();
  await db.execute({ sql: 'DELETE FROM attempt_answers WHERE attempt_id IN (?, ?)', args: [activeAttemptId, expiredAttemptId] });
  await db.execute({ sql: 'DELETE FROM attempts WHERE id IN (?, ?)', args: [activeAttemptId, expiredAttemptId] });
  await db.execute({ sql: 'DELETE FROM questions WHERE exam_id = ?', args: [examId] });
  await db.execute({ sql: 'DELETE FROM exams WHERE id = ?', args: [examId] });
}

async function main() {
  await clean();
  await store.init();
  const now = Date.now();
  await store.saveExam({
    id: examId,
    teacherId: 'T_FLOW',
    title: 'Webapp lifecycle test',
    startDate: new Date(now - 60_000).toISOString(),
    durationMinutes: 1,
    questions: [
      { id: 'Q1', question: 'one', options: ['correct', 'wrong'], answer: 0, marks: 1 },
      { id: 'Q2', question: 'two', options: ['wrong', 'correct'], answer: 1, marks: 1 },
    ],
    status: 'LIVE',
    resultVisibility: 'PUBLISHED',
    leaderboardVisibility: 'PUBLISHED',
    createdAt: new Date(now).toISOString(),
  } as any);

  await store.saveAttempt({
    id: activeAttemptId,
    examId,
    studentId: 'S_FLOW',
    telegramUserId: 770001,
    studentName: 'Flow Student',
    startedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 600_000).toISOString(),
    status: 'IN_PROGRESS',
    currentQuestionIndex: 0,
    answers: {},
    score: 0,
    maxScore: 2,
    percentage: 0,
    correctCount: 0,
    wrongCount: 0,
    skippedCount: 0,
    timeTakenSeconds: 0,
    isOfficial: true,
    attemptNumber: 1,
  } as any);
  assert.equal(await store.saveAnswer(activeAttemptId, 'Q1', 0, 1), true);
  assert.equal(await store.saveAnswer(activeAttemptId, 'Q2', 1, 1), true);
  await store.clearAnswer(activeAttemptId, 'Q2');
  assert.equal(await store.updateAttemptIndex(activeAttemptId, 1), true);
  const rows = await db.execute({
    sql: 'SELECT question_id, option_index FROM attempt_answers WHERE attempt_id = ? ORDER BY question_id',
    args: [activeAttemptId],
  });
  assert.deepEqual(rows.rows.map((row: any) => [String(row.question_id), Number(row.option_index)]), [['Q1', 0]]);
  const activeRow = await db.execute({ sql: 'SELECT current_question_index, status FROM attempts WHERE id = ?', args: [activeAttemptId] });
  assert.equal(Number((activeRow.rows[0] as any).current_question_index), 1);
  assert.equal(String((activeRow.rows[0] as any).status), 'IN_PROGRESS');

  await store.saveAttempt({
    id: expiredAttemptId,
    examId,
    studentId: 'S_FLOW',
    telegramUserId: 770001,
    studentName: 'Flow Student',
    startedAt: new Date(now - 120_000).toISOString(),
    expiresAt: new Date(now - 1_000).toISOString(),
    status: 'IN_PROGRESS',
    currentQuestionIndex: 0,
    answers: {},
    score: 0,
    maxScore: 2,
    percentage: 0,
    correctCount: 0,
    wrongCount: 0,
    skippedCount: 0,
    timeTakenSeconds: 0,
    isOfficial: true,
    attemptNumber: 2,
  } as any);
  assert.equal(await store.saveAnswer(expiredAttemptId, 'Q1', 0, 0), true);
  assert.equal(await store.saveAnswer(expiredAttemptId, 'Q2', 1, 0), true);
  const expired = await finalizeExpiredAttempt(store.getAttempts().find((attempt: any) => attempt.id === expiredAttemptId));
  assert.equal(expired?.status, 'AUTO_SUBMITTED');
  assert.equal(expired?.correctCount, 2);
  assert.equal(expired?.score, 2);
  const submittedAt = expired?.submittedAt;
  const repeated = await finalizeExpiredAttempt(expired);
  assert.equal(repeated?.status, 'AUTO_SUBMITTED');
  assert.equal(repeated?.submittedAt, submittedAt);

  await clean();
  console.log('OK webapp attempt lifecycle: incremental sync, clear, expiry finalization, idempotency');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
