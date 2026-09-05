/** Telegram Mini App → TestSpace Appwrite backend */

/** Empty = same origin. Set VITE_API_URL to Appwrite Function URL when hosted separately. */
const DEFAULT_API = 'https://testspace-api.appwrite.network';
const raw = import.meta.env.VITE_API_URL;
const configuredApiBase = (
  raw === '' || raw === undefined ? DEFAULT_API : String(raw)
).replace(/\/$/, '');
/** Always use explicit API base on Appwrite Sites (no same-origin /api proxy). */
export const API_BASE = configuredApiBase;

export function getTelegramInitData(): string {
  try {
    const sdkInitData = String((window as any)?.Telegram?.WebApp?.initData || '');
    if (sdkInitData) return sdkInitData;
    // Telegram clients can expose the signed payload in either the query string
    // or the URL fragment. The fragment form is common for Mini App launches.
    // This fallback also covers clients where the SDK initializes after React.
    const fromSearch = new URLSearchParams(window.location.search).get('tgWebAppData');
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('tgWebAppData');
    return fromSearch || fromHash || '';
  } catch {
    return '';
  }
}

export function getTelegramUser(): {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
} | null {
  try {
    const sdkUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
    if (sdkUser) return sdkUser;
    const rawUser = new URLSearchParams(getTelegramInitData()).get('user');
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export async function waitForTelegramInitData(timeoutMs = 1800): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (getTelegramInitData()) return true;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return Boolean(getTelegramInitData());
}

/** Requires signed Telegram initData (normal browsers are blocked). */
export function isTelegramWebApp(): boolean {
  return getTelegramInitData().length > 0;
}

export function mediaUrl(pathOrFileId: string | null | undefined): string | null {
  if (!pathOrFileId) return null;
  if (/^https?:\/\//i.test(pathOrFileId)) return pathOrFileId;
  if (pathOrFileId.startsWith('/')) return `${API_BASE}${pathOrFileId}`;
  return `${API_BASE}/api/media/telegram/${encodeURIComponent(pathOrFileId)}`;
}

async function api<T>(
  path: string,
  body?: Record<string, unknown>,
  options: { timeoutMs?: number } = {}
): Promise<T> {
  const initData = getTelegramInitData();
  if (!initData) {
    throw new Error('Telegram login required. Open TestSpace inside Telegram and tap Open App.');
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, ...(body || {}) }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
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
      const timeoutError = new Error(
          path.endsWith('/pause')
          ? 'Pause update is taking longer than expected.'
          : path.endsWith('/start')
            ? 'Exam request is taking longer than expected.'
            : 'Request is taking longer than expected.'
      );
      (timeoutError as any).retryable = true;
      throw timeoutError;
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
}

export type ApiExamSummary = {
  id: string;
  title: string;
  subject: string;
  className: string;
  totalQuestions: number;
  durationMinutes: number;
  totalMarks: number;
  startDate: string;
  status: string;
  resultVisibility?: string;
  leaderboardVisibility?: string;
  negativeMarking?: number;
};

export type ApiQuestion = {
  id: string;
  question: string;
  options: string[];
  marks: number;
  negativeMarks: number;
  subject?: string;
  imageFileId?: string | null;
  imageUrl?: string | null;
  explanation?: string;
  selectedIndex?: number | null;
  correctIndex?: number | null;
  status?: 'correct' | 'wrong' | 'unattempted';
};

export type ApiAttempt = {
  id: string;
  examId: string;
  status: string;
  currentQuestionIndex: number;
  answers: Record<string, number>;
  score?: number;
  maxScore?: number;
  percentage?: number;
  correctCount?: number;
  wrongCount?: number;
  skippedCount?: number;
  timeTakenSeconds?: number;
  expiresAt?: string;
  pausedAt?: string | null;
  pausedSeconds?: number;
  startedAt?: string;
  submittedAt?: string | null;
  isOfficial?: boolean;
  attemptNumber?: number;
  rank?: number | null;
  studentName?: string;
  studentId?: string;
};

export type ApiStudent = {
  id: string;
  name: string;
  studentId: string;
  className: string;
  telegramUserId: number;
  status: string;
};

async function apiWithRetry<T>(
  path: string,
  body: Record<string, unknown> | undefined,
  options: { timeoutMs?: number; maxRetries?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 1;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await api<T>(path, body, { timeoutMs: options.timeoutMs });
    } catch (err: any) {
      const networkFailure = /failed to fetch|networkerror|load failed/i.test(String(err?.message || err));
      const retryable = Boolean(err?.retryable) || err?.status === 503 || err?.status === 504 || networkFailure;
      if (!retryable || attempt >= maxRetries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

export const webappApi = {
  session: () =>
    api<{
      user: { id: number; firstName?: string; lastName?: string; username?: string };
      student: ApiStudent | null;
      ongoing: {
        attemptId: string;
        examId: string;
        examTitle: string;
        secondsLeft: number;
        currentQuestionIndex: number;
        answeredCount: number;
        totalQuestions: number;
      } | null;
    }>('/api/webapp/session'),

  updateProfile: (name: string) =>
    api<{ student: ApiStudent }>('/api/webapp/profile', { name }),

  exams: () => api<{ exams: ApiExamSummary[] }>('/api/webapp/exams'),

  examDetail: (examId: string) =>
    api<{ exam: ApiExamSummary }>('/api/webapp/exam', { examId }),

  startExam: (examId: string, forceNew?: boolean) =>
    apiWithRetry<{
      attempt: ApiAttempt;
      exam: ApiExamSummary;
      questions: ApiQuestion[];
      secondsLeft: number;
    }>('/api/webapp/start', { examId, forceNew: !!forceNew }, { timeoutMs: 15_000, maxRetries: 0 }),

  syncAttempt: (
    attemptId: string,
    changes: Record<string, number | null>,
    currentQuestionIndex?: number
  ) =>
    api<{ ok: boolean; attempt?: ApiAttempt }>('/api/webapp/sync', {
      attemptId,
      changes,
      ...(currentQuestionIndex === undefined ? {} : { currentQuestionIndex }),
    }),

  saveAnswer: (attemptId: string, questionId: string, optionIndex: number | null) =>
    api<{ ok: boolean; attempt?: ApiAttempt }>('/api/webapp/answer', {
      attemptId,
      questionId,
      optionIndex,
    }),

  setIndex: (attemptId: string, index: number) =>
    api<{ ok: boolean; attempt?: ApiAttempt }>('/api/webapp/index', { attemptId, index }),

  pause: (attemptId: string, pause: boolean) =>
    apiWithRetry<{
      ok: boolean;
      paused: boolean;
      pausedAt: string | null;
      pausedSeconds: number;
      secondsLeft: number;
    }>('/api/webapp/pause', { attemptId, pause }, { timeoutMs: 10_000, maxRetries: 1 }),

  submit: (attemptId: string) =>
    api<{ attempt: ApiAttempt }>('/api/webapp/submit', { attemptId }),

  results: () =>
    api<{
      results: Array<ApiAttempt & { examTitle: string; resultVisibility?: string }>;
    }>('/api/webapp/results'),

  review: (attemptId: string) =>
    api<{
      exam: { id: string; title: string; subject: string };
      attempt: ApiAttempt;
      questions: ApiQuestion[];
    }>('/api/webapp/review', { attemptId }),

  leaderboard: (examId: string) =>
    api<{
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
    }>('/api/webapp/leaderboard', { examId }),
};
