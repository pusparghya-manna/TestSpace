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
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  for (const q of questions) {
    const marks = Number(q.marks ?? 1) || 1;
    const neg = Number(q.negativeMarks ?? q.negative_marks ?? exam?.negativeMarking ?? 0) || 0;
    maxScore += marks;
    const sel = answers[q.id];
    if (sel === undefined || sel === null || sel === '') {
      skippedCount++;
      continue;
    }
    if (q.answer !== null && q.answer !== undefined && Number(sel) === Number(q.answer)) {
      score += marks;
      correctCount++;
    } else {
      score -= neg;
      wrongCount++;
    }
  }
  if (score < 0) score = 0;
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  return {
    score,
    maxScore,
    percentage,
    correctCount,
    wrongCount,
    skippedCount,
    correct: correctCount,
    wrong: wrongCount,
    unattempted: skippedCount,
    timeTakenSeconds,
  };
}

/** Server-authoritative remaining seconds, accounting for pause. */
export function secondsLeft(attempt, now = Date.now()) {
  if (!attempt) return 0;
  if (attempt.pausedAt) {
    // frozen while paused
    const end = new Date(attempt.expiresAt || attempt.endsAt).getTime();
    const pausedAt = new Date(attempt.pausedAt).getTime();
    if (Number.isFinite(end) && Number.isFinite(pausedAt)) {
      return Math.max(0, Math.floor((end - pausedAt) / 1000));
    }
  }
  const endIso = attempt.expiresAt || attempt.endsAt;
  if (endIso) {
    const end = new Date(endIso).getTime();
    if (Number.isFinite(end)) return Math.max(0, Math.floor((end - now) / 1000));
  }
  const start = attempt.startedAt ? new Date(attempt.startedAt).getTime() : now;
  const dur = (Number(attempt.durationMinutes) || 60) * 60 * 1000;
  return Math.max(0, Math.floor((start + dur - now) / 1000));
}

export function rankOfficialAttempts(attempts) {
  const list = (attempts || [])
    .filter(
      (a) =>
        (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED') && a.isOfficial !== false
    )
    .slice()
    .sort(
      (a, b) =>
        (b.percentage || 0) - (a.percentage || 0) ||
        (b.score || 0) - (a.score || 0) ||
        (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0)
    );
  list.forEach((a, i) => {
    a.rank = i + 1;
  });
  return list;
}
