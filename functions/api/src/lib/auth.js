import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { store } from './store.js';

const jwtSecret = process.env.JWT_SECRET || process.env.APPWRITE_API_KEY || 'dev-secret';

export function signTeacher(teacher) {
  return jwt.sign(
    { username: teacher.username, name: teacher.name, email: teacher.email },
    jwtSecret,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }
}

export function teacherFromHeaders(headers) {
  const auth = headers['authorization'] || headers['Authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  return verifyToken(token);
}

export async function registerTeacher(username, password, name, email) {
  username = String(username || '').trim();
  password = String(password || '');
  name = String(name || username).trim();
  email = String(email || '').trim().toLowerCase();
  if (!username || password.length < 8) throw new Error('Username and password (min 8) required');
  const existing = await store.getTeacher(username);
  if (existing) throw Object.assign(new Error('Username already registered'), { status: 409 });
  const password_hash = await bcrypt.hash(password, 12);
  const teacher = {
    username,
    name,
    email,
    password_hash,
    created_at: new Date().toISOString(),
    auth_provider: 'password',
  };
  await store.saveTeacher(teacher);
  return { token: signTeacher(teacher), teacher: { username, name, email } };
}

export async function loginTeacher(identifier, password) {
  identifier = String(identifier || '').trim();
  let teacher = await store.getTeacher(identifier);
  if (!teacher) {
    const all = await store.getExams().then(() => null);
    // scan teachers via exam is wrong — list via entity
    // fallback: try email match by scanning
  }
  if (!teacher) {
    // try load by username only
    teacher = await store.getTeacher(identifier);
  }
  if (!teacher?.password_hash) {
    // scan all teachers limited
    const { Client, TablesDB, Query } = await import('node-appwrite');
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);
    const tables = new TablesDB(client);
    const res = await tables.listRows(
      process.env.APPWRITE_DATABASE_ID,
      process.env.APPWRITE_TABLE_ID,
      [Query.equal('entity', 'teacher'), Query.limit(200)]
    );
    for (const row of res.rows || []) {
      try {
        const d = JSON.parse(row.payload);
        if (d.username === identifier || d.email === identifier.toLowerCase()) {
          teacher = d;
          break;
        }
      } catch {}
    }
  }
  if (!teacher?.password_hash) throw Object.assign(new Error('Invalid username or password'), { status: 401 });
  const ok = await bcrypt.compare(String(password || ''), teacher.password_hash);
  if (!ok) throw Object.assign(new Error('Invalid username or password'), { status: 401 });
  const safe = { username: teacher.username, name: teacher.name, email: teacher.email };
  return { token: signTeacher(safe), teacher: safe };
}
