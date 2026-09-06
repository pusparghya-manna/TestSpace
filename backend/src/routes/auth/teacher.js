import { registerTeacher, loginTeacher, teacherFromHeaders, resetTeacherPassword } from '../../services/teacherAuth.js';
import { json } from '../../utils/http.js';

export async function handleTeacherAuth(method, path, body, req, res) {
  if (path === '/api/auth/register' && method === 'POST') {
    try {
      return json(res, 201, await registerTeacher(body.username, body.password, body.name, body.email), req);
    } catch (e) {
      return json(res, e.status || 400, { error: e.message }, req);
    }
  }
  if (path === '/api/auth/login' && method === 'POST') {
    try {
      return json(res, 200, await loginTeacher(body.username || body.email, body.password), req);
    } catch (e) {
      return json(res, e.status || 401, { error: e.message }, req);
    }
  }
  if (path === '/api/auth/me' && method === 'GET') {
    const t = teacherFromHeaders(req.headers || {});
    if (!t) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    return json(res, 200, { teacher: t }, req);
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    return json(res, 200, { ok: true }, req);
  }
  if (path === '/api/auth/forgot-password' && method === 'POST') {
    return json(res, 501, { error: 'Password recovery is not available yet.' }, req);
  }
  if (path === '/api/auth/admin-reset-password' && method === 'POST') {
    const secret = String(process.env.CRON_SECRET || '').trim();
    const hdr = String(req.headers?.['x-cron-secret'] || req.headers?.['X-Cron-Secret'] || '').trim();
    if (!secret || hdr !== secret) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    try {
      return json(res, 200, await resetTeacherPassword(body.username, body.password || body.newPassword), req);
    } catch (e) {
      return json(res, e.status || 400, { error: e.message }, req);
    }
  }
  return null;
}
