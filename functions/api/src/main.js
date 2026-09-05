/**
 * TestSpace API — Appwrite Function (Node 22)
 * Auth, exams, students, Telegram webhook, Photo OCR (Gemini)
 */
import { Client, TablesDB, Storage, Users, ID, Query } from 'node-appwrite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { GoogleGenAI, Type } from '@google/genai';

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || '6a9b8c5700310779ff5c';
const tableId = process.env.APPWRITE_TABLE_ID || '6a9b8c670019ae6d8d79';
const bucketId = process.env.APPWRITE_BUCKET_ID || '6a9b8c9a0024f0a1f2f4';
const jwtSecret = process.env.JWT_SECRET || apiKey || 'dev-secret';
const maxOcrChars = Number(process.env.MAX_OCR_BASE64_CHARS) || 10_000_000;

function sdk() {
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  if (apiKey) client.setKey(apiKey);
  return {
    tables: new TablesDB(client),
    storage: new Storage(client),
    users: new Users(client),
  };
}

async function upsertRow(tables, entity, recordId, payload) {
  const list = await tables.listRows(databaseId, tableId, [
    Query.equal('entity', entity),
    Query.equal('record_id', recordId),
    Query.limit(1),
  ]);
  const data = {
    entity,
    record_id: recordId,
    payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    updated_at: new Date().toISOString(),
  };
  if (list.rows?.length) {
    return tables.updateRow(databaseId, tableId, list.rows[0].$id, data);
  }
  return tables.createRow(databaseId, tableId, ID.unique(), data);
}

async function getRow(tables, entity, recordId) {
  const list = await tables.listRows(databaseId, tableId, [
    Query.equal('entity', entity),
    Query.equal('record_id', recordId),
    Query.limit(1),
  ]);
  if (!list.rows?.length) return null;
  const row = list.rows[0];
  try {
    return { ...row, data: JSON.parse(row.payload) };
  } catch {
    return { ...row, data: row.payload };
  }
}

async function listByEntity(tables, entity, limit = 100) {
  const list = await tables.listRows(databaseId, tableId, [
    Query.equal('entity', entity),
    Query.limit(limit),
    Query.orderDesc('updated_at'),
  ]);
  return (list.rows || []).map((row) => {
    try {
      return { id: row.record_id, ...JSON.parse(row.payload), $id: row.$id };
    } catch {
      return { id: row.record_id, payload: row.payload, $id: row.$id };
    }
  });
}

function json(res, status, body) {
  return res.json(body, status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  });
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function requireTeacher(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }
}

function normalizeOcrAnswer(value, optionCount = 4) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n >= 0 && n < optionCount ? n : null;
  }
  const s = String(value).trim().toUpperCase();
  const letterMap = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };
  if (s in letterMap) return letterMap[s] < optionCount ? letterMap[s] : null;
  const asNum = Number(s);
  if (Number.isFinite(asNum)) {
    const n = Math.trunc(asNum);
    if (n >= 1 && n <= optionCount) return n - 1;
    if (n >= 0 && n < optionCount) return n;
  }
  return null;
}

function normalizeOcrQuestion(raw) {
  const options = Array.isArray(raw?.options)
    ? raw.options.map((o) => String(o ?? '').trim()).filter(Boolean).slice(0, 8)
    : [];
  return {
    question: String(raw?.question || '').trim(),
    options,
    answer: normalizeOcrAnswer(raw?.answer, options.length || 4),
    marks: Number(raw?.marks ?? 1) || 1,
    negativeMarks: Number(raw?.negativeMarks ?? raw?.negative_marks ?? 0) || 0,
    explanation: raw?.explanation ? String(raw.explanation) : undefined,
    subject: raw?.subject ? String(raw.subject) : undefined,
    has_image: !!raw?.has_image,
    image_bbox: raw?.image_bbox || null,
  };
}

async function parseQuestionsFromMedia(fileBase64, mimeType) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the API function');
  }

  const ai = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: { timeout: 180_000 },
  });

  const promptText = `Extract all multiple choice examination questions from this question paper document/image into structured JSON.

CRITICAL RULES:
1. Preserve the exact original question text cleanly.
2. Preserve the exact original option text and order. Always extract options into an array of strings.
3. "answer" must be a 0-based integer index corresponding to the correct option (0=A, 1=B, 2=C, 3=D).
4. Default "marks" to 1 unless specified. Default "negativeMarks" to 0.
5. Extract EVERY question without skipping. Don't include question numbers in the text.
6. For each question set has_image true only if there is a real diagram/figure/graph.`;

  const modelCandidates = [
    process.env.GEMINI_MODEL,
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-flash-latest',
  ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);

  const imagePart = {
    inlineData: {
      mimeType: mimeType || 'image/jpeg',
      data: fileBase64,
    },
  };

  let response = null;
  let lastErr = null;

  for (const model of modelCandidates) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }, imagePart],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    answer: { type: Type.INTEGER },
                    marks: { type: Type.NUMBER },
                    negativeMarks: { type: Type.NUMBER },
                    explanation: { type: Type.STRING },
                    subject: { type: Type.STRING },
                    has_image: { type: Type.BOOLEAN },
                    image_bbox: {
                      type: Type.OBJECT,
                      properties: {
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                      },
                    },
                  },
                  required: ['question', 'options', 'has_image'],
                },
              },
            },
            required: ['questions'],
          },
        },
      });
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e || '');
      const busy = /high demand|UNAVAILABLE|503|429|resource exhausted|quota|timed out|timeout/i.test(msg);
      if (!busy) break;
    }
  }

  if (!response) {
    const detail = String(lastErr?.message || lastErr || 'unknown error');
    if (/high demand|UNAVAILABLE|503/i.test(detail)) {
      throw new Error('Gemini is busy. Try Photo OCR again in a minute.');
    }
    throw new Error(detail || 'Gemini OCR failed');
  }

  const text = response.text;
  if (!text) throw new Error('Empty response from Gemini OCR');
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return { questions: parsed.map(normalizeOcrQuestion) };
  return {
    ...parsed,
    questions: Array.isArray(parsed?.questions) ? parsed.questions.map(normalizeOcrQuestion) : [],
  };
}

