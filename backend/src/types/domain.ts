export type ExamStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'RESULTS_PUBLISHED';
export type VisibilityStatus = 'PUBLISHED' | 'HIDDEN';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'AUTO_SUBMITTED' | 'DISQUALIFIED';

export interface QuestionImage {
  fileId: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface Question {
  id: string;
  examId?: string;
  bankId?: string;
  /** Owning teacher for question-bank items */
  teacherId?: string;
  question: string;
  options: string[];
  answer: number | null;
  marks: number;
  negativeMarks: number;
  explanation?: string;
  subject?: string;
  /** Telegram file_id for diagram/photo (stored in private media channel) */
  image?: QuestionImage | null;
}

export interface Exam {
  id: string;
  teacherId?: string;
  title: string;
  subject: string;
  className: string;
  testNumber: string;
  totalQuestions: number;
  startDate: string;
  durationMinutes: number;
  totalMarks: number;
  negativeMarking: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  resultVisibility: VisibilityStatus;
  leaderboardVisibility: VisibilityStatus;
  status: ExamStatus;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  studentId: string;
  name: string;
  className: string;
  telegramUserId: number | null;
  telegramUsername: string | null;
  linkCode: string;
  status: 'linked' | 'unlinked';
  linkedAt?: string;
  joinedAt?: string;
  /** Teachers whose exams this student has opened */
  teacherIds?: string[];
}

export interface Attempt {
  id: string;
  examId: string;
  studentId: string;
  telegramUserId: number;
  studentName: string;
  studentClass: string;
  startedAt: string;
  expiresAt: string;
  /** Practice-only pause state; official attempts never use these fields. */
  pausedAt?: string | null;
  pausedSeconds?: number;
  submittedAt: string | null;
  status: AttemptStatus;
  answers: Record<string, number>;
  currentQuestionIndex: number;
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeTakenSeconds: number;
  rank?: number;
  /** First attempt counts for leaderboard; reattempts are practice-only */
  isOfficial?: boolean;
  attemptNumber?: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  actor: string;
}

export interface SystemSettings {
  telegramBotToken: string;
  webhookUrl: string;
  botUsername: string;
  botActive: boolean;
  autoPublishResults: boolean;
  systemNotice: string;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

/** Bottom-of-screen custom keyboard (ReplyKeyboard) */
export interface ReplyKeyboardButton {
  text: string;
}

export interface ReplyKeyboardMarkup {
  keyboard: ReplyKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  is_persistent?: boolean;
  selective?: boolean;
  input_field_placeholder?: string;
}

export interface ForceReplyMarkup {
  force_reply: true;
  selective?: boolean;
  input_field_placeholder?: string;
}

export interface ReplyKeyboardRemove {
  remove_keyboard: true;
  selective?: boolean;
}

export interface TelegramChat {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  type: 'private' | 'group';
}

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  reply_markup?: InlineKeyboardMarkup;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface SimulatorResponse {
  chatId: number;
  text: string;
  /** Inline buttons under the message */
  replyMarkup?: InlineKeyboardMarkup;
  /**
   * Bottom input-area keyboard (ReplyKeyboard).
   * Only applied on sendMessage (Telegram cannot attach it via editMessageText).
   */
  replyKeyboard?: ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReplyMarkup;
  /** Remove a persistent reply keyboard before sending this response. */
  clearReplyKeyboard?: boolean;
  messageId?: number;
  /** Delete this message id before sending (photo↔text transition) */
  deletePreviousMessageId?: number;
  /** Defaults to Markdown when omitted */
  parseMode?: 'Markdown' | 'HTML';
  /** When set, send/edit as a photo message using Telegram file_id */
  photoFileId?: string;
  /** Caption for photo messages (falls back to text) */
  caption?: string;
  type: 'sendMessage' | 'editMessageText' | 'sendPhoto' | 'editMessageMedia';
}
