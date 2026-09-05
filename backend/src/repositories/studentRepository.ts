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

export const studentRepository = {
  async findAll(): Promise<any[]> {
    return listDocs(COLLECTIONS.students, [], 1000);
  },

  async findById(id: string): Promise<any | null> {
    return getDoc(COLLECTIONS.students, id);
  },

  async findByTelegramUserId(tgId: number): Promise<any | null> {
    return findOne(COLLECTIONS.students, [Query.equal('telegram_user_id', tgId)]);
  },

  async findByCode(code: string): Promise<any | null> {
    return findOne(COLLECTIONS.students, [Query.equal('student_code', code)]);
  },

  async upsert(student: {
    id: string;
    student_code: string;
    name: string;
    class_name?: string;
    telegram_user_id?: number | null;
    telegram_username?: string;
    link_code?: string;
    status?: string;
    joined_at?: string;
  }): Promise<void> {
    const existing = await getDoc(COLLECTIONS.students, student.id);
    const data = {
      student_code: student.student_code,
      name: student.name,
      class_name: student.class_name || '',
      telegram_user_id: student.telegram_user_id ?? null,
      telegram_username: student.telegram_username || '',
      link_code: student.link_code || '',
      status: student.status || 'ACTIVE',
      joined_at: student.joined_at || new Date().toISOString(),
    };
    if (existing) await updateDoc(COLLECTIONS.students, student.id, data);
    else await createDoc(COLLECTIONS.students, data, student.id);
  },

  async linkTeacher(studentId: string, teacherId: string): Promise<void> {
    const existing = await findOne(COLLECTIONS.student_teachers, [
      Query.equal('student_id', studentId),
      Query.equal('teacher_id', teacherId),
    ]);
    if (!existing) {
      await createDoc(COLLECTIONS.student_teachers, {
        student_id: studentId,
        teacher_id: teacherId,
      });
    }
  },

  async teachersForStudent(studentId: string): Promise<string[]> {
    const docs = await listDocs(COLLECTIONS.student_teachers, [Query.equal('student_id', studentId)], 100);
    return docs.map((d: any) => String(d.teacher_id));
  },

  async delete(id: string): Promise<void> {
    const links = await listDocs(COLLECTIONS.student_teachers, [Query.equal('student_id', id)], 100);
    for (const l of links) await deleteDoc(COLLECTIONS.student_teachers, l.$id);
    await deleteDoc(COLLECTIONS.students, id);
  },
};