export default async ({ req, res, log, error }) => {
  if (req.method === 'OPTIONS') {
    return json(res, 204, {});
  }

  const path = (req.path || '/').replace(/\/+$/, '') || '/';
  const method = req.method || 'GET';
  log(`${method} ${path}`);

  try {
    if (path === '/' || path === '/health') {
      return json(res, 200, {
        ok: true,
        service: 'testspace-api',
        project: projectId,
        features: ['auth', 'exams', 'students', 'ocr', 'telegram-webhook'],
        ocrConfigured: !!process.env.GEMINI_API_KEY,
      });
    }
    if (path === '/ready') {
      const { tables } = sdk();
      await tables.listRows(databaseId, tableId, [Query.limit(1)]);
      return json(res, 200, { ok: true, ready: true });
    }

    const { tables } = sdk();
    const body = parseBody(req);

    if (path === '/api/auth/register' && method === 'POST') {
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const name = String(body.name || username).trim();
      const email = String(body.email || '').trim().toLowerCase();
      if (!username || password.length < 8) {
        return json(res, 400, { error: 'Username and password (min 8) required' });
      }
      const existing = await getRow(tables, 'teacher', username);
      if (existing) return json(res, 409, { error: 'Username already registered' });
      const hash = await bcrypt.hash(password, 12);
      const teacher = {
        username,
        name,
        email,
        password_hash: hash,
        created_at: new Date().toISOString(),
        auth_provider: 'legacy',
      };
      await upsertRow(tables, 'teacher', username, teacher);
      const token = jwt.sign({ username, name, email }, jwtSecret, { expiresIn: '7d' });
      return json(res, 201, { token, teacher: { username, name, email } });
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const identifier = String(body.username || body.email || '').trim();
      let row = await getRow(tables, 'teacher', identifier);
      if (!row) {
        const all = await listByEntity(tables, 'teacher', 200);
        const found = all.find((t) => t.email === identifier.toLowerCase() || t.username === identifier);
        if (found) row = { data: found };
      }
      if (!row?.data) return json(res, 401, { error: 'Invalid username or password' });
      const ok = await bcrypt.compare(String(body.password || ''), row.data.password_hash || '');
      if (!ok) return json(res, 401, { error: 'Invalid username or password' });
      const teacher = {
        username: row.data.username,
        name: row.data.name,
        email: row.data.email,
      };
      const token = jwt.sign(teacher, jwtSecret, { expiresIn: '7d' });
      return json(res, 200, { token, teacher });
    }

    if (path === '/api/auth/me' && method === 'GET') {
      const teacher = requireTeacher(req);
      if (!teacher) return json(res, 401, { error: 'Unauthorized' });
      return json(res, 200, { teacher });
    }

    // Photo OCR (Gemini)
    if (path === '/api/ocr/parse' && method === 'POST') {
      const teacher = requireTeacher(req);
      if (!teacher) return json(res, 401, { error: 'Unauthorized' });

      let fileBase64 = String(body.fileBase64 || body.image || body.base64 || '');
      if (fileBase64.includes(',')) fileBase64 = fileBase64.split(',').pop() || '';
      const mimeType = String(body.mimeType || body.mime || 'image/jpeg');

      if (!fileBase64) return json(res, 400, { error: 'fileBase64 is required' });
      if (fileBase64.length > maxOcrChars) {
        return json(res, 413, { error: 'Image too large' });
      }

      log(`OCR start teacher=${teacher.username} chars=${fileBase64.length}`);
      const result = await parseQuestionsFromMedia(fileBase64, mimeType);
      log(`OCR done questions=${result.questions?.length || 0}`);
      return json(res, 200, result);
    }

    if (path === '/api/exams' && method === 'GET') {
      const exams = await listByEntity(tables, 'exam', 200);
      return json(res, 200, { exams });
    }

    if (path === '/api/exams' && method === 'POST') {
      const teacher = requireTeacher(req);
      if (!teacher) return json(res, 401, { error: 'Unauthorized' });
      const exam = body.exam || body;
      if (!exam?.id || !exam?.title) return json(res, 400, { error: 'exam.id and title required' });
      exam.teacherId = exam.teacherId || teacher.username;
      await upsertRow(tables, 'exam', exam.id, exam);
      return json(res, 200, { exam });
    }

    if (path === '/api/students' && method === 'GET') {
      const students = await listByEntity(tables, 'student', 500);
      return json(res, 200, { students });
    }

    if (path === '/api/students' && method === 'POST') {
      const student = body.student || body;
      const id = student.id || ID.unique();
      student.id = id;
      await upsertRow(tables, 'student', id, student);
      return json(res, 200, { student });
    }

    if (path === '/api/telegram/webhook' && method === 'POST') {
      log('telegram update received');
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: 'Not found', path, method });
  } catch (e) {
    error(String(e?.message || e));
    return json(res, 500, { error: String(e?.message || e) });
  }
};
