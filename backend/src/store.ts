/**
 * Production store: Appwrite Databases is the authoritative source of truth.
 * In-memory structures are a bounded cache only; writes always go to Appwrite first.
 */
import { listDocs, getDoc, COLLECTIONS, Query, initDb } from './database/client.js';
import { Exam, Question, Student, Attempt, AuditLog, SystemSettings } from './types/domain.js';
import { effectiveExamStatus } from './examStatus.js';
import {
  examRepository,
  attemptRepository,
  answerRepository,
  studentRepository,
  auditRepository,
  questionRepository,
  telegramUpdateRepository,
} from './repositories/index.js';

const AUDIT_CACHE_MAX = 200;
// Dashboard and ownership queries must see the complete authorized attempt history.
// The database remains the source of truth; this process keeps all attempt metadata
// needed by the current API architecture and loads answer maps on demand.
const ATTEMPT_CACHE_MAX = 100_000;

function generateInitialSettings(): SystemSettings {
  return {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    webhookUrl: '',
    botUsername: '@testspace_bot',
    botActive: true,
    autoPublishResults: true,
    systemNotice: 'System ready for exam setup.',
  };
}

function mapAttemptRow(r: any, answers: Record<string, number> = {}): Attempt {
  return {
    id: String(r.id),
    examId: String(r.exam_id),
    studentId: String(r.student_id || ''),
    telegramUserId: Number(r.telegram_user_id),
    studentName: String(r.student_name || ''),
    studentClass: r.student_class ? String(r.student_class) : '',
    startedAt: String(r.started_at),
    expiresAt: String(r.expires_at),
    pausedAt: r.paused_at ? String(r.paused_at) : null,
    pausedSeconds: Number(r.paused_seconds || 0),
    submittedAt: r.submitted_at ? String(r.submitted_at) : null,
    status: r.status as Attempt['status'],
    currentQuestionIndex: Number(r.current_question_index || 0),
    answers,
    score: Number(r.score || 0),
    maxScore: Number(r.max_score || 0),
    percentage: Number(r.percentage || 0),
    correctCount: Number(r.correct_count || 0),
    wrongCount: Number(r.wrong_count || 0),
    skippedCount: Number(r.skipped_count || 0),
    timeTakenSeconds: Number(r.time_taken_seconds || 0),
    rank: r.rank != null ? Number(r.rank) : undefined,
    isOfficial: Number(r.is_official) !== 0,
    attemptNumber: Number(r.attempt_number || 1),
  };
}

class Store {
  private data = {
    exams: [] as Exam[],
    questionBank: [] as Question[],
    students: [] as Student[],
    attempts: [] as Attempt[],
    auditLogs: [] as AuditLog[],
    settings: generateInitialSettings(),
  };
  private ready = false;

  isReady() {
    return this.ready;
  }

  async init() {
    try {
      await initDb();
      await this.loadFromSql();
      if (process.env.TELEGRAM_BOT_TOKEN) {
        this.data.settings.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
      }
      this.ready = true;
      console.log(
        `[store] ready exams=${this.data.exams.length} students=${this.data.students.length} attempts=${this.data.attempts.length}`
      );
    } catch (e) {
      console.error('Store init error', e);
      const isProd = process.env.NODE_ENV === 'production' || !!process.env.APPWRITE_FUNCTION_ID;
      if (isProd) {
        this.ready = false;
        throw e;
      }
      this.ready = true;
    }
  }

