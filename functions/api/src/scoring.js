export function effectiveExamStatus(exam) {
  if (!exam) return 'SCHEDULED';
  if (exam.status === 'CANCELLED' || exam.status === 'DRAFT') return exam.status;
  const now = Date.now();
  const start = exam.startDate ? new Date(exam.startDate).getTime() : 0;
  const durationMs = (Number(exam.durationMinutes) || 60) * 60 * 1000;
  if (start && now < start) return 'SCHEDULED';
  if (start && now > start + durationMs) return 'COMPLETED';
  if (start && now >= start) return 'LIVE';
  return exam.status || 'SCHEDULED';
}

export function withEffectiveStatus(exam) {
  if (!exam) return exam;
  return { ...exam, status: effectiveExamStatus(exam) };
}

export function calculateAttemptScore(exam, answers = {}, timeTakenSeconds = 0) {
  const questions = exam?.questions || [];
  let score = 0;
  let maxScore = 0;
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;
  for (const q of questions) {
    const marks = Number(q.marks ?? 1) || 1;
    const neg = Number(q.negativeMarks ?? q.negative_marks ?? exam?.negativeMarking ?? 0) || 0;
    maxScore += marks;
    const sel = answers[q.id];
    if (sel === undefined || sel === null || sel === '') {
      unattempted++;
      continue;
    }
    if (q.answer !== null && q.answer !== undefined && Number(sel) === Number(q.answer)) {
      score += marks;
      correct++;
    } else {
      score -= neg;
      wrong++;
    }
  }
  if (score < 0) score = 0;
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  return { score, maxScore, percentage, correct, wrong, unattempted, timeTakenSeconds };
}

export function secondsLeft(attempt) {
  if (!attempt?.endsAt) {
    const start = attempt?.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
    const dur = (Number(attempt?.durationMinutes) || 60) * 60 * 1000;
    const end = start + dur + (Number(attempt?.pausedTotalMs) || 0);
    return Math.max(0, Math.floor((end - Date.now()) / 1000));
  }
  return Math.max(0, Math.floor((new Date(attempt.endsAt).getTime() - Date.now()) / 1000));
}
