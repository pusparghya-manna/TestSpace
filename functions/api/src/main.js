/**
 * TestSpace API — Appwrite Function (Node 22)
 * HTTP-triggered. Uses TablesDB + Storage + Auth via server SDK.
 */
import { Client, TablesDB, Storage, Users, ID, Query } from 'node-appwrite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || '6a9b8c5700310779ff5c';
const tableId = process.env.APPWRITE_TABLE_ID || '6a9b8c670019ae6d8d79';
const bucketId = process.env.APPWRITE_BUCKET_ID || '6a9b8c9a0024f0a1f2f4';
const jwtSecret = process.env.JWT_SECRET || apiKey || 'dev-secret';

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

export default async ({ req, res, log, error }) => {
  if (req.method === 'OPTIONS') {
    return json(res, 204, {});
  }

  const path = (req.path || '/').replace(/\/+$/, '') || '/';
  const method = req.method || 'GET';
  log(`${method} ${path}`);

  try {
    // Health
    if (path === '/' || path === '/health') {
      return json(res, 200, {
        ok: true,
        service: 'testspace-api',
        project: projectId,
        path,
      });
    }
    if (path === '/ready') {
      const { tables } = sdk();
      await tables.listRows(databaseId, tableId, [Query.limit(1)]);
      return json(res, 200, { ok: true, ready: true });
    }

    const { tables } = sdk();
    const body = parseBody(req);

    // Auth: register teacher
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

    // Auth: login
    if (path === '/api/auth/login' && method === 'POST') {
      const identifier = String(body.username || body.email || '').trim();
      let row = await getRow(tables, 'teacher', identifier);
      if (!row) {
        // scan by email — limited
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

    // Auth: me
    if (path === '/api/auth/me' && method === 'GET') {
      const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!token) return json(res, 401, { error: 'Unauthorized' });
      try {
        const payload = jwt.verify(token, jwtSecret);
        return json(res, 200, { teacher: payload });
      } catch {
        return json(res, 401, { error: 'Invalid or expired token' });
      }
    }

    // Exams list
    if (path === '/api/exams' && method === 'GET') {
      const exams = await listByEntity(tables, 'exam', 200);
      return json(res, 200, { exams });
    }

    // Exam upsert
    if (path === '/api/exams' && method === 'POST') {
      const exam = body.exam || body;
      if (!exam?.id || !exam?.title) return json(res, 400, { error: 'exam.id and title required' });
      await upsertRow(tables, 'exam', exam.id, exam);
      return json(res, 200, { exam });
    }

    // Students
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

    // Telegram webhook placeholder
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
