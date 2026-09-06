import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { store } from './store.js';
import { getJwtSecret } from './security.js';

function normUser(username) {
  return String(username || '').trim().toLowerCase();
}

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
  const raw = headers || {};
  const auth =
    raw['authorization'] ||
    raw['Authorization'] ||
    (typeof raw.get === 'function' ? raw.get('authorization') : '') ||
    '';
  const token = String(auth).startsWith('Bearer ') ? String(auth).slice(7).trim() : '';
  if (!token) return null;
  return verifyToken(token);
}

export async function registerTeacher(username, password, name, email) {
  username = normUser(username);
  password = String(password || '');
  name = String(name || username).trim();
  email = String(email || '').trim().toLowerCase();
  if (!username || username.length < 3) {
    throw Object.assign(new Error('Username must be at least 3 characters'), { status: 400 });
  }
  if (password.length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters'), { status: 400 });
  }
  const existing = await store.getTeacher(username);
  if (existing) {
    throw Object.assign(
      new Error('Username already registered. Please login instead.'),
      { status: 409 }
    );
  }
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
  // verify write
  const saved = await store.getTeacher(username);
  if (!saved?.password_hash) {
    throw Object.assign(new Error('Failed to save account. Try again.'), { status: 500 });
  }
  return { token: signTeacher(teacher), teacher: { username, name, email } };
}

export async function loginTeacher(username, password) {
  username = normUser(username);
  password = String(password || '');
  if (!username || !password) {
    throw Object.assign(new Error('Username and password required'), { status: 401 });
  }
  const teacher = await store.getTeacher(username);
  if (!teacher?.password_hash) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }
  const ok = await bcrypt.compare(password, teacher.password_hash);
  if (!ok) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }
  return {
    token: signTeacher(teacher),
    teacher: {
      username: teacher.username,
      name: teacher.name,
      email: teacher.email,
    },
  };
}

/** Emergency password set — requires CRON_SECRET header match */
export async function resetTeacherPassword(username, newPassword) {
  username = normUser(username);
  newPassword = String(newPassword || '');
  if (!username || newPassword.length < 8) {
    throw Object.assign(new Error('Username and password (min 8) required'), { status: 400 });
  }
  let teacher = await store.getTeacher(username);
  const password_hash = await bcrypt.hash(newPassword, 12);
  if (!teacher) {
    teacher = {
      username,
      name: username,
      email: '',
      password_hash,
      created_at: new Date().toISOString(),
      auth_provider: 'password',
    };
  } else {
    teacher = { ...teacher, password_hash };
  }
  await store.saveTeacher(teacher);
  return { ok: true, username };
}
