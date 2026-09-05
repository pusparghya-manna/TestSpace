/**
 * Data-layer integrity tests (local file SQLite via Turso client).
 * Does not use production student data.
 */
import { createClient } from '@libsql/client';

process.env.TURSO_DATABASE_URL = 'file:./test-integrity.db';
process.env.TURSO_AUTH_TOKEN = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters!!';

// Dynamic import after env
const { db, withWriteTx, batchWrite } = await import('../db.js');
const { ensureSchema } = await import('../database/migrateFromBlobs.js');
const { store } = await import('../store.js');

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('ASSERT: ' + msg);
}

async function clean() {
  await ensureSchema();
  for (const t of [
    'attempt_answers',
    'attempts',
    'questions',
    'exams',
    'student_teachers',
    'students',
    'telegram_processed_updates',
  ]) {
    await db.execute(`DELETE FROM ${t}`).catch(() => {});
  }
}

async function testExamTransaction() {
  await clean();
  await store.init();
  const exam: any = {
    id: 'EX_TEST_1',
    teacherId: 'T1',
    title: 'Integrity Exam',
    startDate: new Date().toISOString(),
    durationMinutes: 30,
    totalMarks: 2,
    questions: [
      { id: 'Q1', question: '1+1?', options: ['1', '2', '3'], answer: 1, marks: 1 },
      { id: 'Q2', question: '2+2?', options: ['3', '4'], answer: 1, marks: 1 },
    ],
    resultVisibility: 'PUBLISHED',
    leaderboardVisibility: 'PUBLISHED',
    status: 'LIVE',
    createdAt: new Date().toISOString(),
  };
  await store.saveExam(exam);
  const q = await db.execute({ sql: 'SELECT COUNT(*) as c FROM questions WHERE exam_id = ?', args: ['EX_TEST_1'] });
  assert(Number((q.rows[0] as any).c) === 2, 'questions inserted');

  // Replace questions
  exam.questions = [{ id: 'Q3', question: 'only', options: ['a'], answer: 0, marks: 1 }];
  await store.saveExam(exam);
  const q2 = await db.execute({ sql: 'SELECT COUNT(*) as c FROM questions WHERE exam_id = ?', args: ['EX_TEST_1'] });
  assert(Number((q2.rows[0] as any).c) === 1, 'questions replaced atomically');
  console.log('OK exam transaction');
}

async function testAnswerUpsertIdempotent() {
  await clean();
  await store.init();
  await store.saveExam({
    id: 'EX_A',
    teacherId: 'T1',
    title: 'A',
    startDate: new Date().toISOString(),
    durationMinutes: 10,
    questions: [{ id: 'QA', question: 'q', options: ['x', 'y'], answer: 0, marks: 1 }],
    resultVisibility: 'PUBLISHED',
    leaderboardVisibility: 'PUBLISHED',
    status: 'LIVE',
    createdAt: new Date().toISOString(),
  } as any);

  const attempt: any = {
    id: 'ATT_1',
    examId: 'EX_A',
    studentId: 'S1',
    telegramUserId: 999001,
    studentName: 'Test',
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    submittedAt: null,
    status: 'IN_PROGRESS',
    currentQuestionIndex: 0,
    answers: {},
    score: 0,
    maxScore: 1,
    percentage: 0,
    correctCount: 0,
    wrongCount: 0,
    skippedCount: 0,
    timeTakenSeconds: 0,
    isOfficial: true,
    attemptNumber: 1,
  };
  await store.saveAttempt(attempt);
  await store.saveAnswer('ATT_1', 'QA', 0, 0);
  await store.saveAnswer('ATT_1', 'QA', 1, 0); // overwrite
  const ans = await db.execute({
    sql: 'SELECT option_index FROM attempt_answers WHERE attempt_id = ? AND question_id = ?',
    args: ['ATT_1', 'QA'],
  });
  assert(ans.rows.length === 1, 'single answer row');
  assert(Number((ans.rows[0] as any).option_index) === 1, 'answer updated');
  console.log('OK answer upsert');
}

async function testDuplicateSubmit() {
  await clean();
  await store.init();
  await store.saveExam({
    id: 'EX_B',
    teacherId: 'T1',
    title: 'B',
    startDate: new Date().toISOString(),
    durationMinutes: 10,
    questions: [{ id: 'QB', question: 'q', options: ['x'], answer: 0, marks: 1 }],
    resultVisibility: 'PUBLISHED',
    leaderboardVisibility: 'PUBLISHED',
    status: 'LIVE',
    createdAt: new Date().toISOString(),
  } as any);
  const attempt: any = {
    id: 'ATT_2',
    examId: 'EX_B',
    studentId: 'S2',
    telegramUserId: 999002,
    studentName: 'Test2',
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    submittedAt: null,
    status: 'IN_PROGRESS',
    currentQuestionIndex: 0,
    answers: { QB: 0 },
    score: 0,
    maxScore: 1,
    percentage: 0,
    correctCount: 0,
    wrongCount: 0,
    skippedCount: 0,
    timeTakenSeconds: 5,
    isOfficial: true,
    attemptNumber: 1,
  };
  await store.saveAttempt(attempt);
  attempt.status = 'SUBMITTED';
  attempt.submittedAt = new Date().toISOString();
  attempt.score = 1;
  attempt.percentage = 100;
  attempt.correctCount = 1;
  const first = await store.submitAttemptIfInProgress(attempt);
  assert(first === true, 'first submit ok');
  const second = await store.submitAttemptIfInProgress(attempt);
  assert(second === false, 'duplicate submit rejected');
  console.log('OK duplicate submit');
}

async function testTelegramIdempotency() {
  await clean();
  await store.init();
  const a = await store.claimTelegramUpdate(42);
  const b = await store.claimTelegramUpdate(42);
  assert(a === true && b === false, 'telegram update claim');
  console.log('OK telegram idempotency');
}

async function testTxRollback() {
  await ensureSchema();
  let failed = false;
  try {
    await withWriteTx(async (tx) => {
      await tx.execute({
        sql: `INSERT INTO exams (id, teacher_id, title, total_questions, start_date, duration_minutes, total_marks, negative_marking, randomize_questions, randomize_options, result_visibility, leaderboard_visibility, status, created_at, updated_at)
              VALUES ('EX_ROLL','T','t',0,?,?,0,0,0,0,'PUBLISHED','PUBLISHED','LIVE',?,?)`,
        args: [new Date().toISOString(), 10, new Date().toISOString(), new Date().toISOString()],
      });
      throw new Error('force rollback');
    });
  } catch {
    failed = true;
  }
  assert(failed, 'tx threw');
  const r = await db.execute({ sql: 'SELECT COUNT(*) as c FROM exams WHERE id = ?', args: ['EX_ROLL'] });
  assert(Number((r.rows[0] as any).c) === 0, 'rollback removed exam');
  console.log('OK transaction rollback');
}

async function main() {
  await testExamTransaction();
  await testAnswerUpsertIdempotent();
  await testDuplicateSubmit();
  await testTelegramIdempotency();
  await testTxRollback();
  console.log('ALL data integrity tests passed');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
