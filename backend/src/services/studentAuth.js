
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { store } from '../repositories/store.js';
import { getJwtSecret } from '../middleware/security.js';

function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function signStudent(student) {
  return jwt.sign(
    { role: 'student', id: student.id, email: student.email, name: student.name },
    getJwtSecret(),
    { expiresIn: '30d' }
  );
}

export function studentFromHeaders(headers) {
  const raw = headers || {};
  const auth = raw['authorization'] || raw['Authorization'] || '';
  const token = String(auth).startsWith('Bearer ') ? String(auth).slice(7).trim() : '';
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (payload?.role !== 'student' || !payload.id) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function registerStudent({ email, password, name }) {
  email = normEmail(email);
  password = String(password || '');
  name = String(name || email.split('@')[0] || 'Student').trim();
  if (!email || !email.includes('@')) throw Object.assign(new Error('Valid email required'), { status: 400 });
  if (password.length < 8) throw Object.assign(new Error('Password must be at least 8 characters'), { status: 400 });
  if (await store.getStudentByEmail(email)) {
    throw Object.assign(new Error('Email already registered. Please login instead.'), { status: 409 });
  }
  const id = `STU_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const password_hash = await bcrypt.hash(password, 12);
  const student = {
    id, email, name, password_hash, className: '', teacherIds: [], status: 'active',
    auth_provider: 'password', createdAt: new Date().toISOString(),
  };
  await store.saveStudent(student);
  return { token: signStudent(student), student: { id, email, name } };
}

export async function loginStudent({ email, password }) {
  email = normEmail(email);
  password = String(password || '');
  const student = await store.getStudentByEmail(email);
  if (!student?.password_hash) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  if (!(await bcrypt.compare(password, student.password_hash))) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }
  return {
    token: signStudent(student),
    student: { id: student.id, email: student.email, name: student.name, className: student.className || '' },
  };
}
