import { listDocs, createDoc, deleteDoc, COLLECTIONS, Query, ID } from '../database/client.js';

export const questionRepository = {
  async findBankByTeacher(teacherId: string): Promise<any[]> {
    return listDocs(COLLECTIONS.question_bank, [Query.equal('teacher_id', teacherId)], 500);
  },

  async saveBankItem(item: Record<string, unknown>, id?: string): Promise<void> {
    await createDoc(COLLECTIONS.question_bank, item, id || ID.unique());
  },

  async deleteBankItem(id: string): Promise<void> {
    await deleteDoc(COLLECTIONS.question_bank, id);
  },
};
