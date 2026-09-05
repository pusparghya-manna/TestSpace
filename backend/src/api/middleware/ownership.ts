import { Request, Response } from 'express';
import { store } from '../../store.js';
import type { Exam, Student, Attempt, Question } from '../../types/index.js';

export function teacherIdOf(req: Request): string | undefined {
  return (req as any).teacher?.username as string | undefined;
}

export function requireTeacher(req: Request, res: Response): string | null {
  const id = teacherIdOf(req);
  if (!id) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return id;
}

export function ownsExam(exam: Exam | undefined | null, teacherId: string): boolean {
  if (!exam) return false;
  return exam.teacherId === teacherId;
}

export function getOwnedExam(examId: string, teacherId: string): Exam | null {
  const exam = store.getExamById(examId);
  if (!exam || exam.teacherId !== teacherId) return null;
  return exam;
}

export function studentBelongsToTeacher(student: Student, teacherId: string): boolean {
  if (Array.isArray(student.teacherIds) && student.teacherIds.includes(teacherId)) return true;
  const myExamIds = new Set(
    store.getExams().filter((e) => e.teacherId === teacherId).map((e) => e.id)
  );
  return store.getAttempts().some(
    (a) =>
      myExamIds.has(a.examId) &&
      (a.studentId === student.studentId ||
        (!!student.telegramUserId && a.telegramUserId === student.telegramUserId))
  );
}

export function attemptBelongsToTeacher(attempt: Attempt, teacherId: string): boolean {
  const exam = store.getExamById(attempt.examId);
  return !!exam && exam.teacherId === teacherId;
}

export function questionBelongsToTeacher(q: Question, teacherId: string): boolean {
  if ((q as any).teacherId) return (q as any).teacherId === teacherId;
  if (q.examId) {
    const exam = store.getExamById(q.examId);
    return !!exam && exam.teacherId === teacherId;
  }
  return false;
}