  private async loadFromSql() {
    // Load via Appwrite document repositories
    const examRows = await examRepository.findAll();
    this.data.exams = [];
    for (const r of examRows as any[]) {
      this.data.exams.push({
        id: String(r.id),
        teacherId: String(r.teacher_id || 'default'),
        title: String(r.title),
        subject: r.subject ? String(r.subject) : '',
        className: r.class_name ? String(r.class_name) : '',
        testNumber: r.test_number ? String(r.test_number) : '',
        totalQuestions: Number(r.total_questions || 0),
        startDate: String(r.start_date),
        durationMinutes: Number(r.duration_minutes || 60),
        totalMarks: Number(r.total_marks || 0),
        negativeMarking: Number(r.negative_marking || 0),
        randomizeQuestions: !!r.randomize_questions,
        randomizeOptions: !!r.randomize_options,
        resultVisibility: (r.result_visibility as any) || 'PUBLISHED',
        leaderboardVisibility: (r.leaderboard_visibility as any) || 'PUBLISHED',
        status: (r.status as any) || 'SCHEDULED',
        questions: [],
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      });
    }

    if (this.data.exams.length > 0) {
      const examIds = this.data.exams.map((e) => e.id);
      const qres = await examRepository.findQuestionsByExamIds(examIds);
      const byExam = new Map<string, Question[]>();
      for (const q of qres as any[]) {
        const examId = String(q.exam_id);
        let opts: string[] = [];
        try {
          opts = JSON.parse(String(q.options_json || '[]'));
        } catch {
          opts = [];
        }
        const qq: Question = {
          id: String(q.id),
          question: String(q.question),
          options: opts,
          answer: q.answer != null ? Number(q.answer) : null,
          marks: Number(q.marks ?? 1),
          negativeMarks: Number(q.negative_marks ?? 0),
          explanation: q.explanation ? String(q.explanation) : undefined,
          subject: q.subject ? String(q.subject) : undefined,
          teacherId: q.teacher_id ? String(q.teacher_id) : undefined,
          image: q.image_file_id
            ? {
                fileId: String(q.image_file_id),
                mimeType: q.image_mime_type ? String(q.image_mime_type) : undefined,
                width: q.image_width != null ? Number(q.image_width) : undefined,
                height: q.image_height != null ? Number(q.image_height) : undefined,
              }
            : undefined,
        };
        if (!byExam.has(examId)) byExam.set(examId, []);
        byExam.get(examId)!.push(qq);
      }
      for (const exam of this.data.exams) {
        exam.questions = byExam.get(exam.id) || [];
      }
    }

    const studentRows = await studentRepository.findAll();
    this.data.students = (studentRows as any[]).map((r) => ({
      id: String(r.$id || r.id),
      studentCode: String(r.student_code || ''),
      name: String(r.name || ''),
      className: r.class_name ? String(r.class_name) : '',
      telegramUserId: r.telegram_user_id != null ? Number(r.telegram_user_id) : undefined,
      telegramUsername: r.telegram_username ? String(r.telegram_username) : undefined,
      linkCode: r.link_code ? String(r.link_code) : undefined,
      status: (r.status as any) || 'ACTIVE',
      joinedAt: r.joined_at ? String(r.joined_at) : undefined,
      teacherIds: [] as string[],
    }));

    // Attach teacher links
    for (const s of this.data.students) {
      try {
        s.teacherIds = await studentRepository.teachersForStudent(s.id);
      } catch {
        s.teacherIds = [];
      }
    }

    const attemptRows = await attemptRepository.findAll(ATTEMPT_CACHE_MAX);
    this.data.attempts = (attemptRows as any[]).map((r) => ({
      id: String(r.id),
      examId: String(r.exam_id),
      studentId: r.student_id ? String(r.student_id) : undefined,
      telegramUserId: Number(r.telegram_user_id),
      studentName: r.student_name ? String(r.student_name) : undefined,
      studentClass: r.student_class ? String(r.student_class) : undefined,
      startedAt: String(r.started_at),
      expiresAt: String(r.expires_at),
      pausedAt: r.paused_at ? String(r.paused_at) : undefined,
      pausedSeconds: Number(r.paused_seconds || 0),
      submittedAt: r.submitted_at ? String(r.submitted_at) : undefined,
      status: r.status as any,
      currentQuestionIndex: Number(r.current_question_index || 0),
      score: Number(r.score || 0),
      maxScore: Number(r.max_score || 0),
      percentage: Number(r.percentage || 0),
      correctCount: Number(r.correct_count || 0),
      wrongCount: Number(r.wrong_count || 0),
      skippedCount: Number(r.skipped_count || 0),
      timeTakenSeconds: Number(r.time_taken_seconds || 0),
      rank: r.rank != null ? Number(r.rank) : undefined,
      isOfficial: r.is_official !== 0 && r.is_official !== false,
      attemptNumber: Number(r.attempt_number || 1),
      answers: {} as Record<string, number>,
    }));

    const auditRows = await auditRepository.findRecent(AUDIT_CACHE_MAX);
    this.data.auditLogs = (auditRows as any[]).map((r) => ({
      id: String(r.$id || r.id),
      timestamp: String(r.timestamp),
      action: String(r.action),
      details: r.details ? String(r.details) : undefined,
      actor: r.actor ? String(r.actor) : undefined,
      teacherId: r.teacher_id ? String(r.teacher_id) : undefined,
    }));

    // System settings (single doc id "1" or first)
    try {
      const settingsDocs = await listDocs(COLLECTIONS.system_settings, [], 1);
      if (settingsDocs[0]) {
        const s: any = settingsDocs[0];
        this.data.settings = {
          ...this.data.settings,
          botUsername: s.bot_username || this.data.settings.botUsername,
          systemNotice: s.system_notice || '',
          botActive: s.bot_active !== false,
          autoPublishResults: s.auto_publish_results !== false,
          webhookUrl: s.webhook_url || '',
          telegramBotToken: s.telegram_bot_token || this.data.settings.telegramBotToken,
        };
      }
    } catch (e) {
      console.warn('[store] settings load skipped', e);
    }
  }


