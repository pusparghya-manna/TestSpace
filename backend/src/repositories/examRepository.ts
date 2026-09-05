import {
  listDocs,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  COLLECTIONS,
  Query,
  ID,
} from '../database/client.js';
import type { Exam, Question } from '../types/domain.js';
import { effectiveExamStatus } from '../examStatus.js';

function mapExam(d: any): any {
  return {
    id: d.$id || d.id,
    teacher_id: d.teacher_id,
    title: d.title,
    subject: d.subject,
    class_name: d.class_name,
    test_number: d.test_number,
    total_questions: d.total_questions,
    start_date: d.start_date,
    duration_minutes: d.duration_minutes,
    total_marks: d.total_marks,
    negative_marking: d.negative_marking,
    randomize_questions: d.randomize_questions ? 1 : 0,
    randomize_options: d.randomize_options ? 1 : 0,
    result_visibility: d.result_visibility,
    leaderboard_visibility: d.leaderboard_visibility,
    status: d.status,
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
}

function mapQuestion(d: any): any {
  return {
    id: d.$id || d.id,
    exam_id: d.exam_id,
    teacher_id: d.teacher_id,
    question: d.question,
    options_json: d.options_json || '[]',
    answer: d.answer,
    marks: d.marks,
    negative_marks: d.negative_marks,
    explanation: d.explanation,
    subject: d.subject,
    sort_order: d.sort_order,
    image_file_id: d.image_file_id,
    image_mime_type: d.image_mime_type,
    image_width: d.image_width,
    image_height: d.image_height,
  };
}

export const examRepository = {
  async findAll(): Promise<any[]> {
    const docs = await listDocs(COLLECTIONS.exams, [Query.orderDesc('created_at')], 500);
    return docs.map(mapExam);
  },

  async findById(id: string): Promise<any | null> {
    const d = await getDoc(COLLECTIONS.exams, id);
    return d ? mapExam(d) : null;
  },

  async findQuestionsByExamIds(examIds: string[]): Promise<any[]> {
    if (examIds.length === 0) return [];
    const out: any[] = [];
    // Appwrite Query.equal supports array for OR on same attr
    const chunk = 50;
    for (let i = 0; i < examIds.length; i += chunk) {
      const slice = examIds.slice(i, i + chunk);
      const docs = await listDocs(
        COLLECTIONS.questions,
        [Query.equal('exam_id', slice), Query.orderAsc('sort_order')],
        500
      );
      out.push(...docs.map(mapQuestion));
    }
    return out;
  },

  async findQuestionsByExamId(examId: string): Promise<any[]> {
    const docs = await listDocs(
      COLLECTIONS.questions,
      [Query.equal('exam_id', examId), Query.orderAsc('sort_order')],
      500
    );
    return docs.map(mapQuestion);
  },

  async saveExamWithQuestions(exam: Exam): Promise<void> {
    const status = effectiveExamStatus(exam);
    const now = new Date().toISOString();
    const questions = exam.questions || [];
    const payload = {
      teacher_id: exam.teacherId || 'default',
      title: exam.title,
      subject: exam.subject || '',
      class_name: exam.className || '',
      test_number: exam.testNumber || '',
      total_questions: questions.length || exam.totalQuestions || 0,
      start_date: exam.startDate,
      duration_minutes: exam.durationMinutes || 60,
      total_marks: exam.totalMarks || 0,
      negative_marking: exam.negativeMarking || 0,
      randomize_questions: !!exam.randomizeQuestions,
      randomize_options: !!exam.randomizeOptions,
      result_visibility: exam.resultVisibility || 'PUBLISHED',
      leaderboard_visibility: exam.leaderboardVisibility || 'PUBLISHED',
      status,
      created_at: exam.createdAt || now,
      updated_at: now,
    };
    const existing = await getDoc(COLLECTIONS.exams, exam.id);
    if (existing) {
      await updateDoc(COLLECTIONS.exams, exam.id, payload);
    } else {
      await createDoc(COLLECTIONS.exams, payload, exam.id);
    }

    // Replace questions
    const oldQs = await listDocs(COLLECTIONS.questions, [Query.equal('exam_id', exam.id)], 500);
    for (const q of oldQs) {
      await deleteDoc(COLLECTIONS.questions, q.$id);
    }
    const seenIds = new Set<string>();
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      let id = String(q.id || `Q_${exam.id}_${i}`).slice(0, 36);
      if (seenIds.has(id)) id = ID.unique();
      seenIds.add(id);
      let optionsJson = '[]';
      try {
        optionsJson = JSON.stringify(Array.isArray(q.options) ? q.options.slice(0, 8) : []);
      } catch {
        optionsJson = '[]';
      }
      const answer =
        q.answer === null || q.answer === undefined || Number.isNaN(Number(q.answer))
          ? null
          : Number(q.answer);
      await createDoc(
        COLLECTIONS.questions,
        {
          exam_id: exam.id,
          teacher_id: exam.teacherId || null,
          question: String(q.question || '').slice(0, 8000),
          options_json: optionsJson,
          answer,
          marks: Number(q.marks ?? 1),
          negative_marks: Number(q.negativeMarks ?? 0),
          explanation: q.explanation ? String(q.explanation).slice(0, 4000) : '',
          subject: q.subject || '',
          sort_order: i,
          image_file_id: q.image?.fileId || '',
          image_mime_type: q.image?.mimeType || '',
          image_width: q.image?.width || null,
          image_height: q.image?.height || null,
        },
        id
      );
    }
  },

  async deleteExam(examId: string): Promise<void> {
    const qs = await listDocs(COLLECTIONS.questions, [Query.equal('exam_id', examId)], 500);
    for (const q of qs) await deleteDoc(COLLECTIONS.questions, q.$id);
    try {
      await deleteDoc(COLLECTIONS.exams, examId);
    } catch {
      /* already gone */
    }
  },
};
