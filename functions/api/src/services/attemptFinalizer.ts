import { store } from '../store.js';
import { calculateAttemptScore, updateExamRanks } from './scoringService.js';

function secondsLeft(attempt: any, now = Date.now()): number {
  if (!attempt?.expiresAt) return 0;
  let deadline = new Date(attempt.expiresAt).getTime();
  if (attempt.isOfficial === false) {
    deadline += Math.max(0, Number(attempt.pausedSeconds || 0) * 1000);
    if (attempt.pausedAt) {
      const pausedAt = new Date(attempt.pausedAt).getTime();
      if (Number.isFinite(pausedAt)) deadline += Math.max(0, now - pausedAt);
    }
  }
  return Math.max(0, Math.floor((deadline - now) / 1000));
}

function activeElapsedSeconds(attempt: any, now = Date.now()): number {
  const started = new Date(attempt.startedAt).getTime();
  if (!Number.isFinite(started)) return 0;
  let pausedMs = Math.max(0, Number(attempt.pausedSeconds || 0) * 1000);
  if (attempt.isOfficial === false && attempt.pausedAt) {
    const pausedAt = new Date(attempt.pausedAt).getTime();
    if (Number.isFinite(pausedAt)) pausedMs += Math.max(0, now - pausedAt);
  }
  return Math.max(0, Math.floor((now - started - pausedMs) / 1000));
}

/**
 * Finalize exactly once when the server deadline has passed. The SQL conditional
 * transition in submitAttemptIfInProgress is the concurrency boundary, so a
 * timer tick, browser request, and Telegram request can safely race.
 */
export async function finalizeExpiredAttempt(attempt: any): Promise<any | undefined> {
  if (!attempt || attempt.status !== 'IN_PROGRESS' || secondsLeft(attempt) > 0) return attempt;
  const exam = await Promise.resolve(store.getExamById(attempt.examId));
  if (!exam) return attempt;
  await store.loadAttemptAnswers(attempt.id);
  const timeTakenSeconds = activeElapsedSeconds(attempt);
  const scored = calculateAttemptScore(exam, attempt.answers || {}, timeTakenSeconds);
  Object.assign(attempt, scored, {
    status: 'AUTO_SUBMITTED',
    submittedAt: new Date().toISOString(),
    timeTakenSeconds,
    pausedAt: null,
  });
  const transitioned = await store.submitAttemptIfInProgress(attempt);
  const persisted = transitioned ? attempt : store.getAttempts().find((item: any) => item.id === attempt.id);
  if (transitioned) {
    void updateExamRanks(exam.id).catch((error: any) => {
      console.warn('[attempt-finalizer] deferred rank update failed:', error?.message || error);
    });
    return attempt;
  }
  return persisted || attempt;
}

/** Sweep all cached active attempts. The database-backed cache is hydrated at boot. */
export async function finalizeExpiredAttempts(): Promise<number> {
  const active = await store.getInProgressAttempts();
  let finalized = 0;
  for (const attempt of active) {
    const before = attempt.status;
    const result = await finalizeExpiredAttempt(attempt);
    if (before === 'IN_PROGRESS' && result?.status !== 'IN_PROGRESS') finalized += 1;
  }
  return finalized;
}

export { secondsLeft as serverSecondsLeft, activeElapsedSeconds as serverActiveElapsedSeconds };
