/**
 * Authoritative helpers for ACTIVE_EXAM Telegram UI.
 * Database attempt state is source of truth; session message ids are cache only.
 */
import { store } from '../store.js';
import type { Attempt, Exam, Student } from '../types.js';

export type StudentUiState = 'HOME' | 'EXAM_INFO' | 'ACTIVE_EXAM' | 'RESULT';

export function getActiveAttempt(examId: string, telegramUserId: number): Attempt | undefined {
  const a = store.getAttempt(examId, telegramUserId);
  if (!a || a.status !== 'IN_PROGRESS') return undefined;
  return a;
}

/** True if this callback belongs to the student's current in-progress attempt. */
export function validateExamCallback(opts: {
  telegramUserId: number;
  examId: string;
  requiredStatus?: 'IN_PROGRESS' | 'ANY';
}): { ok: true; exam: Exam; attempt: Attempt } | { ok: false; reason: string } {
  const exam = store.getExamById(opts.examId);
  if (!exam) return { ok: false, reason: 'EXAM_NOT_FOUND' };

  const attempt = store.getAttempt(opts.examId, opts.telegramUserId);
  if (!attempt) return { ok: false, reason: 'NO_ATTEMPT' };

  if (Number(attempt.telegramUserId) !== Number(opts.telegramUserId)) {
    return { ok: false, reason: 'OWNER_MISMATCH' };
  }

  const need = opts.requiredStatus || 'IN_PROGRESS';
  if (need === 'IN_PROGRESS' && attempt.status !== 'IN_PROGRESS') {
    return { ok: false, reason: 'NOT_IN_PROGRESS' };
  }

  return { ok: true, exam, attempt };
}

export function logTelegramDiag(fields: Record<string, string | number | boolean | null | undefined>) {
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.log(`[tg] ${parts}`);
}