  async loadAttemptAnswers(attemptId: string): Promise<Record<string, number>> {
    const answers = await answerRepository.findByAttemptId(attemptId);
    const att = this.data.attempts.find((x) => x.id === attemptId);
    if (att) att.answers = answers;
    return answers;
  }

  /** Atomic exam upsert + full question replacement. */
  private async persistExam(exam: Exam) {
    await examRepository.saveExamWithQuestions(exam);
  }

  private async persistStudent(student: Student) {
    await studentRepository.saveStudent(student);
  }

  /** Upsert attempt row; replace answers only when full answers map is provided and not empty-for-progress. */
  private async persistAttempt(attempt: Attempt, opts: { replaceAnswers?: boolean } = {}) {
    await attemptRepository.upsertAttempt(attempt, opts.replaceAnswers !== false);
  }

  /** Single-answer UPSERT — preferred for live exam answering (idempotent). */
  async saveAnswer(attemptId: string, questionId: string, optionIndex: number, currentQuestionIndex?: number) {
    const ok = await answerRepository.upsertAnswer(attemptId, questionId, optionIndex, currentQuestionIndex);
    const att = this.data.attempts.find((a) => a.id === attemptId);
    if (att && ok) {
      if (!att.answers) att.answers = {};
      att.answers[questionId] = optionIndex;
      if (currentQuestionIndex !== undefined) att.currentQuestionIndex = currentQuestionIndex;
    }
    return ok;
  }

  async clearAnswer(attemptId: string, questionId: string) {
    await answerRepository.deleteAnswer(attemptId, questionId);
    const att = this.data.attempts.find((a) => a.id === attemptId);
    if (att?.answers) delete att.answers[questionId];
  }

  async updateAttemptIndex(attemptId: string, index: number): Promise<boolean> {
    const ok = await attemptRepository.updateCurrentQuestionIndex(attemptId, index);
    const att = this.data.attempts.find((a) => a.id === attemptId);
    if (att && ok) att.currentQuestionIndex = Math.max(0, index);
    return ok;
  }

  /**
   * Conditional submit: only transitions from IN_PROGRESS → SUBMITTED/AUTO_SUBMITTED.
   * Returns false if already submitted (idempotent).
   */
  async submitAttemptIfInProgress(attempt: Attempt): Promise<boolean> {
    const result = await attemptRepository.submitIfInProgress(attempt);
    if (result) {
      const idx = this.data.attempts.findIndex((a) => a.id === attempt.id);
      if (idx >= 0) this.data.attempts[idx] = attempt;
      else this.data.attempts.unshift(attempt);
    }
    return result;
  }

  /** Claim a Telegram update_id for idempotent processing. Returns false if already processed. */
  async claimTelegramUpdate(updateId: number): Promise<boolean> {
    return telegramUpdateRepository.claim(updateId);
  }

