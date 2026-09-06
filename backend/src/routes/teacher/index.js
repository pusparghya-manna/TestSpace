import { ID } from 'node-appwrite';
import { store } from '../../repositories/store.js';
import { teacherFromHeaders } from '../../services/teacherAuth.js';
import { withEffectiveStatus, calculateAttemptScore, rankOfficialAttempts } from '../../services/scoring.js';
import { parseQuestionsFromMedia } from '../../services/ocr.js';
import { uploadBase64ToStorage, processOcrCrops, getStorageFileBuffer } from '../../services/media.js';
import { ownsExam, ownsStudent } from '../../middleware/ownership.js';
import { rateLimit, corsHeaders } from '../../middleware/security.js';
import { json, match } from '../../utils/http.js';

function requireTeacher(req) {
  try {
    return teacherFromHeaders(req.headers || {}) || null;
  } catch {
    return null;
  }
}

export async function handleTeacherRoutes(method, path, body, req, res) {
  if (path === '/api/data' && method === 'GET') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const [exams, students, attempts, settings] = await Promise.all([
      store.getExams(),
      store.getStudents(),
      store.getAttempts(),
      store.getSettings(),
    ]);
    const myExams = exams.filter((e) => e.teacherId === t.username).map(withEffectiveStatus);
    const ids = new Set(myExams.map((e) => e.id));
    return json(
      res,
      200,
      {
        exams: myExams,
        students: students.filter((s) => Array.isArray(s.teacherIds) && s.teacherIds.includes(t.username)),
        attempts: attempts.filter((a) => ids.has(a.examId)),
        settings,
        teacher: t,
      },
      req
    );
  }

  if (path === '/api/dashboard/summary' && method === 'GET') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const exams = (await store.getExams()).filter((e) => e.teacherId === t.username);
    const ids = new Set(exams.map((e) => e.id));
    const myAttempts = (await store.getAttempts()).filter((a) => ids.has(a.examId));
    return json(
      res,
      200,
      {
        examCount: exams.length,
        liveCount: exams.filter((e) => withEffectiveStatus(e).status === 'LIVE').length,
        attemptCount: myAttempts.length,
        submittedCount: myAttempts.filter((a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED').length,
      },
      req
    );
  }

  if (path === '/api/stats' && method === 'GET') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const exams = (await store.getExams()).filter((e) => e.teacherId === t.username);
    const ids = new Set(exams.map((e) => e.id));
    return json(
      res,
      200,
      {
        exams: exams.length,
        students: (await store.getStudents()).filter((s) => Array.isArray(s.teacherIds) && s.teacherIds.includes(t.username)).length,
        attempts: (await store.getAttempts()).filter((a) => ids.has(a.examId)).length,
      },
      req
    );
  }

  if (path === '/api/exams' && method === 'GET') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    return json(
      res,
      200,
      { exams: (await store.getExams()).filter((e) => e.teacherId === t.username).map(withEffectiveStatus) },
      req
    );
  }

  if (path === '/api/exams' && method === 'POST') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const exam = { ...body, id: body.id || ID.unique(), teacherId: t.username, createdAt: new Date().toISOString() };
    if (Array.isArray(exam.questions)) {
      let i = 0;
      for (const q of exam.questions) {
        q.id = q.id || ID.unique();
        q.examId = exam.id;
        q.teacherId = t.username;
        q.sort_order = i++;
        await store.saveQuestion(q);
      }
      exam.totalQuestions = exam.questions.length;
    }
    await store.saveExam(exam);
    await store.addAuditLog('EXAM_CREATED', `Created exam "${exam.title}"`, t.username);
    return json(res, 200, exam, req);
  }

  {
    const m = match(path, '/api/exams/:id');
    if (m && method === 'GET') {
      const t = requireTeacher(req);
      if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
      const exam = await store.getExamById(m.id);
      if (!exam || !ownsExam(exam, t)) return json(res, 404, { error: 'Not found' }, req);
      if (!exam.questions?.length) exam.questions = await store.getQuestions(exam.id);
      return json(res, 200, { exam: withEffectiveStatus(exam) }, req);
    }
    if (m && method === 'PUT') {
      const t = requireTeacher(req);
      if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
      const existing = await store.getExamById(m.id);
      if (!existing || !ownsExam(existing, t)) return json(res, 404, { error: 'Not found' }, req);
      const exam = { ...existing, ...body, id: m.id, teacherId: t.username };
      if (Array.isArray(body.questions)) {
        let i = 0;
        for (const q of body.questions) {
          q.id = q.id || ID.unique();
          q.examId = exam.id;
          q.teacherId = t.username;
          q.sort_order = i++;
          await store.saveQuestion(q);
        }
        exam.questions = body.questions;
        exam.totalQuestions = body.questions.length;
      }
      await store.saveExam(exam);
      return json(res, 200, exam, req);
    }
    if (m && method === 'DELETE') {
      const t = requireTeacher(req);
      if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
      const existing = await store.getExamById(m.id);
      if (!existing || !ownsExam(existing, t)) return json(res, 404, { error: 'Not found' }, req);
      await store.deleteExam(m.id);
      return json(res, 200, { success: true }, req);
    }
  }

  if (path === '/api/questions' && method === 'GET') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    let questions = await store.getQuestions(body.examId || req.query?.examId);
    questions = questions.filter((q) => !q.teacherId || q.teacherId === t.username);
    return json(res, 200, { questions }, req);
  }
  if (path === '/api/questions' && method === 'POST') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const q = { ...(body.question || body), id: body.id || ID.unique(), teacherId: t.username };
    await store.saveQuestion(q);
    return json(res, 200, { question: q }, req);
  }
  {
    const m = match(path, '/api/questions/:id');
    if (m && method === 'PUT') {
      const t = requireTeacher(req);
      if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
      const q = { ...body, id: m.id, teacherId: t.username };
      await store.saveQuestion(q);
      return json(res, 200, { question: q }, req);
    }
    if (m && method === 'DELETE') {
      const t = requireTeacher(req);
      if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
      await store.deleteQuestion(m.id);
      return json(res, 200, { success: true }, req);
    }
  }

  if (path === '/api/ocr/parse' && method === 'POST') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    if (!rateLimit(`ocr:${t.username}`, 10, 60_000)) return json(res, 429, { error: 'Too many OCR requests' }, req);
    let fileBase64 = String(body.fileBase64 || body.image || body.base64 || '');
    if (fileBase64.includes(',')) fileBase64 = fileBase64.split(',').pop() || '';
    if (!fileBase64) return json(res, 400, { error: 'fileBase64 required' }, req);
    return json(res, 200, await parseQuestionsFromMedia(fileBase64, body.mimeType || 'image/jpeg'), req);
  }
  if (path === '/api/ocr/upload-image' && method === 'POST') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    let fileBase64 = String(body.fileBase64 || body.image || '');
    if (fileBase64.includes(',')) fileBase64 = fileBase64.split(',').pop() || '';
    if (!fileBase64) return json(res, 400, { error: 'fileBase64 required' }, req);
    const uploaded = await uploadBase64ToStorage(fileBase64, body.mimeType || 'image/jpeg', body.name || 'page.jpg');
    await store.saveMediaMeta({ ...uploaded, id: uploaded.fileId, teacherId: t.username });
    return json(res, 200, { ok: true, fileId: uploaded.fileId, bucketId: uploaded.bucketId }, req);
  }
  if (path === '/api/ocr/commit-crops' && method === 'POST') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    let pageBase64 = String(body.fileBase64 || body.pageBase64 || '');
    if (pageBase64.includes(',')) pageBase64 = pageBase64.split(',').pop() || '';
    const result = await processOcrCrops(pageBase64, Array.isArray(body.questions) ? body.questions : []);
    return json(res, 200, { ok: true, questions: result.questions, imageErrors: result.imageErrors, cropEngine: result.cropEngine }, req);
  }
  if (path.startsWith('/api/media/') && method === 'GET') {
    const fileId = decodeURIComponent(path.split('/').pop() || '');
    try {
      const buf = await getStorageFileBuffer(fileId);
      return json(res, 200, { fileId, base64: buf.toString('base64'), mimeType: 'image/jpeg' }, req);
    } catch {
      return json(res, 404, { error: 'Media not found' }, req);
    }
  }

  if (path === '/api/students' && method === 'GET') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    return json(
      res,
      200,
      { students: (await store.getStudents()).filter((s) => Array.isArray(s.teacherIds) && s.teacherIds.includes(t.username)) },
      req
    );
  }
  if (path === '/api/students' && method === 'POST') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const student = body.student || body;
    student.id = student.id || ID.unique();
    student.teacherIds = Array.from(new Set([...(student.teacherIds || []), t.username]));
    await store.saveStudent(student);
    return json(res, 200, { student }, req);
  }

  if (path === '/api/results' && method === 'GET') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const exams = (await store.getExams()).filter((e) => e.teacherId === t.username);
    const ids = new Set(exams.map((e) => e.id));
    return json(res, 200, { attempts: (await store.getAttempts()).filter((a) => ids.has(a.examId)), exams }, req);
  }
  if (path === '/api/results/export' && method === 'GET') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const exams = (await store.getExams()).filter((e) => e.teacherId === t.username);
    const ids = new Set(exams.map((e) => e.id));
    const attempts = (await store.getAttempts()).filter((a) => ids.has(a.examId));
    const rows = [['attemptId', 'examId', 'student', 'score', 'maxScore', 'percentage', 'status']];
    for (const a of attempts) {
      rows.push([a.id, a.examId, a.studentName || a.studentEmail || a.studentId, a.score, a.maxScore, a.percentage, a.status]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    return res.send(csv, 200, { ...corsHeaders(req), 'Content-Type': 'text/csv' });
  }
  if (path === '/api/leaderboard' && method === 'GET') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const exams = (await store.getExams()).filter((e) => e.teacherId === t.username);
    const ids = new Set(exams.map((e) => e.id));
    const attempts = (await store.getAttempts()).filter(
      (a) => ids.has(a.examId) && (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED') && a.isOfficial !== false
    );
    attempts.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    return json(res, 200, { leaderboard: attempts.slice(0, 100) }, req);
  }
  if (path === '/api/settings' && method === 'GET') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    return json(res, 200, await store.getSettings(), req);
  }
  if (path === '/api/settings' && (method === 'PUT' || method === 'POST')) {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    return json(res, 200, await store.updateSettings(body), req);
  }
  if (path === '/api/audit-logs' && method === 'GET') {
    const t = requireTeacher(req);
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    return json(res, 200, { logs: await store.getAuditLogs() }, req);
  }

  return null;
}
