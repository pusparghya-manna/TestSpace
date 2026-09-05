import { Client, TablesDB, ID, Query } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || '6a9b8c5700310779ff5c';
const tableId = process.env.APPWRITE_TABLE_ID || '6a9b8c670019ae6d8d79';

function tables() {
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  if (apiKey) client.setKey(apiKey);
  return new TablesDB(client);
}

function parsePayload(row) {
  try {
    return typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  } catch {
    return {};
  }
}

async function listEntity(entity, limit = 500) {
  const t = tables();
  const all = [];
  let cursor = null;
  while (all.length < limit) {
    const queries = [Query.equal('entity', entity), Query.limit(Math.min(100, limit - all.length)), Query.orderDesc('updated_at')];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await t.listRows(databaseId, tableId, queries);
    const rows = res.rows || [];
    if (!rows.length) break;
    for (const row of rows) {
      all.push({ ...parsePayload(row), $rowId: row.$id, id: parsePayload(row).id || row.record_id });
    }
    if (rows.length < 100) break;
    cursor = rows[rows.length - 1].$id;
  }
  return all;
}

async function getEntity(entity, recordId) {
  const t = tables();
  const res = await t.listRows(databaseId, tableId, [
    Query.equal('entity', entity),
    Query.equal('record_id', String(recordId)),
    Query.limit(1),
  ]);
  if (!res.rows?.length) return null;
  const row = res.rows[0];
  const data = parsePayload(row);
  return { ...data, $rowId: row.$id, id: data.id || row.record_id };
}

async function upsertEntity(entity, recordId, data) {
  const t = tables();
  const payload = JSON.stringify({ ...data, id: data.id || recordId });
  const existing = await t.listRows(databaseId, tableId, [
    Query.equal('entity', entity),
    Query.equal('record_id', String(recordId)),
    Query.limit(1),
  ]);
  const fields = {
    entity,
    record_id: String(recordId),
    payload,
    updated_at: new Date().toISOString(),
  };
  if (existing.rows?.length) {
    await t.updateRow(databaseId, tableId, existing.rows[0].$id, fields);
    return { ...data, $rowId: existing.rows[0].$id };
  }
  const row = await t.createRow(databaseId, tableId, ID.unique(), fields);
  return { ...data, $rowId: row.$id };
}

async function deleteEntity(entity, recordId) {
  const t = tables();
  const existing = await t.listRows(databaseId, tableId, [
    Query.equal('entity', entity),
    Query.equal('record_id', String(recordId)),
    Query.limit(1),
  ]);
  if (existing.rows?.length) {
    await t.deleteRow(databaseId, tableId, existing.rows[0].$id);
    return true;
  }
  return false;
}