  getExams() {
    return this.data.exams.map((e) => ({ ...e, status: effectiveExamStatus(e) }));
  }
  getExamById(id: string) {
    const e = this.data.exams.find((x) => x.id === id || x.id.toLowerCase() === id.toLowerCase());
    return e ? { ...e, status: effectiveExamStatus(e) } : undefined;
  }
  async saveExam(exam: Exam) {
    exam.status = effectiveExamStatus(exam);
    exam.updatedAt = new Date().toISOString();
    await this.persistExam(exam);
    const idx = this.data.exams.findIndex((e) => e.id === exam.id);
    if (idx >= 0) this.data.exams[idx] = exam;
    else this.data.exams.unshift(exam);
    return exam;
  }
  async deleteExam(id: string) {
    this.data.exams = this.data.exams.filter((e) => e.id !== id);
    this.data.attempts = this.data.attempts.filter((a) => a.examId !== id);
    await examRepository.deleteExamCascade(id);
  }

  getStudents() {
    return this.data.students;
  }
  getStudentById(id: string) {
    return this.data.students.find((s) => s.id === id);
  }
  getStudentByTelegramId(tg: number) {
    return this.data.students.find((s) => s.telegramUserId === tg);
  }
  async saveStudent(student: Student) {
    await this.persistStudent(student);
    const idx = this.data.students.findIndex((s) => s.id === student.id);
    if (idx >= 0) this.data.students[idx] = student;
    else this.data.students.push(student);
    return student;
  }
  async deleteStudent(
    id: string,
    opts?: { studentCode?: string; telegramUserId?: number | null; examIds?: string[] }
  ) {
    const student = this.data.students.find((s) => s.id === id);
    const code = opts?.studentCode ?? student?.studentId;
    const tg = opts?.telegramUserId ?? student?.telegramUserId ?? null;
    const examIds = opts?.examIds;

    // Drop related attempts from memory immediately
    this.data.attempts = this.data.attempts.filter((a) => {
      if (examIds && examIds.length && !examIds.includes(a.examId)) return true;
      if (a.studentId && (a.studentId === id || a.studentId === code)) return false;
      if (tg != null && a.telegramUserId && Number(a.telegramUserId) === Number(tg)) return false;
      return true;
    });
    this.data.students = this.data.students.filter((s) => s.id !== id);
    await studentRepository.deleteStudent(id, { studentCode: code, telegramUserId: tg, examIds });
  }

  /** Link student to teacher idempotently. */
  async linkStudentTeacher(studentId: string, teacherId: string) {
    await studentRepository.linkTeacher(studentId, teacherId);
    const s = this.data.students.find((x) => x.id === studentId);
    if (s) {
      if (!s.teacherIds) s.teacherIds = [];
      if (!s.teacherIds.includes(teacherId)) s.teacherIds.push(teacherId);
    }
  }

  getAttempts(examId?: string) {
    return examId ? this.data.attempts.filter((a) => a.examId === examId) : this.data.attempts;
  }

