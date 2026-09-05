import type { ReplyKeyboardMarkup } from '../types.js';

export type KbScreen =
  | 'main'
  | 'exams'
  | 'exam_opts'
  | 'results'
  | 'result_detail'
  | 'review'
  | 'lb_pick'
  | 'lb_exam'
  | 'in_exam'
  | 'grid'
  | 'submit_confirm';

export type KbSession = {
  screen: KbScreen;
  examIds?: string[];
  attemptIds?: string[];
  examId?: string;
  attemptId?: string;
  qIdx?: number;
  reviewPage?: number;
  gridPage?: number;
  labels?: Record<string, string>;
  lastMessageId?: number;
  lastMessageKind?: 'text' | 'photo';
  lastPhotoFileId?: string;
};

const sessions = new Map<number, KbSession>();

export function getKbSession(userId: number): KbSession | undefined {
  return sessions.get(userId);
}

export function setKbSession(userId: number, s: KbSession) {
  const prev = sessions.get(userId);
  if (prev?.lastMessageId != null && !('lastMessageId' in s)) {
    s = { ...s, lastMessageId: prev.lastMessageId };
  }
  sessions.set(userId, s);
  if (sessions.size > 5000) {
    let n = 0;
    for (const k of sessions.keys()) {
      sessions.delete(k);
      if (++n > 500) break;
    }
  }
}

export function clearKbSession(userId: number) {
  sessions.delete(userId);
}

type KbBtn = { text: string; web_app?: { url: string } };

export function kbMarkup(
  rows: (string | KbBtn)[][],
  opts?: { oneTime?: boolean }
): ReplyKeyboardMarkup {
  return {
    keyboard: rows.map((row) =>
      row.map((cell) => {
        if (typeof cell === 'string') return { text: cell.slice(0, 64) };
        const btn: any = { text: String(cell.text || '').slice(0, 64) };
        if (cell.web_app?.url) btn.web_app = { url: cell.web_app.url };
        return btn;
      })
    ),
    resize_keyboard: true,
    is_persistent: true,
    one_time_keyboard: opts?.oneTime || false,
    selective: false,
    input_field_placeholder: 'Tap a button below',
  } as ReplyKeyboardMarkup;
}

export function forceReplyNameMarkup(): {
  force_reply: true;
  selective: boolean;
  input_field_placeholder: string;
} {
  return {
    force_reply: true,
    selective: true,
    input_field_placeholder: 'Type your name…',
  };
}

export const LABELS = {
  exams: '📚 My Exams',
  results: '📊 My Results',
  leaderboard: '🏆 Leaderboard',
  setName: '✏️ Set my name',
  home: '🏠 Main menu',
  openApp: '🚀 Open App',
  backExams: '📚 Back to My Exams',
  otherLb: '🏆 Other exams',
  showFullLb: 'Show full ranking',
  startExam: '▶️ Start Exam',
  continueExam: '▶️ Continue Exam',
  viewResult: '📊 View Result',
  reattempt: '🔁 Re-attempt (Practice)',
  practiceAgain: '🔁 Practice again',
  examLb: '🏆 Exam Leaderboard',
  review: '📖 Review answers',
  scoreSum: '📊 Score summary',
  prev: '◀ Previous',
  next: 'Next ▶',
  prevPage: '◀ Prev page',
  nextPage: 'Next page ▶',
  grid: '📋 Question Grid',
  submit: '✅ Submit Exam',
  confirmSubmit: '🚀 Yes, Submit Exam Now',
  continueAns: '🔙 Continue Answering',
  myResults: '📊 My Results',
} as const;

const STABLE_WEBAPP_URL = 'https://testspace-webapp-tg.vercel.app';

export function webAppBaseUrl(): string {
  return STABLE_WEBAPP_URL;
}

/** Main menu: one Open App button; exam navigation lives in the Mini App. */
export function mainNavRows(): (string | KbBtn)[][] {
  return [[{ text: LABELS.openApp, web_app: { url: webAppBaseUrl() } }]];
}

export function numberedListRows(
  titles: string[],
  footer: string[][]
): { rows: string[][]; labels: Record<string, string> } {
  const labels: Record<string, string> = {};
  const rows: string[][] = [];
  titles.forEach((title, i) => {
    const label = `${i + 1}. ${(title || 'Item').slice(0, 40)}`.slice(0, 64);
    labels[label] = String(i);
    rows.push([label]);
  });
  for (const f of footer) rows.push(f);
  return { rows, labels };
}