export const store = {
  async getExams() {
    return listEntity('exam');
  },
  async getExamById(id) {
    return getEntity('exam', id);
  },
  async saveExam(exam) {
    if (!exam.id) exam.id = ID.unique();
    exam.updatedAt = new Date().toISOString();
    if (!exam.createdAt) exam.createdAt = exam.updatedAt;
    await upsertEntity('exam', exam.id, exam);
    return exam;
  },
  async deleteExam(id) {
    const exam = await getEntity('exam', id);
    if (!exam) return false;
    // delete related questions and attempts
    const questions = (await listEntity('question', 2000)).filter((q) => q.examId === id || q.exam_id === id);
    for (const q of questions) await deleteEntity('question', q.id);
    const attempts = (await listEntity('attempt', 2000)).filter((a) => a.examId === id);
    for (const a of attempts) await deleteEntity('attempt', a.id);
    await deleteEntity('exam', id);
    return true;
  },

  async getStudents() {
    return listEntity('student');
  },
  async getStudentById(id) {
    return getEntity('student', id);
  },
  async getStudentByTelegramId(tg) {
    const all = await listEntity('student', 2000);
    return all.find((s) => Number(s.telegramUserId) === Number(tg)) || null;
  },
  async saveStudent(student) {
    if (!student.id) student.id = ID.unique();
    await upsertEntity('student', student.id, student);
    return student;
  },
  async deleteStudent(id) {
    return deleteEntity('student', id);
  },
  async linkStudentTeacher(studentId, teacherId) {
    const s = await getEntity('student', studentId);
    if (!s) return null;
    const ids = Array.isArray(s.teacherIds) ? s.teacherIds : [];
    if (!ids.includes(teacherId)) ids.push(teacherId);
    s.teacherIds = ids;
    await upsertEntity('student', studentId, s);
    return s;
  },

  async getAttempts(examId) {
    const all = await listEntity('attempt', 3000);
    if (examId) return all.filter((a) => a.examId === examId);
    return all;
  },
  async getInProgressAttempts() {
    const all = await listEntity('attempt', 3000);
    return all.filter((a) => a.status === 'IN_PROGRESS');
  },
  async getStudentAttempts(examId, telegramUserId) {
    const all = await listEntity('attempt', 3000);
    return all.filter((a) => a.examId === examId && Number(a.telegramUserId) === Number(telegramUserId));
  },
  async getAttempt(examId, telegramUserId) {
    const list = await this.getStudentAttempts(examId, telegramUserId);
    return list.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))[0] || null;
  },
  async nextAttemptNumber(examId, telegramUserId) {
    const list = await this.getStudentAttempts(examId, telegramUserId);
    return list.length + 1;
  },
  async deleteAttempt(id) {
    return deleteEntity('attempt', id);
  },
  async saveAttempt(attempt) {
    if (!attempt.id) attempt.id = ID.unique();
    attempt.updatedAt = new Date().toISOString();
    await upsertEntity('attempt', attempt.id, attempt);
    return attempt;
  },
  async updateAttemptPause(attempt) {
    await upsertEntity('attempt', attempt.id, attempt);
    return true;
  },
  async loadAttemptAnswers(attemptId) {
    const a = await getEntity('attempt', attemptId);
    return a?.answers || {};
  },
  async saveAnswer(attemptId, questionId, optionIndex, currentQuestionIndex) {
    const a = await getEntity('attempt', attemptId);
    if (!a || a.status !== 'IN_PROGRESS') return false;
    a.answers = a.answers || {};
    a.answers[questionId] = optionIndex;
    if (typeof currentQuestionIndex === 'number') a.currentQuestionIndex = currentQuestionIndex;
    a.updatedAt = new Date().toISOString();
    await upsertEntity('attempt', attemptId, a);
    return true;
  },
  async clearAnswer(attemptId, questionId) {
    const a = await getEntity('attempt', attemptId);
    if (!a) return false;
    if (a.answers) delete a.answers[questionId];
    await upsertEntity('attempt', attemptId, a);
    return true;
  },
  async updateAttemptIndex(attemptId, index) {
    const a = await getEntity('attempt', attemptId);
    if (!a) return false;
    a.currentQuestionIndex = index;
    await upsertEntity('attempt', attemptId, a);
    return true;
  },
  async submitAttemptIfInProgress(attempt) {
    const a = await getEntity('attempt', attempt.id);
    if (!a || a.status !== 'IN_PROGRESS') return false;
    Object.assign(a, attempt, { status: attempt.status || 'SUBMITTED' });
    await upsertEntity('attempt', a.id, a);
    return true;
  },

  async getQuestions() {
    return listEntity('question', 3000);
  },
  async saveQuestion(q) {
    if (!q.id) q.id = ID.unique();
    await upsertEntity('question', q.id, q);
    return q;
  },
  async deleteQuestion(id) {
    return deleteEntity('question', id);
  },

  async getSettings() {
    const s = await getEntity('settings', 'system');
    return (
      s || {
        id: 'system',
        botWelcome: 'Welcome to TestSpace!',
        maintenanceMode: false,
        allowPractice: true,
      }
    );
  },
  async updateSettings(partial) {
    const cur = await this.getSettings();
    const next = { ...cur, ...partial, id: 'system' };
    await upsertEntity('settings', 'system', next);
    return next;
  },

  async getAuditLogs() {
    return listEntity('audit', 200);
  },
  async addAuditLog(action, details, actor = 'system') {
    const id = ID.unique();
    const row = { id, action, details, actor, createdAt: new Date().toISOString() };
    await upsertEntity('audit', id, row);
    return row;
  },

  async getTeacher(username) {
    return getEntity('teacher', username);
  },
  async saveTeacher(teacher) {
    await upsertEntity('teacher', teacher.username, teacher);
    return teacher;
  },

  async claimTelegramUpdate(updateId) {
    const id = String(updateId);
    const existing = await getEntity('tg_update', id);
    if (existing) return false;
    await upsertEntity('tg_update', id, { id, claimedAt: new Date().toISOString() });
    return true;
  },
};