  async getInProgressAttempts() {
    const rows = await attemptRepository.findInProgress();
    const hydrated: Attempt[] = [];
    for (const row of rows) {
      const existing = this.data.attempts.find((attempt) => attempt.id === String(row.id));
      const attempt = existing || mapAttemptRow(row);
      if (!existing) {
        this.data.attempts.unshift(attempt);
        if (this.data.attempts.length > ATTEMPT_CACHE_MAX) this.data.attempts.length = ATTEMPT_CACHE_MAX;
      } else {
        Object.assign(existing, mapAttemptRow(row, existing.answers || {}));
      }
      hydrated.push(attempt);
    }
    return hydrated;
  }
  getStudentAttempts(examId: string, telegramUserId: number) {
    return this.data.attempts
      .filter((a) => a.examId === examId && a.telegramUserId === telegramUserId)
      .sort((a, b) => (a.attemptNumber || 1) - (b.attemptNumber || 1));
  }
  getAttempt(examId: string, telegramUserId: number) {
    const mine = this.getStudentAttempts(examId, telegramUserId);
    const inProgress = mine
      .filter((a) => a.status === 'IN_PROGRESS')
      .sort(
        (a, b) =>
          (b.attemptNumber || 0) - (a.attemptNumber || 0) ||
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    if (inProgress.length > 0) return inProgress[0];
    return mine.length ? mine[mine.length - 1] : undefined;
  }

  /** Next attempt_number for exam+user (SQL-backed for multi-instance safety). */
  async nextAttemptNumber(examId: string, telegramUserId: number): Promise<number> {
    return attemptRepository.nextAttemptNumber(examId, telegramUserId);
  }

  async deleteAttempt(id: string) {
    this.data.attempts = this.data.attempts.filter((a) => a.id !== id);
    await attemptRepository.deleteById(id);
  }

  async saveAttempt(attempt: Attempt) {
    // Update in-memory cache first so exam start can render without waiting on SQL
    const idx = this.data.attempts.findIndex((a) => a.id === attempt.id);
    if (idx >= 0) this.data.attempts[idx] = attempt;
    else {
      this.data.attempts.unshift(attempt);
    }
    await this.persistAttempt(attempt, { replaceAnswers: true });
    return attempt;
  }

  /** Persist only practice pause metadata; avoids rewriting all attempt answers. */
  async updateAttemptPause(attempt: Attempt): Promise<boolean> {
    const idx = this.data.attempts.findIndex((a) => a.id === attempt.id);
    if (idx >= 0) this.data.attempts[idx] = attempt;
    return attemptRepository.updatePauseState(
      attempt.id,
      attempt.pausedAt || null,
      attempt.pausedSeconds || 0,
    );
  }

  getQuestions() {
    return this.data.questionBank;
  }
  async saveQuestion(q: Question) {
    const idx = this.data.questionBank.findIndex((x) => x.id === q.id);
    if (idx >= 0) this.data.questionBank[idx] = q;
    else this.data.questionBank.push(q);
    await questionRepository.saveBankItem({
      teacher_id: (q as any).teacherId || 'default',
      question: q.question,
      options_json: JSON.stringify(q.options || []),
      answer: q.answer,
      marks: q.marks ?? 1,
      negative_marks: q.negativeMarks ?? 0,
      explanation: q.explanation || '',
      subject: q.subject || '',
      image_file_id: q.image?.fileId || '',
      image_mime_type: q.image?.mimeType || '',
      image_width: q.image?.width ?? null,
      image_height: q.image?.height ?? null,
    }, q.id);
    return q;
  }
  async deleteQuestion(id: string) {
    this.data.questionBank = this.data.questionBank.filter((q) => q.id !== id);
    await questionRepository.deleteBankItem(id);
  }

  getSettings() {
    return this.data.settings;
  }
  async updateSettings(partial: Partial<SystemSettings>) {
    this.data.settings = { ...this.data.settings, ...partial };
    if (process.env.TELEGRAM_BOT_TOKEN) this.data.settings.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const { createDoc, updateDoc, getDoc, COLLECTIONS } = await import('./database/client.js');
    const data = {
      bot_username: this.data.settings.botUsername || '',
      system_notice: this.data.settings.systemNotice || '',
      bot_active: !!this.data.settings.botActive,
      auto_publish_results: !!this.data.settings.autoPublishResults,
      webhook_url: this.data.settings.webhookUrl || '',
      telegram_bot_token: '',
    };
    const existing = await getDoc(COLLECTIONS.system_settings, '1');
    if (existing) await updateDoc(COLLECTIONS.system_settings, '1', data);
    else await createDoc(COLLECTIONS.system_settings, data, '1');
    return this.data.settings;
  }

  getAuditLogs() {
    return this.data.auditLogs;
  }
  async addAuditLog(action: string, details: string, actor = 'system') {
    const log: AuditLog = {
      id: `LOG_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      actor,
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > AUDIT_CACHE_MAX) this.data.auditLogs.length = AUDIT_CACHE_MAX;
    await auditRepository.insert({
      id: log.id,
      timestamp: log.timestamp,
      action: log.action,
      details: log.details,
      actor: log.actor,
    });
  }

  async resetToSeed() {
    return this.data;
  }
}

export const store = new Store();
