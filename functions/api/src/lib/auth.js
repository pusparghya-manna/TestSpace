import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { store } from './store.js';
import { getJwtSecret } from './security.js';

export function signTeacher(teacher) {
  return jwt.sign(
    { username: teacher.username, name: teacher.name, email: teacher.email },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
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

export async function loginTeacher(username, password) {
  username = String(username || '').trim();
  const teacher = await store.getTeacher(username);
  if (!teacher?.password_hash) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  const ok = await bcrypt.compare(String(password || ''), teacher.password_hash);
  if (!ok) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  return {
    token: signTeacher(teacher),
    teacher: { username: teacher.username, name: teacher.name, email: teacher.email },
  };
}
