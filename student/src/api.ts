const API_BASE = (import.meta.env.VITE_API_URL || 'https://testspace-api.appwrite.network').replace(/\/$/, '');
const TOKEN_KEY = 'ts_student_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}
export function setToken(t: string) {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {}
}
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'omit' });
  } catch {
    throw new Error('Cannot reach server. Check your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearToken();
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  register: (body: { email: string; password: string; name?: string }) =>
    request<{ token: string; student: any }>('/api/student/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; student: any }>('/api/student/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  google: (idToken: string) =>
    request<{ token: string; student: any }>('/api/student/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),
  me: () => request<{ student: any }>('/api/student/auth/me'),
  exams: () => request<{ exams: any[] }>('/api/student/exams'),
  start: (examId: string, opts?: { practice?: boolean; forceNew?: boolean }) =>
    request<any>('/api/student/start', { method: 'POST', body: JSON.stringify({ examId, ...opts }) }),
  sync: (body: any) => request<any>('/api/student/sync', { method: 'POST', body: JSON.stringify(body) }),
  pause: (attemptId: string, pause: boolean) =>
    request<any>('/api/student/pause', { method: 'POST', body: JSON.stringify({ attemptId, pause }) }),
  submit: (attemptId: string, answers?: Record<string, number>) =>
    request<any>('/api/student/submit', { method: 'POST', body: JSON.stringify({ attemptId, answers }) }),
  results: () => request<{ attempts: any[] }>('/api/student/results'),
  review: (attemptId: string) =>
    request<any>('/api/student/review', { method: 'POST', body: JSON.stringify({ attemptId }) }),
};

export function mediaUrl(fileId?: string | null) {
  if (!fileId) return null;
  if (/^https?:\/\//i.test(fileId)) return fileId;
  return `${API_BASE}/api/media/${encodeURIComponent(fileId)}`;
}
