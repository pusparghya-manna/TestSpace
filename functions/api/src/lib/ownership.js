export function teacherIdOf(teacher) {
  return teacher?.username || teacher?.id || null;
}

export function ownsExam(exam, teacher) {
  if (!exam || !teacher) return false;
  const tid = teacherIdOf(teacher);
  if (!exam.teacherId) return true; // legacy rows without owner treated as shared carefully
  return exam.teacherId === tid;
}

export function ownsQuestion(q, teacher, exam) {
  if (!teacher) return false;
  const tid = teacherIdOf(teacher);
  if (q?.teacherId && q.teacherId === tid) return true;
  if (exam && ownsExam(exam, teacher)) return true;
  if (q?.examId && exam?.id === q.examId && ownsExam(exam, teacher)) return true;
  return false;
}

export function ownsStudent(student, teacher) {
  if (!student || !teacher) return false;
  const tid = teacherIdOf(teacher);
  const ids = student.teacherIds || [];
  if (Array.isArray(ids) && ids.includes(tid)) return true;
  if (student.teacherId === tid) return true;
  return false;
}

export function ownsAttempt(attempt, exam, teacher) {
  if (!attempt || !teacher) return false;
  if (exam) return ownsExam(exam, teacher);
  return attempt.teacherId === teacherIdOf(teacher);
}

/** Hide existence of foreign resources */
export function notFoundOrForbidden(res, json) {
  return json(res, 404, { error: 'Not found' });
}
