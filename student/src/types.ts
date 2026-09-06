/** Student Mini App types — mapped 1:1 from backend domain + webapp API. */

export type ExamStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'LIVE'
  | 'ENDED'
  | 'RESULTS_PUBLISHED'
  | string;

export interface Question {
  id: string;
  question: string;
  options: string[];
  marks: number;
  negativeMarks: number;
  subject?: string;
  imageFileId?: string | null;
  imageUrl?: string | null;
  explanation?: string;
  /** Review-only */
  selectedIndex?: number | null;
  correctIndex?: number | null;
  status?: 'correct' | 'wrong' | 'unattempted';
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  className: string;
  totalQuestions: number;
  durationMinutes: number;
  totalMarks: number;
  startDate?: string;
  status: ExamStatus;
  resultVisibility?: string;
  leaderboardVisibility?: string;
  negativeMarking?: number;
  questions?: Question[];
}

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle: string;
  className?: string;
  /** questionId → option index */
  answers: Record<string, number>;
  /** questionId → marked for review */
  marked: Record<string, boolean>;
  /** questionId → visited */
  visited: Record<string, boolean>;
  secondsLeft: number;
  pausedAt?: string | null;
  pausedSeconds?: number;
  totalDurationSeconds: number;
  timeSpentSeconds: number;
  startedAt: string;
  submittedAt?: string | null;
  completedAt?: string;
  isSubmitted: boolean;
  isOfficial?: boolean;
  attemptNumber?: number;
  currentQuestionIndex?: number;
  score?: number;
  maxScore?: number;
  percentage?: number;
  correctCount?: number;
  wrongCount?: number;
  skippedCount?: number;
  accuracy?: number;
  rank?: number | null;
  status?: string;
  questions?: Question[];
  resultVisibility?: string;
}

export interface UserProfile {
  name: string;
  studentId: string;
  classLevel: string;
  track: string;
  telegramAccount: string;
  telegramUserId?: number;
  avatarColor: string;
  photoUrl?: string | null;
  theme: 'light' | 'dark' | 'system';
  soundEnabled: boolean;
  timerAlerts: boolean;
  fontSize: 'normal' | 'large';
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  maxScore?: number;
  percentage: number;
  timeTakenSeconds?: number;
  isMe: boolean;
}

export interface OngoingSummary {
  attemptId: string;
  examId: string;
  examTitle: string;
  secondsLeft: number;
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
}
