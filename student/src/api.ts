const API_BASE = (import.meta.env.VITE_API_URL || 'https://testspace-api.appwrite.network').replace(/\/$/, '');
const TOKEN_KEY = 'ts_student_token';
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
export const setToken = (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch {} };
export const clearToken = () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} };
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'omit' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { if (res.status === 401) clearToken(); throw new Error(data.error || `Error ${res.status}`); }
  return data as T;
}
export const api = {
  register: (body: any) => request('/api/student/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => request('/api/student/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/api/student/auth/me'),
  exams: () => request('/api/student/exams'),
  start: (examId: string, opts: any = {}) => request('/api/student/start', { method: 'POST', body: JSON.stringify({ examId, ...opts }) }),
  sync: (body: any) => request('/api/student/sync', { method: 'POST', body: JSON.stringify(body) }),
  submit: (attemptId: string, answers?: any) => request('/api/student/submit', { method: 'POST', body: JSON.stringify({ attemptId, answers }) }),
  results: () => request('/api/student/results'),
};
