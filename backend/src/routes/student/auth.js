import { registerStudent, loginStudent, loginStudentWithGoogle, studentFromHeaders } from '../../services/studentAuth.js';
import { store } from '../../repositories/store.js';
import { json } from '../../utils/http.js';

export async function handleStudentAuth(method, path, body, req, res) {
  if (path === '/api/student/auth/register' && method === 'POST') {
    try {
      return json(res, 201, await registerStudent(body), req);
    } catch (e) {
      return json(res, e.status || 400, { error: e.message }, req);
    }
  }
  if (path === '/api/student/auth/login' && method === 'POST') {
    try {
      return json(res, 200, await loginStudent(body), req);
    } catch (e) {
      return json(res, e.status || 401, { error: e.message }, req);
    }
  }
  if (path === '/api/student/auth/google' && method === 'POST') {
    try {
      const idToken = body.idToken || body.credential || body.token;
      return json(res, 200, await loginStudentWithGoogle(idToken), req);
    } catch (e) {
      return json(res, e.status || 401, { error: e.message }, req);
    }
  }
  if (path === '/api/student/auth/me' && method === 'GET') {
    const s = studentFromHeaders(req.headers || {});
    if (!s) return json(res, 401, { error: 'UNAUTHORIZED' }, req);
    const full = await store.getStudentById(s.id);
    return json(
      res,
      200,
      {
        student: {
          id: s.id,
          email: s.email,
          name: full?.name || s.name,
          className: full?.className || '',
          picture: full?.picture || null,
        },
      },
      req
    );
  }
  return null;
}
