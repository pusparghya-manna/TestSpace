import {
  listDocs,
  findOne,
  createDoc,
  updateDoc,
  deleteDoc,
  COLLECTIONS,
  Query,
  ID,
} from '../database/client.js';

export const answerRepository = {
  async findByAttempt(attemptId: string): Promise<any[]> {
    return listDocs(COLLECTIONS.attempt_answers, [Query.equal('attempt_id', attemptId)], 500);
  },

  async upsert(attemptId: string, questionId: string, optionIndex: number): Promise<void> {
    const existing = await findOne(COLLECTIONS.attempt_answers, [
      Query.equal('attempt_id', attemptId),
      Query.equal('question_id', questionId),
    ]);
    const data = {
      attempt_id: attemptId,
      question_id: questionId,
      option_index: optionIndex,
      updated_at: new Date().toISOString(),
    };
    if (existing) await updateDoc(COLLECTIONS.attempt_answers, existing.$id, data);
    else await createDoc(COLLECTIONS.attempt_answers, data);
  },

  async deleteByAttempt(attemptId: string): Promise<void> {
    const docs = await listDocs(COLLECTIONS.attempt_answers, [Query.equal('attempt_id', attemptId)], 500);
    for (const d of docs) await deleteDoc(COLLECTIONS.attempt_answers, d.$id);
  },
};
