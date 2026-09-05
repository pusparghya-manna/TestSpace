import type { Exam, Attempt } from '../types/domain.js';
import { store } from '../store.js';
import { attemptRepository } from '../repositories/attemptRepository.js';

export function calculateAttemptScore(
  exam: Exam,
  answers: Record<string, number>,
  timeTakenSecs: number
) {
  let score = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  for (const q of exam.questions || []) {
    const selected = answers[q.id];
    if (selected === undefined || selected === null) {
      skippedCount++;
      continue;
    }
    const ok = q.answer !== null && selected === q.answer;
    if (ok) {
      correctCount++;
      score += q.marks || 1;
    } else {
      wrongCount++;
      score -= q.negativeMarks || exam.negativeMarking || 0;
    }
  }
  const maxScore = exam.totalMarks || (exam.questions || []).reduce((acc, q) => acc + (q.marks || 1), 0);
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100 * 10) / 10 : 0;
  return {
    score: Math.round(score * 100) / 100,
    maxScore,
    percentage,
    correctCount,
    wrongCount,
    skippedCount,
    timeTakenSeconds: timeTakenSecs,
  };
}

export async function updateExamRanks(examId: string) {
  const all = (await Promise.resolve(store.getAttempts(examId))) as any[];
  const attempts = all.filter(
    (a) =>
      (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED') && a.isOfficial !== false
  );

  attempts.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.timeTakenSeconds !== b.timeTakenSeconds) return a.timeTakenSeconds - b.timeTakenSeconds;
    const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return aTime - bTime;
  });

  for (const att of all) {
    if (att.isOfficial === false) {
      att.rank = undefined;
      await attemptRepository.updateRank(att.id, null);
    }
  }
  for (let idx = 0; idx < attempts.length; idx++) {
    attempts[idx].rank = idx + 1;
    await attemptRepository.updateRank(attempts[idx].id, idx + 1);
  }
}
