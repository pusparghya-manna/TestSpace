import {
  listDocs,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  findOne,
  COLLECTIONS,
  Query,
  ID,
} from '../database/client.js';

function mapAttempt(d: any): any {
  return {
    id: d.$id || d.id,
    exam_id: d.exam_id,
    student_id: d.student_id,
    telegram_user_id: d.telegram_user_id,
    student_name: d.student_name,
    student_class: d.student_class,
    started_at: d.started_at,
    expires_at: d.expires_at,
    paused_at: d.paused_at,
    paused_seconds: d.paused_seconds,
    submitted_at: d.submitted_at,
    status: d.status,
    current_question_index: d.current_question_index,
    score: d.score,
    max_score: d.max_score,
    percentage: d.percentage,
    correct_count: d.correct_count,
    wrong_count: d.wrong_count,
    skipped_count: d.skipped_count,
    time_taken_seconds: d.time_taken_seconds,
    rank: d.rank,
    is_official: d.is_official ? 1 : 0,
    attempt_number: d.attempt_number,
  };
}

export const attemptRepository = {
  async findAll(limit = 5000): Promise<any[]> {
    const docs = await listDocs(COLLECTIONS.attempts, [Query.orderDesc('started_at')], limit);
    return docs.map(mapAttempt);
  },

  async findById(id: string): Promise<any | null> {
    const d = await getDoc(COLLECTIONS.attempts, id);
    return d ? mapAttempt(d) : null;
  },

  async findByExam(examId: string): Promise<any[]> {
    const docs = await listDocs(COLLECTIONS.attempts, [Query.equal('exam_id', examId)], 2000);
    return docs.map(mapAttempt);
  },

  async findInProgress(examId: string, telegramUserId: number): Promise<any | null> {
    const d = await findOne(COLLECTIONS.attempts, [
      Query.equal('exam_id', examId),
      Query.equal('telegram_user_id', telegramUserId),
      Query.equal('status', 'IN_PROGRESS'),
    ]);
    return d ? mapAttempt(d) : null;
  },

  async upsert(attempt: Record<string, unknown>, id: string): Promise<void> {
    const existing = await getDoc(COLLECTIONS.attempts, id);
    const data = {
      exam_id: attempt.exam_id,
      student_id: attempt.student_id || '',
      telegram_user_id: attempt.telegram_user_id,
      student_name: attempt.student_name || '',
      student_class: attempt.student_class || '',
      started_at: attempt.started_at,
      expires_at: attempt.expires_at,
      paused_at: attempt.paused_at || '',
      paused_seconds: attempt.paused_seconds ?? 0,
      submitted_at: attempt.submitted_at || '',
      status: attempt.status,
      current_question_index: attempt.current_question_index ?? 0,
      score: attempt.score ?? 0,
      max_score: attempt.max_score ?? 0,
      percentage: attempt.percentage ?? 0,
      correct_count: attempt.correct_count ?? 0,
      wrong_count: attempt.wrong_count ?? 0,
      skipped_count: attempt.skipped_count ?? 0,
      time_taken_seconds: attempt.time_taken_seconds ?? 0,
      rank: attempt.rank ?? null,
      is_official: attempt.is_official !== 0 && attempt.is_official !== false,
      attempt_number: attempt.attempt_number ?? 1,
    };
    if (existing) await updateDoc(COLLECTIONS.attempts, id, data);
    else await createDoc(COLLECTIONS.attempts, data, id);
  },

  async submitIfInProgress(id: string, fields: Record<string, unknown>): Promise<boolean> {
    const d = await getDoc(COLLECTIONS.attempts, id);
    if (!d || String((d as any).status) !== 'IN_PROGRESS') return false;
    await updateDoc(COLLECTIONS.attempts, id, { ...fields, status: 'SUBMITTED' });
    return true;
  },

  async deleteByExam(examId: string): Promise<void> {
    const docs = await listDocs(COLLECTIONS.attempts, [Query.equal('exam_id', examId)], 2000);
    for (const d of docs) await deleteDoc(COLLECTIONS.attempts, d.$id);
  },
};
