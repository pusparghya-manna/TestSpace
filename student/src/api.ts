/**
 * TestSpace Student API — same surface as the old Telegram Mini App API,
 * but authenticated with email/password (or Google) JWT instead of initData.
 */

const API_BASE = (import.meta.env.VITE_API_URL || 'https://testspace-api.appwrite.network').replace(
  /\/$/,
  ''
);
const TOKEN_KEY = 'ts_student_token';

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token: string, remember = true) {
  try {
    if (remember) localStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.setItem(TOKEN_KEY, token);
    if (!remember) localStorage.removeItem(TOKEN_KEY);
    else sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated Telegram helpers kept as no-ops so old imports do not crash */
export function getTelegramInitData(): string {
  return '';
}
export function getTelegramUser(): null {
  return null;
}
export async function waitForTelegramInitData(): Promise<boolean> {
  return Boolean(getToken());
}
export function isTelegramWebApp(): boolean {
  return false;
}

export function mediaUrl(pathOrFileId: string | null | undefined): string | null {
  if (!pathOrFileId) return null;
  if (/^https?:\/\//i.test(pathOrFileId)) return pathOrFileId;
  if (pathOrFileId.startsWith('/')) return `${API_BASE}${pathOrFileId}`;
  return `${API_BASE}/api/media/${encodeURIComponent(pathOrFileId)}`;
}

async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 20_000, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'omit',
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) clearToken();
      const error = new Error((data as any).error || `Request failed (${res.status})`);
      (error as any).status = res.status;
      (error as any).code = (data as any).code;
      (error as any).startTime = (data as any).startTime;
      (error as any).attempt = (data as any).attempt;
      (error as any).retryable = Boolean((data as any).retryable) || res.status >= 500;
      throw error;
    }
    return data as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      const timeoutError = new Error('Request is taking longer than expected.');
      (timeoutError as any).retryable = true;
      throw timeoutError;
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

async function post<T>(path: string, body?: Record<string, unknown>, options?: { timeoutMs?: number }) {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body || {}),
    timeoutMs: options?.timeoutMs,
  });
}

async function get<T>(path: string) {
  return request<T>(path, { method: 'GET' });
}

