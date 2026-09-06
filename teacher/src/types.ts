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
  question: string;
  options: string[];
  answer: number | null;
  marks: number;
  negativeMarks: number;
  explanation?: string;
  subject?: string;
  /** Telegram file_id for diagram (set after crop commit or manual photo replace) */
  image?: QuestionImage | null;
  /** AI/teacher bbox on the OCR page (normalized 0–1000 or pixels) — draft until commit */
  image_bbox?: { x: number; y: number; width: number; height: number } | null;
  /** Local preview of the bbox crop (data URL) — not stored in DB */
  imagePreview?: string | null;
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
