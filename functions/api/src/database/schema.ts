/** Legacy SQL schema reference — runtime uses Appwrite document collections (see appwriteClient.ts). */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_data (
  teacher_id TEXT NOT NULL,
  key TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (teacher_id, key)
);

CREATE TABLE IF NOT EXISTS app_data_backup (
  teacher_id TEXT NOT NULL,
  key TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  backed_up_at TEXT NOT NULL,
  PRIMARY KEY (teacher_id, key, backed_up_at)
);

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  class_name TEXT,
  test_number TEXT,
  total_questions INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  total_marks REAL NOT NULL DEFAULT 0,
  negative_marking REAL NOT NULL DEFAULT 0,
  randomize_questions INTEGER NOT NULL DEFAULT 0,
  randomize_options INTEGER NOT NULL DEFAULT 0,
  result_visibility TEXT NOT NULL DEFAULT 'PUBLISHED',
  leaderboard_visibility TEXT NOT NULL DEFAULT 'PUBLISHED',
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exams_teacher ON exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exams_start ON exams(start_date);
CREATE INDEX IF NOT EXISTS idx_exams_teacher_status ON exams(teacher_id, status);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  teacher_id TEXT,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  answer INTEGER,
  marks REAL NOT NULL DEFAULT 1,
  negative_marks REAL NOT NULL DEFAULT 0,
  explanation TEXT,
  subject TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  image_file_id TEXT,
  image_mime_type TEXT,
  image_width INTEGER,
  image_height INTEGER,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_order ON questions(exam_id, sort_order);

CREATE TABLE IF NOT EXISTS question_bank (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  answer INTEGER,
  marks REAL NOT NULL DEFAULT 1,
  negative_marks REAL NOT NULL DEFAULT 0,
  explanation TEXT,
  subject TEXT,
  image_file_id TEXT,
  image_mime_type TEXT,
  image_width INTEGER,
  image_height INTEGER
);
CREATE INDEX IF NOT EXISTS idx_qbank_teacher ON question_bank(teacher_id);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  student_code TEXT NOT NULL,
  name TEXT NOT NULL,
  class_name TEXT,
  telegram_user_id INTEGER UNIQUE,
  telegram_username TEXT,
  link_code TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  joined_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_students_code ON students(student_code);
CREATE INDEX IF NOT EXISTS idx_students_tg ON students(telegram_user_id);

CREATE TABLE IF NOT EXISTS student_teachers (
  student_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  PRIMARY KEY (student_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS idx_st_teacher ON student_teachers(teacher_id);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  student_id TEXT,
  telegram_user_id INTEGER NOT NULL,
  student_name TEXT,
  student_class TEXT,
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  paused_at TEXT,
  paused_seconds INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT,
  status TEXT NOT NULL,
  current_question_index INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 0,
  percentage REAL NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  time_taken_seconds INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  is_official INTEGER NOT NULL DEFAULT 1,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_attempts_exam ON attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_tg ON attempts(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_exam_tg ON attempts(exam_id, telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts(exam_id, status, is_official);
CREATE INDEX IF NOT EXISTS idx_attempts_exam_rank ON attempts(exam_id, is_official, status, score DESC);
-- One in-progress attempt per exam+telegram user (partial unique via app logic + helper index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_unique_number
  ON attempts(exam_id, telegram_user_id, attempt_number);

CREATE TABLE IF NOT EXISTS attempt_answers (
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  option_index INTEGER NOT NULL,
  updated_at TEXT,
  PRIMARY KEY (attempt_id, question_id),
  FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_answers_attempt ON attempt_answers(attempt_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  actor TEXT,
  teacher_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_teacher ON audit_logs(teacher_id, timestamp);

CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bot_username TEXT,
  system_notice TEXT,
  bot_active INTEGER NOT NULL DEFAULT 1,
  auto_publish_results INTEGER NOT NULL DEFAULT 1,
  webhook_url TEXT,
  telegram_bot_token TEXT
);

CREATE TABLE IF NOT EXISTS broadcast_jobs (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_broadcast_teacher ON broadcast_jobs(teacher_id, created_at);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  job_id TEXT NOT NULL,
  telegram_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  PRIMARY KEY (job_id, telegram_user_id)
);

-- Idempotency for Telegram webhook/polling updates
CREATE TABLE IF NOT EXISTS telegram_processed_updates (
  update_id INTEGER PRIMARY KEY,
  processed_at TEXT NOT NULL
);
`;
