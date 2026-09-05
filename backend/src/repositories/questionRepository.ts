import { db } from '../database/client.js';
import type { Question } from '../types/domain.js';

export const questionRepository = {
  async findBank(limit = 500): Promise<any[]> {
    const qb = await db.execute({
      sql: 'SELECT * FROM question_bank LIMIT ?',
      args: [limit],
    });
    return qb.rows as any[];
  },

  async saveBankItem(q: Question): Promise<void> {
    await db.execute({
      sql: `INSERT INTO question_bank (id, teacher_id, question, options_json, answer, marks, negative_marks, explanation, subject)
            VALUES (?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET question=excluded.question, options_json=excluded.options_json,
              answer=excluded.answer, marks=excluded.marks, negative_marks=excluded.negative_marks,
              explanation=excluded.explanation, subject=excluded.subject, teacher_id=excluded.teacher_id`,
      args: [
        q.id, q.teacherId || 'default', q.question, JSON.stringify(q.options || []),
        q.answer, q.marks ?? 1, q.negativeMarks ?? 0, q.explanation || null, q.subject || null,
      ],
    });
  },

  async deleteBankItem(id: string): Promise<void> {
    await db.execute({ sql: 'DELETE FROM question_bank WHERE id = ?', args: [id] });
  },
};
