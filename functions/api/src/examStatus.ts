import type { Exam, ExamStatus } from './types.js';

/** Status is automatic from start time + duration (not teacher-selected). */
export function effectiveExamStatus(exam: Pick<Exam, 'startDate' | 'durationMinutes'>): ExamStatus {
  const start = new Date(exam.startDate).getTime();
  if (!Number.isFinite(start)) return 'SCHEDULED';
  const end = start + Math.max(1, Number(exam.durationMinutes) || 60) * 60_000;
  const now = Date.now();
  if (now < start) return 'SCHEDULED';
  if (now < end) return 'LIVE';
  return 'RESULTS_PUBLISHED';
}

export function withEffectiveStatus<T extends Pick<Exam, 'startDate' | 'durationMinutes' | 'status'>>(exam: T): T {
  return { ...exam, status: effectiveExamStatus(exam) };
}
