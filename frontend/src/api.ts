/**
 * Same-origin `/api` so Vercel rewrites proxy to Railway.
 */
const API_BASE = '';
const FETCH_TIMEOUT_MS = 45_000;
export const OCR_FETCH_TIMEOUT_MS = 180_000;

export const getToken = () => {
  try {
    return localStorage.getItem('quiz_token') || sessionStorage.getItem('quiz_token') || '';
  } catch {
    return '';
  }
};

export const setToken = (t: string, remember = true) => {
  try {
    if (remember) localStorage.setItem('quiz_token', t);
    else localStorage.removeItem('quiz_token');
    sessionStorage.setItem('quiz_token', t);
  } catch {
    /* ignore */
  }
};

export const clearToken = () => {
  try {
    localStorage.removeItem('quiz_token');
    sessionStorage.removeItem('quiz_token');
    sessionStorage.removeItem('quiz_authed');
  } catch {
    /* ignore */
  }
};

export async function api(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs, ...fetchOptions } = options;
  const headers: Record<string, string> = { ...(fetchOptions.headers as any || {}) };
  if (!(fetchOptions.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      signal: fetchOptions.signal || ctrl.signal,
    });
    if (
      res.status === 401 &&
      !path.includes('/auth/login') &&
      !path.includes('/auth/register')
    ) {
      clearToken();
    }
    return res;
  } catch (err: any) {
    const msg =
      err?.name === 'AbortError'
        ? 'Request timed out. Please try again.'
        : err?.message === 'Failed to fetch'
          ? 'Cannot reach server on this network. Try mobile data or another Wi‑Fi.'
          : err?.message || 'Network error';
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}