async function apiWithRetry<T>(
  path: string,
  body?: Record<string, unknown>,
  options: { timeoutMs?: number; maxRetries?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 0;
  let lastErr: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await post<T>(path, body, { timeoutMs: options.timeoutMs });
    } catch (err: any) {
      lastErr = err;
      if (!err?.retryable || i === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

export type ApiStudent = {
  id: string;
  name?: string;
  email?: string;
  className?: string;
  studentId?: string;
  status?: string;
};

export type ApiExamSummary = {
  id: string;
  title: string;
  subject?: string;
  className?: string;
  totalQuestions?: number;
  durationMinutes?: number;
  totalMarks?: number;
  startDate?: string;
  status?: string;
  resultVisibility?: string;
  leaderboardVisibility?: string;
};

export type ApiQuestion = {
  id: string;
  question?: string;
  text?: string;
  options?: string[];
  marks?: number;
  imageFileId?: string | null;
  image?: any;
  answer?: number;
  explanation?: string;
  status?: string;
  selectedIndex?: number | null;
  correctIndex?: number;
};

export type ApiAttempt = {
  id: string;
  examId: string;
  status: string;
  answers?: Record<string, number>;
  currentQuestionIndex?: number;
  score?: number;
  maxScore?: number;
  percentage?: number;
  startedAt?: string;
  submittedAt?: string;
  expiresAt?: string;
  endsAt?: string;
  practice?: boolean;
  isOfficial?: boolean;
  pausedAt?: string | null;
  pausedSeconds?: number;
  timeTakenSeconds?: number;
  studentId?: string;
  studentName?: string;
  examTitle?: string;
  resultVisibility?: string;
};

/** Auth helpers for the login overlay */
export const authApi = {
  register: (body: { email: string; password: string; name?: string }) =>
    post<{ token: string; student: ApiStudent }>('/api/student/auth/register', body),
  login: (body: { email: string; password: string }) =>
    post<{ token: string; student: ApiStudent }>('/api/student/auth/login', body),
  google: (idToken: string) =>
    post<{ token: string; student: ApiStudent }>('/api/student/auth/google', { idToken }),
  me: () => get<{ student: ApiStudent }>('/api/student/auth/me'),
};

/**
 * Same method names as the original Telegram webappApi so App.tsx and hooks keep working.
 */
export const webappApi = {
  session: async () => {
    const { student } = await authApi.me();
    // Build a session shape compatible with the original Mini App
    const results = await get<{ attempts: ApiAttempt[] }>('/api/student/results').catch(() => ({
      attempts: [],
    }));
    const ongoing =
      (await get<{ exams: ApiExamSummary[] }>('/api/student/exams').catch(() => null)) && null;
    // Find in-progress from results is incomplete; backend list attempts would be better.
    // Provide null ongoing; App will still load exams/results.
    return {
      user: {
        id: 0,
        firstName: student.name,
        lastName: '',
        username: student.email,
      },
      student: {
        id: student.id,
        name: student.name,
        className: student.className || '',
        studentId: student.id,
        status: 'active',
        email: student.email,
      },
      ongoing: null as null,
      _resultsHint: results.attempts,
    };
  },

  updateProfile: async (name: string) => {
    // No dedicated endpoint yet — return optimistic
    const me = await authApi.me();
    return { student: { ...me.student, name } };
  },

  exams: () => get<{ exams: ApiExamSummary[] }>('/api/student/exams'),

  examDetail: async (examId: string) => {
    const { exams } = await get<{ exams: ApiExamSummary[] }>('/api/student/exams');
    const exam = exams.find((e) => e.id === examId);
    if (!exam) throw new Error('Exam not found');
    return { exam };
  },

  startExam: (examId: string, forceNew?: boolean) =>
    apiWithRetry<{
      attempt: ApiAttempt;
      exam: ApiExamSummary;
      questions: ApiQuestion[];
      secondsLeft: number;
    }>(
      '/api/student/start',
      { examId, forceNew: !!forceNew, practice: false },
      { timeoutMs: 15_000, maxRetries: 0 }
    ),

  startPractice: (examId: string) =>
    post<{
      attempt: ApiAttempt;
      exam: ApiExamSummary;
      questions: ApiQuestion[];
      secondsLeft: number;
    }>('/api/student/start', { examId, practice: true }),

  syncAttempt: (
    attemptId: string,
    changes: Record<string, number | null>,
    currentQuestionIndex?: number
  ) => {
    const arr = Object.entries(changes || {}).map(([questionId, selectedIndex]) => ({
      questionId,
      selectedIndex,
      clear: selectedIndex === null,
    }));
    return post<{ ok: boolean; attempt?: ApiAttempt; secondsLeft?: number }>('/api/student/sync', {
      attemptId,
      changes: arr,
      ...(currentQuestionIndex === undefined ? {} : { currentQuestionIndex }),
    });
  },

  saveAnswer: (attemptId: string, questionId: string, optionIndex: number | null) =>
    post<{ ok: boolean; attempt?: ApiAttempt }>('/api/student/sync', {
      attemptId,
      changes: [
        {
          questionId,
          selectedIndex: optionIndex,
          clear: optionIndex === null,
        },
      ],
    }),

  setIndex: (attemptId: string, index: number) =>
    post<{ ok: boolean; attempt?: ApiAttempt }>('/api/student/sync', {
      attemptId,
      changes: [],
      currentQuestionIndex: index,
    }),

  pause: (attemptId: string, pause: boolean) =>
    apiWithRetry<{
      ok: boolean;
      paused: boolean;
      pausedAt?: string | null;
      pausedSeconds?: number;
      secondsLeft: number;
      attempt?: ApiAttempt;
    }>('/api/student/pause', { attemptId, pause }, { timeoutMs: 10_000, maxRetries: 1 }),

  submit: (attemptId: string) =>
    post<{ attempt: ApiAttempt }>('/api/student/submit', { attemptId }),

  results: async () => {
    const data = await get<{ attempts: ApiAttempt[] }>('/api/student/results');
    return {
      results: (data.attempts || []).map((a) => ({
        ...a,
        examTitle: a.examTitle || a.examId,
      })),
    };
  },

  review: (attemptId: string) =>
    post<{
      exam: { id: string; title: string; subject?: string };
      attempt: ApiAttempt;
      questions: ApiQuestion[];
    }>('/api/student/review', { attemptId }),

  leaderboard: (examId: string) =>
    post<{
      exam: { id: string; title: string };
      rows: Array<{
        rank: number;
        name: string;
        score: number;
        maxScore?: number;
        percentage: number;
        timeTakenSeconds?: number;
        isMe: boolean;
      }>;
    }>('/api/student/leaderboard', { examId }),
};
