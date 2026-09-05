import { store } from '../store.js';
import { escapeMd } from '../middleware/validate.js';
import { sendSafeTelegramMessage } from './safeSend.js';
import {
  getKbSession,
  setKbSession,
  kbMarkup,
  LABELS,
  mainNavRows,
  webAppBaseUrl,
  numberedListRows,
} from './replyNav.js';
import { validateExamCallback, logTelegramDiag } from './examUiController.js';
import {
  escapeHtml,
  titleBlock,
  subtitle,
  quote,
  brandFooter,
  emptyState,
  DIV,
  optionBox,
} from './theme.js';
import {
  TelegramUpdate,
  TelegramUser,
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  SimulatorResponse,
  Attempt,
  Exam,
  Question,
  Student
} from '../types.js';

import {
  calculateAttemptScore,
  updateExamRanks,
} from '../services/scoringService.js';

// Re-export for API/server consumers
export { calculateAttemptScore, updateExamRanks };


/** Resolve examId from callback payloads when IDs contain underscores (e.g. EXAM_ts_rnd). */
function resolveExamIdFromRest(rest: string, trailingCount: number): { examId: string; trailing: number[] } | null {
  const exams = store.getExams();
  const ids = exams.map((e) => e.id).sort((a, b) => b.length - a.length);
  for (const id of ids) {
    if (rest === id && trailingCount === 0) {
      return { examId: id, trailing: [] };
    }
    if (rest.startsWith(id + '_')) {
      const suffix = rest.slice(id.length + 1);
      if (trailingCount === 0) {
        // optional page: only digits
        if (/^\d+$/.test(suffix)) {
          return { examId: id, trailing: [parseInt(suffix, 10)] };
        }
        continue;
      }
      const parts = suffix.split('_');
      if (parts.length === trailingCount && parts.every((x) => /^-?\d+$/.test(x))) {
        return { examId: id, trailing: parts.map((x) => parseInt(x, 10)) };
      }
    }
  }
  // Fallback: last N underscore-separated numeric segments
  if (trailingCount === 0) {
    return { examId: rest, trailing: [] };
  }
  const segs = rest.split('_');
  if (segs.length <= trailingCount) return null;
  const trailing = segs.slice(-trailingCount).map((x) => parseInt(x, 10));
  if (trailing.some((n) => Number.isNaN(n))) return null;
  return { examId: segs.slice(0, -trailingCount).join('_'), trailing };
}


/** Official exam window: [startDate, startDate + durationMinutes) */
function getExamWindow(exam: Exam): { start: number; end: number } {
  const start = new Date(exam.startDate).getTime();
  const end = start + Math.max(1, exam.durationMinutes || 60) * 60 * 1000;
  return { start, end };
}

function isExamWindowOpen(exam: Exam, now = Date.now()): boolean {
  const { start, end } = getExamWindow(exam);
  return now >= start && now < end;
}

function isExamTimeEnded(exam: Exam): boolean {
  return Date.now() >= getExamWindow(exam).end;
}

// Format timer remaining string

/** Users who tapped "Set your name" — next text message becomes their display name */
const pendingNameUsers = new Set<number>();


function mainNavReplyKeyboard() {
  return { remove_keyboard: true } as const;
}

function matchMainNav(text: string): string | null {
  const t = text.trim();
  const map: Record<string, string> = {
    [LABELS.exams]: 'exams',
    [LABELS.results]: 'results',
    [LABELS.leaderboard]: 'leaderboard',
    [LABELS.setName]: 'setName',
    [LABELS.home]: 'home',
    'My Exams': 'exams',
    'My Results': 'results',
    'Leaderboard': 'leaderboard',
    'Leaderboards': 'leaderboard',
    'Set my name': 'setName',
    'Set your name': 'setName',
    'Main menu': 'home',
  };
  return map[t] || null;
}

/** Resolve a reply-keyboard tap using session labels or fixed LABELS. */
function resolveReplyAction(userId: number, text: string): { action: string; arg?: string } | null {
  const raw = text.trim();
  const sess = getKbSession(userId);
  if (sess?.labels && sess.labels[raw] !== undefined) {
    return { action: 'pick', arg: sess.labels[raw] };
  }
  // Fixed labels
  const fixed: Record<string, string> = {
    [LABELS.exams]: 'exams',
    [LABELS.results]: 'results',
    [LABELS.leaderboard]: 'leaderboard',
    [LABELS.setName]: 'setName',
    [LABELS.home]: 'home',
    [LABELS.backExams]: 'back_exams',
    [LABELS.otherLb]: 'lb_pick',
    [LABELS.showFullLb]: 'lb_more',
    [LABELS.startExam]: 'start_exam',
    [LABELS.continueExam]: 'resume_exam',
    [LABELS.viewResult]: 'view_result',
    [LABELS.reattempt]: 'reattempt',
    [LABELS.practiceAgain]: 'reattempt',
    [LABELS.examLb]: 'exam_lb',
    [LABELS.review]: 'review',
    [LABELS.scoreSum]: 'score_sum',
    [LABELS.prev]: 'prev',
    [LABELS.next]: 'next',
    [LABELS.prevPage]: 'prev_page',
    [LABELS.nextPage]: 'next_page',
    [LABELS.grid]: 'grid',
    [LABELS.submit]: 'submit',
    [LABELS.confirmSubmit]: 'do_submit',
    [LABELS.continueAns]: 'continue_ans',
  };
  if (fixed[raw]) return { action: fixed[raw] };
  return matchMainNav(raw) ? { action: matchMainNav(raw)! } : null;
}

function formatInIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  // e.g. "12 Aug 2026, 9:30 PM"
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = (get('dayPeriod') || '').toUpperCase(); // AM / PM
  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}

function formatRemaining(expiresAtIso: string): string {
  const expiresAt = new Date(expiresAtIso).getTime();
  const now = Date.now();
  const diff = Math.max(0, expiresAt - now);
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function linkStudentToTeacher(student: Student, teacherId?: string | null) {
  if (!teacherId) return student;
  const ids = Array.isArray(student.teacherIds) ? [...student.teacherIds] : [];
  if (!ids.includes(teacherId)) {
    ids.push(teacherId);
    student.teacherIds = ids;
    // Fire-and-forget — must not delay exam start / deep-link response
    void store.saveStudent(student).catch((e: any) => {
      console.error('[telegram] linkStudentToTeacher save failed:', e?.message || e);
    });
  }
  return student;
}

export async function getOrCreateStudent(user: TelegramUser): Promise<Student> {
  let student = store.getStudentByTelegramId(user.id);
  const now = new Date().toISOString();

  const telegramUsername: string | null = user.username ? `@${user.username}` : null;

  let name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  if (!name && telegramUsername) {
    name = telegramUsername;
  }
  if (!name) {
    name = 'Student';
  }

  if (!student) {
    const createdStudent: Student = {
      id: `STU_${user.id}`,
      studentId: `S${String(user.id).slice(-6)}`,
      name: name,
      className: 'ALL',
      status: 'linked',
      linkCode: `S${String(user.id).slice(-6)}`,
      telegramUserId: user.id,
      telegramUsername: telegramUsername,
      joinedAt: now,
    };
    student = createdStudent;
    try {
      await store.saveStudent(createdStudent);
      await store.addAuditLog('STUDENT_AUTO_REGISTERED', `Auto-registered Telegram student ${name} (${telegramUsername || user.id})`);
    } catch (e: any) {
      console.error('[telegram] getOrCreateStudent save failed:', e?.message || e);
    }
  } else {
    let updated = false;
    if (telegramUsername && student.telegramUsername !== telegramUsername) {
      student.telegramUsername = telegramUsername;
      updated = true;
    }
    if (name && (student.name.startsWith('Student #') || !student.name)) {
      student.name = name;
      updated = true;
    }
    if (updated) {
      try {
        await store.saveStudent(student);
      } catch (e: any) {
        console.error('[telegram] getOrCreateStudent update failed:', e?.message || e);
      }
    }
  }

  if (!student) throw new Error('Unable to initialize student');
  return student;
}


function renderMainMenu(student: Student): SimulatorResponse {
  if (student.telegramUserId) {
    setKbSession(student.telegramUserId, { screen: 'main' });
  }
  const displayName = escapeHtml((student.name || 'Student').trim() || 'Student');
  const text =
    `<blockquote>` +
    `<b>Qᴜɪᴢ Bᴏᴛ</b>\n` +
    `<i>ʙʏ Pᴜsᴘᴀʀɢʜʏᴀ 🕵️</i>\n\n` +
    `<b><i>Wᴇʟᴄᴏᴍᴇ, ${displayName} 👀</i></b>\n\n` +
    `<b>📚 Hᴏᴡ Iᴛ Wᴏʀᴋs:</b>\n\n` +
    `🔗 Oᴘᴇɴ ᴛʜᴇ ᴇxᴀᴍ ʟɪɴᴋ sʜᴀʀᴇᴅ ʙʏ ʏᴏᴜʀ ᴛᴇᴀᴄʜᴇʀ.\n` +
    `📝 Sᴛᴀʀᴛ ʏᴏᴜʀ ᴇxᴀᴍɪɴᴀᴛɪᴏɴ.\n` +
    `📊 Vɪᴇᴡ ʏᴏᴜʀ ʀᴇsᴜʟᴛs ᴀғᴛᴇʀᴡᴀʀᴅs.\n\n` +
    `<b>✨ Fᴇᴀᴛᴜʀᴇs:</b>\n\n` +
    `⚡ Fᴀsᴛ ᴇxᴀᴍɪɴᴀᴛɪᴏɴ\n` +
    `🏆 Lᴇᴀᴅᴇʀʙᴏᴀʀᴅs\n` +
    `📈 Pᴇʀғᴏʀᴍᴀɴᴄᴇ ᴛʀᴀᴄᴋɪɴɢ\n\n` +
    `<i>Exᴀᴍɪɴᴀᴛɪᴏɴs ᴍᴀᴅᴇ sɪᴍᴘʟᴇ.</i>` +
    `</blockquote>`;

  return {
    chatId: student.telegramUserId!,
    text,
    replyMarkup: {
      inline_keyboard: [[{ text: LABELS.openApp, web_app: { url: webAppBaseUrl() } }]],
    },
    clearReplyKeyboard: true,
    parseMode: 'HTML',
    type: 'sendMessage',
  };
}

function miniAppExamUrl(examId: string): string {
  return `${webAppBaseUrl()}/?exam=${encodeURIComponent(examId)}`;
}

function examStartPrompt(examId: string, chatId: number): SimulatorResponse {
  const exam = store.getExamById(examId);
  if (!exam || !exam.teacherId) {
    return {
      chatId,
      text: '❌ This exam link is invalid or the exam is no longer available.',
      parseMode: 'HTML',
      type: 'sendMessage',
    };
  }
  return {
    chatId,
    text:
      `<blockquote><b>${escapeHtml(exam.title)}</b>\n\n` +
      `Your teacher shared this exam with you. Tap the button below to open the exam start page.</blockquote>`,
    replyMarkup: {
      inline_keyboard: [[{ text: '▶️ Start Exam', web_app: { url: miniAppExamUrl(exam.id) } }]],
    },
    clearReplyKeyboard: true,
    parseMode: 'HTML',
    type: 'sendMessage',
  };
}

function needsNameSetup(student: Student): boolean {
  const n = (student.name || '').trim();
  if (!n) return true;
  if (/^student(\s*#?\d*)?$/i.test(n)) return true;
  return false;
}

/** Bounded in-memory dedup — avoids a Turso round-trip on every button press. */
const recentUpdateIds = new Set<number>();
const RECENT_UPDATE_MAX = 4000;

function rememberUpdateId(id: number) {
  recentUpdateIds.add(id);
  if (recentUpdateIds.size > RECENT_UPDATE_MAX) {
    // drop oldest-ish entries (Set iteration order is insertion order)
    const n = recentUpdateIds.size - RECENT_UPDATE_MAX + 500;
    let i = 0;
    for (const x of recentUpdateIds) {
      recentUpdateIds.delete(x);
      if (++i >= n) break;
    }
  }
}

export async function processTelegramUpdate(update: TelegramUpdate): Promise<SimulatorResponse | null> {
  try {
    const uid = update.update_id != null ? Number(update.update_id) : null;

    // Atomic claim BEFORE any business logic or Telegram API side-effects
    if (uid != null) {
      if (recentUpdateIds.has(uid)) {
        console.log('[tg] DUPLICATE_UPDATE_IGNORED update_id=' + uid + ' source=memory');
        return null;
      }
      const claimed = await store.claimTelegramUpdate(uid);
      if (!claimed) {
        console.log('[tg] DUPLICATE_UPDATE_IGNORED update_id=' + uid + ' source=db');
        rememberUpdateId(uid);
        return null;
      }
      rememberUpdateId(uid);
    }

    const result = await processTelegramUpdateInner(update);
    return result;
  } catch (err: any) {
    console.error('[telegram] processTelegramUpdate failed:', err?.message || err);
    return null;
  }
}

async function processTelegramUpdateInner(update: TelegramUpdate): Promise<SimulatorResponse | null> {
  const now = new Date();

  // Handle callback queries (button clicks)
  if (update.callback_query) {
    const cb = update.callback_query;
    const user = cb.from;
    const data = cb.data || '';
    const student = await getOrCreateStudent(user);
    const cbMessageId = cb.message?.message_id;

    let response: SimulatorResponse | null = null;
    const isLegacyExamCallback =
      data === 'btn_exams' ||
      data === 'btn_results' ||
      data === 'btn_leaderboard' ||
      data === 'leaderboard_more' ||
      /^(exam_view_|lb_exam_|lb_more_|start_exam_|resume_exam_|reattempt_|viewres_|ans_|nav_|grid_|revatt_|rev_|confirm_submit_|do_submit_)/.test(data);

    // Legacy text-exam buttons now return users to the single Open App menu.
    // Exam questions and results are delivered only inside the Mini App.
    if (isLegacyExamCallback) {
      response = renderMainMenu(student);
    } else if (data === 'btn_home' || data === 'btn_menu') {
      pendingNameUsers.delete(user.id);
      // Main menu always re-applies ReplyKeyboard (closes ForceReply / Gboard)
      response = renderMainMenu(student);
    } else if (data === 'btn_setname') {
      pendingNameUsers.add(user.id);
      response = {
        chatId: user.id,
        text: `✏️ *Set your name*

Please *type your full name* and send it as a message.

This name will appear on results and the leaderboard.`,
        replyMarkup: {
          inline_keyboard: [
            [{ text: '🏠 Main menu', callback_data: 'btn_home' }]
          ]
        },
        type: 'editMessageText'
      };
    } else if (data === 'btn_exams') {
      response = renderExamsList(student);
    } else if (data.startsWith('exam_view_')) {
      const examId = data.replace('exam_view_', '');
      response = renderExamOptions(examId, student);
    } else if (data === 'btn_results') {
      response = renderStudentResults(student);
    } else if (data === 'btn_leaderboard') {
      response = renderLeaderboardExamPicker(student);
    } else if (data.startsWith('lb_exam_')) {
      const examId = data.replace('lb_exam_', '');
      response = renderExamLeaderboard(examId, student, false);
    } else if (data.startsWith('lb_more_')) {
      const examId = data.replace('lb_more_', '');
      response = renderExamLeaderboard(examId, student, true);
    } else if (data === 'leaderboard_more') {
      // legacy — show picker
      response = renderLeaderboardExamPicker(student);
    } else if (data.startsWith('start_exam_') || data.startsWith('resume_exam_')) {
      const examId = data.replace('start_exam_', '').replace('resume_exam_', '');
      try {
        const token =
          process.env.TELEGRAM_BOT_TOKEN || store.getSettings().telegramBotToken || '';
        if (token) {
          void fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: user.id, action: 'typing' }),
            signal: AbortSignal.timeout(3000),
          });
        }
      } catch {
        /* ignore */
      }
      response = await handleStartOrResumeExam(examId, student, user);
    } else if (data.startsWith('reattempt_')) {
      const examId = data.replace('reattempt_', '');
      response = await handleStartOrResumeExam(examId, student, user, true);

    } else if (data.startsWith('viewres_')) {
      const attemptId = data.replace('viewres_', '');
      const att = store.getAttempts().find((a) => a.id === attemptId);
      const exam = att ? store.getExamById(att.examId) : undefined;
      if (att && exam && (att.telegramUserId === student.telegramUserId || att.studentId === student.studentId)) {
        if (!att.answers || Object.keys(att.answers).length === 0) {
          try { await store.loadAttemptAnswers(att.id); } catch {}
        }
        const loaded = store.getAttempts().find((a) => a.id === attemptId) || att;
        response = renderAttemptSummary(exam, loaded, null);
      } else {
        response = {
          chatId: user.id,
          text: '❌ Result not found.',
          replyMarkup: {
            inline_keyboard: [[{ text: '📊 My Results', callback_data: 'btn_results' }]],
          },
          type: 'editMessageText',
        };
      }
    } else if (data.startsWith('ans_')) {
      // ans_EXAMID_qIdx_optIdx — exam IDs may contain underscores
      const rest = data.slice(4);
      const parsed = resolveExamIdFromRest(rest, 2);
      if (parsed) {
        const v = validateExamCallback({ telegramUserId: user.id, examId: parsed.examId });
        if (!v.ok) {
          logTelegramDiag({ event: 'STALE_CALLBACK_IGNORED', action: 'ans', reason: v.reason, uid: user.id });
          response = null;
        } else {
          const [qIdx, optIdx] = parsed.trailing;
          response = await handleOptionSelect(parsed.examId, qIdx, optIdx, student, user);
        }
      }
    } else if (data.startsWith('nav_')) {
      const rest = data.slice(4);
      const parsed = resolveExamIdFromRest(rest, 1);
      if (parsed) {
        const v = validateExamCallback({ telegramUserId: user.id, examId: parsed.examId });
        if (!v.ok) {
          logTelegramDiag({ event: 'STALE_CALLBACK_IGNORED', action: 'nav', reason: v.reason, uid: user.id });
          response = null;
        } else {
          response = await renderQuestionView(parsed.examId, parsed.trailing[0], student, user, {
            refreshKeyboard: false,
          });
        }
      }
    } else if (data.startsWith('grid_')) {
      const rest = data.slice(5);
      const parsed = resolveExamIdFromRest(rest, 0);
      if (parsed) {
        const v = validateExamCallback({ telegramUserId: user.id, examId: parsed.examId });
        if (!v.ok) {
          logTelegramDiag({ event: 'STALE_CALLBACK_IGNORED', action: 'grid', reason: v.reason, uid: user.id });
          response = null;
        } else {
          const page = parsed.trailing.length ? parsed.trailing[0] : undefined;
          response = await renderQuestionGrid(parsed.examId, student, user, page);
        }
      }

    } else if (data.startsWith('revatt_')) {
      // revatt_ATTEMPTID_sum | revatt_ATTEMPTID_PAGE
      const rest = data.slice(7);
      let attemptId = '';
      let pagePart = '';
      const lastUnderscore = rest.lastIndexOf('_');
      if (lastUnderscore !== -1) {
        attemptId = rest.slice(0, lastUnderscore);
        pagePart = rest.slice(lastUnderscore + 1);
      }
      const att = store.getAttempts().find((a) => a.id === attemptId);
      const exam = att ? store.getExamById(att.examId) : undefined;
      if (att && exam && (att.telegramUserId === student.telegramUserId || att.studentId === student.studentId)) {
        if (!att.answers || Object.keys(att.answers).length === 0) {
          try {
            await store.loadAttemptAnswers(att.id);
          } catch (e: any) {
            console.error('[telegram] loadAttemptAnswers:', e?.message || e);
          }
        }
        const loaded = store.getAttempts().find((a) => a.id === attemptId) || att;
        if (pagePart === 'sum') {
          response = renderAttemptSummary(exam, loaded, null);
        } else {
          response = renderAttemptSummary(exam, loaded, parseInt(pagePart, 10) || 0);
        }
      } else {
        response = {
          chatId: user.id,
          text: '❌ Result not found.',
          replyMarkup: {
            inline_keyboard: [[{ text: '📊 My Results', callback_data: 'btn_results' }]],
          },
          type: 'editMessageText',
        };
      }
    } else if (data.startsWith('rev_')) {
      // rev_EXAMID_sum | rev_EXAMID_PAGE
      const rest = data.slice(4);
      let examId = '';
      let pagePart = '';
      const examsSorted = store.getExams().map((e) => e.id).sort((a, b) => b.length - a.length);
      for (const id of examsSorted) {
        if (rest === id + '_sum' || rest.startsWith(id + '_')) {
          examId = id;
          pagePart = rest.slice(id.length + 1);
          break;
        }
      }
      if (!examId) {
        const lastUnderscore = rest.lastIndexOf('_');
        if (lastUnderscore !== -1) {
          examId = rest.slice(0, lastUnderscore);
          pagePart = rest.slice(lastUnderscore + 1);
        }
      }
      if (examId) {
        const exam = store.getExamById(examId);
        const mine = store.getStudentAttempts(examId, student.telegramUserId!).filter(
          (a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED'
        );
        let attempt =
          mine.find((a) => a.isOfficial !== false) ||
          mine[mine.length - 1] ||
          (exam ? store.getAttempt(examId, student.telegramUserId!) : undefined);
        if (exam && attempt) {
          // Answers are often not in memory (loaded on demand) — required for review
          if (!attempt.answers || Object.keys(attempt.answers).length === 0) {
            try {
              await store.loadAttemptAnswers(attempt.id);
              attempt = store.getAttempts().find((a) => a.id === attempt!.id) || attempt;
            } catch (e: any) {
              console.error('[telegram] loadAttemptAnswers failed:', e?.message || e);
            }
          }
          if (pagePart === 'sum') {
            response = renderAttemptSummary(exam, attempt, null);
          } else {
            response = renderAttemptSummary(exam, attempt, parseInt(pagePart, 10) || 0);
          }
        } else {
          response = {
            chatId: user.id,
            text: '❌ Could not find that exam result. Open *My Results* and try again.',
            replyMarkup: {
              inline_keyboard: [
                [{ text: '📊 My Results', callback_data: 'btn_results' }],
                [{ text: '🏠 Main menu', callback_data: 'btn_home' }],
              ],
            },
            type: 'editMessageText',
          };
        }
      }
    } else if (data.startsWith('confirm_submit_')) {
      const examId = data.replace('confirm_submit_', '');
      const v = validateExamCallback({ telegramUserId: user.id, examId });
      if (!v.ok) {
        logTelegramDiag({ event: 'STALE_CALLBACK_IGNORED', action: 'confirm_submit', reason: v.reason, uid: user.id });
        response = null;
      } else {
        response = renderSubmitConfirmation(examId, student, user);
      }
    } else if (data.startsWith('do_submit_')) {
      const examId = data.replace('do_submit_', '');
      const v = validateExamCallback({ telegramUserId: user.id, examId });
      if (!v.ok) {
        logTelegramDiag({ event: 'STALE_CALLBACK_IGNORED', action: 'do_submit', reason: v.reason, uid: user.id });
        response = null;
      } else {
        response = await handleFinalSubmit(examId, student, user);
      }
    }

    // Keep single-chat edits for pure inline (MCQ). Never force editMessageText over photo ops.
    // Photo messages cannot become text via editMessageText — must delete photo then send text
    // (submit confirm / submitting / results). Same as diagram→text question transitions.
    const needsSendKb = Boolean(response?.replyKeyboard);
    const sessKind = getKbSession(user.id)?.lastMessageKind;
    const cbIsPhoto = sessKind === 'photo';
    if (response && cbMessageId && !needsSendKb) {
      if (response.photoFileId) {
        response.messageId = cbMessageId;
        if (response.type !== 'editMessageMedia' && response.type !== 'sendPhoto') {
          response.type = 'editMessageMedia';
        }
      } else if (cbIsPhoto) {
        // Leave the diagram bubble: delete it, send text (confirm / result)
        (response as any).deletePreviousMessageId = cbMessageId;
        delete (response as any).messageId;
        response.type = 'sendMessage';
      } else {
        response.messageId = cbMessageId;
        response.type = 'editMessageText';
      }
    } else if (response && needsSendKb) {
      if (response.photoFileId) {
        if (cbMessageId && !response.messageId) response.messageId = cbMessageId;
        if (response.type !== 'sendPhoto' && response.type !== 'editMessageMedia') {
          response.type = 'sendPhoto';
        }
      } else {
        if (cbIsPhoto && cbMessageId) {
          (response as any).deletePreviousMessageId = cbMessageId;
        }
        response.type = 'sendMessage';
        delete (response as any).messageId;
      }
    }
    return response;
  }

  // Handle incoming text commands
  if (update.message && update.message.text) {
    const msg = update.message;
    const text = msg.text?.trim() || '';
    if (!text) return null;
    const user = msg.from;
    const student = await getOrCreateStudent(user);

    // Name from "Set your name" button — next plain text is the name
    if (pendingNameUsers.has(user.id) && !text.startsWith('/')) {
      const newName = text.trim().slice(0, 60);
      if (newName.length < 2) {
        return {
          chatId: user.id,
          text: `✏️ Name is too short. Please send your full name (at least 2 characters).`,
          replyMarkup: {
            inline_keyboard: [[{ text: '🏠 Main menu', callback_data: 'btn_home' }]]
          },
          type: 'sendMessage'
        };
      }
      pendingNameUsers.delete(user.id);
      student.name = newName;
      store.saveStudent(student);
      return {
        chatId: user.id,
        text: `✅ *Name updated!*\n\nYour name is now: *${newName}*\n\nThis will appear on results and the leaderboard.`,
        replyMarkup: {
          inline_keyboard: [
            [{ text: '📚 My Exams', callback_data: 'btn_exams' }],
            [{ text: '🏠 Main menu', callback_data: 'btn_home' }]
          ]
        },
        type: 'sendMessage'
      };
    }



    // Legacy reply-keyboard taps no longer open text-based exam flows.
    // Return the one-button Mini App menu so stale Telegram keyboards self-correct.
    if (resolveReplyAction(user.id, text)) {
      return renderMainMenu(student);
    }

    // ReplyKeyboard navigation is retained below only for backwards-compatible code paths.
    // It is unreachable for current users because all recognized labels return above.
    {
      const resolved = resolveReplyAction(user.id, text);
      if (resolved && !pendingNameUsers.has(user.id)) {
        const sess = getKbSession(user.id);
        const action = resolved.action;
        const arg = resolved.arg;

        // Picked numbered item from list
        if (action === 'pick' && arg) {
          if (arg.startsWith('exam:')) {
            const examId = arg.slice(5);
            if (sess?.screen === 'lb_pick') {
              return { ...renderExamLeaderboard(examId, student, false), type: 'sendMessage' };
            }
            return { ...renderExamOptions(examId, student), type: 'sendMessage' };
          }
          if (arg.startsWith('att:')) {
            const attemptId = arg.slice(4);
            const att = store.getAttempts().find((a) => a.id === attemptId);
            const exam = att ? store.getExamById(att.examId) : undefined;
            if (att && exam) {
              if (!att.answers || Object.keys(att.answers).length === 0) {
                try { await store.loadAttemptAnswers(att.id); } catch {}
              }
              const loaded = store.getAttempts().find((a) => a.id === attemptId) || att;
              return { ...renderAttemptSummary(exam, loaded, null), type: 'sendMessage', parseMode: 'HTML' };
            }
          }
          if (arg.startsWith('q:') && sess?.examId) {
            const qIdx = parseInt(arg.slice(2), 10) || 0;
            return await renderQuestionView(sess.examId, qIdx, student, user, { refreshKeyboard: false });
          }
        }

        if (action === 'exams' || action === 'back_exams') {
          return { ...renderExamsList(student), type: 'sendMessage' };
        }
        if (action === 'results') {
          return { ...renderStudentResults(student), type: 'sendMessage' };
        }
        if (action === 'leaderboard' || action === 'lb_pick') {
          return { ...renderLeaderboardExamPicker(student), type: 'sendMessage' };
        }
        if (action === 'home') {
          return renderMainMenu(student);
        }
        if (action === 'setName') {
          pendingNameUsers.add(user.id);
          return {
            chatId: user.id,
            text: quote(
              `${titleBlock('✏️', 'Set my name')}\n\n` +
                `Please type your full name and send it as a message.`
            ),
            replyKeyboard: mainNavReplyKeyboard(),
            parseMode: 'HTML',
            type: 'sendMessage',
          };
        }
        if (action === 'start_exam' && sess?.examId) {
          return await handleStartOrResumeExam(sess.examId, student, user, false);
        }
        if (action === 'resume_exam' && sess?.examId) {
          return await handleStartOrResumeExam(sess.examId, student, user, false);
        }
        if (action === 'view_result' && sess?.attemptId) {
          const att = store.getAttempts().find((a) => a.id === sess.attemptId);
          const exam = att ? store.getExamById(att.examId) : sess.examId ? store.getExamById(sess.examId) : undefined;
          if (att && exam) {
            if (!att.answers || Object.keys(att.answers).length === 0) {
              try { await store.loadAttemptAnswers(att.id); } catch {}
            }
            const loaded = store.getAttempts().find((a) => a.id === att.id) || att;
            return { ...renderAttemptSummary(exam, loaded, null), type: 'sendMessage', parseMode: 'HTML' };
          }
        }
        if (action === 'reattempt' && sess?.examId) {
          return await handleStartOrResumeExam(sess.examId, student, user, true);
        }
        if (action === 'exam_lb' && sess?.examId) {
          return { ...renderExamLeaderboard(sess.examId, student, false), type: 'sendMessage' };
        }
        if (action === 'lb_more' && sess?.examId) {
          return { ...renderExamLeaderboard(sess.examId, student, true), type: 'sendMessage' };
        }
        if (action === 'review' && sess?.attemptId) {
          const att = store.getAttempts().find((a) => a.id === sess.attemptId);
          if (att) {
            return {
              chatId: user.id,
              text: `📖 <b>Review answers</b>

Open the full scrollable review below.`,
              parseMode: 'HTML',
              replyMarkup: {
                inline_keyboard: [
                  [{ text: '📖 Open review', web_app: { url: reviewWebAppUrl(att.id) } }],
                  [{ text: '🏠 Main menu', callback_data: 'btn_home' }],
                ],
              },
              type: 'sendMessage',
            };
          }
        }
        if (action === 'score_sum' && sess?.attemptId) {
          const att = store.getAttempts().find((a) => a.id === sess.attemptId);
          const exam = att ? store.getExamById(att.examId) : undefined;
          if (att && exam) {
            return { ...renderAttemptSummary(exam, att, null), type: 'sendMessage', parseMode: 'HTML' };
          }
        }
        if ((action === 'prev' || action === 'next') && sess) {
          if (sess.screen === 'review' && sess.attemptId) {
            const page = (sess.reviewPage || 0) + (action === 'next' ? 1 : -1);
            const att = store.getAttempts().find((a) => a.id === sess.attemptId);
            const exam = att ? store.getExamById(att.examId) : undefined;
            if (att && exam) {
              return { ...renderAttemptSummary(exam, att, Math.max(0, page)), type: 'sendMessage', parseMode: 'HTML' };
            }
          }
          if (sess.screen === 'in_exam' && sess.examId && sess.qIdx != null) {
            const qIdx = sess.qIdx + (action === 'next' ? 1 : -1);
            // Keep bottom keyboard as-is — only update question + MCQ options
            return await renderQuestionView(sess.examId, Math.max(0, qIdx), student, user, {
              refreshKeyboard: false,
            });
          }
        }
        if ((action === 'prev_page' || action === 'next_page') && sess?.examId) {
          const page = (sess.gridPage || 0) + (action === 'next_page' ? 1 : -1);
          return await renderQuestionGrid(sess.examId, student, user, Math.max(0, page));
        }
        if (action === 'grid' && sess?.examId) {
          return await renderQuestionGrid(sess.examId, student, user);
        }
        if (action === 'submit' && sess?.examId) {
          return renderSubmitConfirmation(sess.examId, student, user);
        }
        if (action === 'do_submit' && sess?.examId) {
          // Show submitting text immediately (text-button path has no callback loading)
          try {
            const token = process.env.TELEGRAM_BOT_TOKEN || store.getSettings().telegramBotToken;
            const mid = sess.lastMessageId;
            if (token && mid) {
              if (sess.lastMessageKind === 'photo') {
                // Cannot editMessageText on a photo — delete diagram bubble first
                await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: user.id, message_id: mid }),
                  signal: AbortSignal.timeout(5000),
                }).catch(() => {});
                setKbSession(user.id, {
                  ...sess,
                  lastMessageId: undefined,
                  lastMessageKind: undefined,
                  lastPhotoFileId: undefined,
                });
                const sent = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: user.id,
                    text: '⏳ <b>Submitting exam…</b>',
                    parse_mode: 'HTML',
                  }),
                  signal: AbortSignal.timeout(5000),
                });
                const sj: any = await sent.json().catch(() => ({}));
                if (sj?.ok && sj.result?.message_id != null) {
                  setKbSession(user.id, {
                    ...getKbSession(user.id)!,
                    lastMessageId: sj.result.message_id,
                    lastMessageKind: 'text',
                  });
                }
              } else {
                await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: user.id,
                    message_id: mid,
                    text: '⏳ <b>Submitting exam…</b>',
                    parse_mode: 'HTML',
                  }),
                  signal: AbortSignal.timeout(5000),
                });
              }
            }
          } catch { /* ignore */ }
          return await handleFinalSubmit(sess.examId, student, user);
        }
        if (action === 'continue_ans' && sess?.examId) {
          const qIdx = sess.qIdx || 0;
          return await renderQuestionView(sess.examId, qIdx, student, user, {
            refreshKeyboard: false,
          });
        }
      }
    }

    // /setname command (still supported)
    if (text.startsWith('/setname')) {
      const newName = text.replace('/setname', '').trim().slice(0, 60);
      if (newName) {
        pendingNameUsers.delete(user.id);
        student.name = newName;
        store.saveStudent(student);
        return {
          chatId: user.id,
          text: `✅ *Name updated!*\n\nYour name is now: *${newName}*`,
          replyKeyboard: mainNavReplyKeyboard(),
          type: 'sendMessage'
        };
      }
      pendingNameUsers.add(user.id);
      return {
        chatId: user.id,
        text: `✏️ *Set your name*\n\nPlease type your full name and send it as a message.`,
        replyMarkup: {
          inline_keyboard: [[{ text: '🏠 Main menu', callback_data: 'btn_home' }]]
        },
        type: 'sendMessage'
      };
    }

    // Standard /start command
    if (text.startsWith('/start')) {
      const parts = text.trim().split(/\s+/);
      const payload = parts[1] || '';

      // Deep link: /start exam_<examId>
      if (payload.startsWith('exam_')) {
        const examId = payload.slice(5);
        return examStartPrompt(examId, user.id);
      }

      pendingNameUsers.delete(user.id);
      const menu = renderMainMenu(student);
      return { ...menu, type: 'sendMessage', chatId: user.id };
    }

    if (text === '/exams' || text === '/results' || text === '/leaderboard') {
      return renderMainMenu(student);
    }
  }

  return null;
}

function renderUnlinkedMsg(chatId: number): SimulatorResponse {
  return {
    chatId,
    text: emptyState('⚠️', 'Account Unlinked', 'Please open the exam link from your teacher to register.'),
    parseMode: 'HTML',
    type: 'sendMessage',
  };
}

function renderExamsList(student: Student): SimulatorResponse {
  const myAttempts = store.getAttempts().filter(
    (a) => a.telegramUserId === student.telegramUserId || a.studentId === student.studentId
  );
  const examIds = [...new Set(myAttempts.map((a) => a.examId))];
  const exams = examIds.map((id) => store.getExamById(id)).filter(Boolean) as Exam[];

  if (exams.length === 0) {
    if (student.telegramUserId) setKbSession(student.telegramUserId, { screen: 'exams' });
    return {
      chatId: student.telegramUserId!,
      text: emptyState(
        '📚',
        'My Exams',
        'You have no exams yet.\n\nAsk your teacher for the exam link. Opening that link starts the exam.'
      ),
      replyKeyboard: kbMarkup([...mainNavRows(), [LABELS.home]]),
      parseMode: 'HTML',
      type: 'sendMessage',
    };
  }

  const { rows, labels } = numberedListRows(
    exams.map((e) => e.title),
    [[LABELS.home]]
  );
  const indexToId: Record<string, string> = {};
  exams.forEach((e, i) => {
    indexToId[String(i)] = e.id;
  });
  const labelToExam: Record<string, string> = {};
  for (const [lab, idx] of Object.entries(labels)) {
    labelToExam[lab] = indexToId[idx];
  }

  if (student.telegramUserId) {
    setKbSession(student.telegramUserId, {
      screen: 'exams',
      examIds: exams.map((e) => e.id),
      labels: Object.fromEntries(Object.entries(labelToExam).map(([k, v]) => [k, `exam:${v}`])),
    });
  }

  let body = `${titleBlock('📚', 'My Exams')}\n${subtitle('Tap an exam below to open options.')}\n\n${DIV}\n`;
  exams.forEach((exam, idx) => {
    const n = exam.totalQuestions || exam.questions?.length || 0;
    body += `\n<b>${idx + 1}.</b> ${escapeHtml(exam.title)}\n`;
    body += `<i>${escapeHtml(exam.subject || 'General')} · ${n} Qs · ${exam.durationMinutes} min</i>\n`;
  });

  return {
    chatId: student.telegramUserId!,
    text: quote(body),
    replyKeyboard: kbMarkup(rows),
    parseMode: 'HTML',
    type: 'sendMessage',
  };
}

function renderExamOptions(examId: string, student: Student): SimulatorResponse {
  const exam = store.getExamById(examId);
  if (!exam) {
    return {
      chatId: student.telegramUserId!,
      text: emptyState('❌', 'Exam not found', 'Go back to My Exams and try again.'),
      replyKeyboard: mainNavReplyKeyboard(),
      parseMode: 'HTML',
      type: 'sendMessage',
    };
  }

  const attempts = store.getStudentAttempts(exam.id, student.telegramUserId!);
  const active = attempts.find((a) => a.status === 'IN_PROGRESS');
  const submitted = attempts
    .filter((a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED')
    .slice()
    .sort((a, b) => {
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tb - ta;
    });
  const officialDone = submitted.find((a) => a.isOfficial !== false);
  const anyDone = submitted.length > 0;
  const locked = Date.now() < new Date(exam.startDate).getTime();
  const latest = officialDone || submitted[0];
  const nQ = exam.totalQuestions || exam.questions?.length || 0;

  let body =
    `${titleBlock('📝', exam.title)}\n` +
    `${subtitle(`${exam.subject || 'General'} · ${nQ} questions · ${exam.durationMinutes} min`)}\n\n` +
    `${DIV}\n`;

  if (locked) {
    body += `\n🔒 <b>Locked</b> until ${escapeHtml(formatInIST(new Date(exam.startDate)))}\n`;
  } else if (active) {
    body += `\n▶️ You have an exam <b>in progress</b>.\n`;
  } else if (anyDone) {
    body += `\n✅ You have submitted this exam.\n`;
  } else {
    body += `\n✨ Ready when you are — start below.\n`;
  }
  body += `\n${subtitle('Choose an option from the buttons below.')}`;

  // Exam actions live on the BOTTOM ReplyKeyboard (not under the message).
  // Taps are handled by resolveReplyAction + session examId.
  const rows: string[][] = [];
  if (!locked) {
    if (active) rows.push([LABELS.continueExam]);
    else if (!anyDone) rows.push([LABELS.startExam]);
  }
  if (anyDone) {
    rows.push([LABELS.viewResult]);
    rows.push([LABELS.reattempt]);
  }
  rows.push([LABELS.examLb]);
  rows.push([LABELS.backExams]);
  rows.push([LABELS.home]);

  if (student.telegramUserId) {
    setKbSession(student.telegramUserId, {
      screen: 'exam_opts',
      examId: exam.id,
      attemptId: latest?.id,
    });
  }

  return {
    chatId: student.telegramUserId!,
    text: quote(body),
    replyKeyboard: kbMarkup(rows),
    parseMode: 'HTML',
    type: 'sendMessage',
  };
}

async function handleStartOrResumeExam(examId: string, student: Student, user: TelegramUser, forceNew = false): Promise<SimulatorResponse> {
  const now = new Date();
  const exam = store.getExamById(examId);

  if (!exam) {
    return {
      chatId: user.id,
      text: `❌ *Exam not found*\n\nAsk your teacher for a valid exam link.`,
      type: 'sendMessage'
    };
  }

  // Status is automatic from schedule — no manual DRAFT gate

  // Require a valid teacher-owned exam (blocks orphaned / unauthorized exams)
  if (!exam.teacherId) {
    return {
      chatId: user.id,
      text: `❌ This exam is not available.`,
      type: 'sendMessage'
    };
  }

  const startDate = new Date(exam.startDate);
  if (now < startDate) {
    return {
      chatId: user.id,
      text: `🔒 *Exam locked until start time*\n\n` +
        `📝 *${exam.title}*\n` +
        `📅 Starts: ${formatInIST(startDate)}`,
      replyMarkup: {
        inline_keyboard: [
          [{ text: '🔄 Check again', callback_data: `start_exam_${exam.id}` }],
          [{ text: '🏠 Main menu', callback_data: 'btn_home' }]
        ]
      },
      type: 'sendMessage'
    };
  }

  // Enroll when allowed past lock checks (non-blocking — deep links must stay fast)
  void linkStudentToTeacher(student, exam.teacherId);

  let attempt = store.getAttempt(examId, student.telegramUserId!);
  const allMine = store.getStudentAttempts(examId, student.telegramUserId!);
  const officialExists = allMine.some(a => a.isOfficial !== false && (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED'));

  // Viewing previous result (not forcing reattempt)
  if (!forceNew && attempt && (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED')) {
    return renderAttemptSummary(exam, attempt);
  }

  // Resume in-progress
  if (!forceNew && attempt && attempt.status === 'IN_PROGRESS') {
    if (now.getTime() > new Date(attempt.expiresAt).getTime()) {
      return await autoSubmitExam(exam, attempt);
    }
    return await renderQuestionView(exam.id, attempt.currentQuestionIndex, student, user, { refreshKeyboard: true });
  }

  // Start new attempt (first or reattempt) — SQL-backed number for multi-instance safety
  const attemptNumber = await store.nextAttemptNumber(examId, student.telegramUserId!);
  const windowOpen = isExamWindowOpen(exam, now.getTime());
  // Official ONLY inside [start, start+duration) and no prior official attempt
  const isOfficial = windowOpen && !officialExists;
  if (!windowOpen && !officialExists && !forceNew) {
    // First visit after window closed — allow practice, explain
  }
  const startedAt = now.toISOString();
  const { end: windowEnd } = getExamWindow(exam);
  let expiresMs = now.getTime() + Math.max(1, exam.durationMinutes || 60) * 60 * 1000;
  // Official attempt cannot run past the global exam window end
  if (isOfficial) {
    expiresMs = Math.min(expiresMs, windowEnd);
  }
  const expiresAt = new Date(expiresMs).toISOString();

  attempt = {
    id: `ATT_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    examId,
    studentId: student.studentId,
    telegramUserId: student.telegramUserId!,
    studentName: student.name,
    studentClass: student.className,
    startedAt,
    expiresAt,
    submittedAt: null,
    status: 'IN_PROGRESS',
    answers: {},
    currentQuestionIndex: 0,
    score: 0,
    maxScore: exam.totalMarks,
    percentage: 0,
    correctCount: 0,
    wrongCount: 0,
    skippedCount: exam.totalQuestions,
    timeTakenSeconds: 0,
    isOfficial,
    attemptNumber
  };

  // Memory is updated synchronously inside saveAttempt; SQL persists in background
  void store.saveAttempt(attempt).catch((e: any) => {
    console.error('[telegram] saveAttempt failed:', e?.message || e);
  });
  void store.addAuditLog(
    'EXAM_STARTED',
    `${student.name} started ${exam.title} (attempt #${attemptNumber}, official=${isOfficial})`
  );

  return await renderQuestionView(exam.id, 0, student, user, { refreshKeyboard: true });
}

async function handleOptionSelect(examId: string, qIdx: number, optIdx: number, student: Student, user: TelegramUser): Promise<SimulatorResponse> {
  const now = new Date();
  const exam = store.getExamById(examId);
  if (!exam) {
    return { chatId: user.id, text: '❌ Examination not found. Please type /exams to see available tests.', type: 'sendMessage' };
  }

  // Enroll when allowed past lock checks (non-blocking — deep links must stay fast)
  void linkStudentToTeacher(student, exam.teacherId);

  let attempt = store.getAttempt(examId, student.telegramUserId!);
  if (!attempt) {
    const startRes = await handleStartOrResumeExam(examId, student, user);
    attempt = store.getAttempt(examId, student.telegramUserId!);
    if (!attempt) {
      return startRes;
    }
  }

  // Check expiration
  if (now.getTime() > new Date(attempt.expiresAt).getTime()) {
    return await autoSubmitExam(exam, attempt);
  }

  if (attempt.status !== 'IN_PROGRESS') {
    return renderAttemptSummary(exam, attempt);
  }

  const question = exam.questions[qIdx];
  if (question) {
    const qid = String(question.id || `q_${qIdx}`);
    if (!question.id) (question as any).id = qid;
    if (!attempt.answers) attempt.answers = {};
    attempt.answers[qid] = optIdx;
    attempt.currentQuestionIndex = qIdx;
    // Idempotent single-answer UPSERT (no full rewrite race)
    void store.saveAnswer(attempt.id, qid, optIdx, qIdx).catch((e) =>
      console.error('[bot] saveAnswer failed', e?.message || e)
    );
  }

  return await renderQuestionView(examId, qIdx, student, user, { refreshKeyboard: false });
}

async function renderQuestionView(
  examId: string,
  qIdx: number,
  student: Student,
  user: TelegramUser,
  opts: { refreshKeyboard?: boolean } = {}
): Promise<SimulatorResponse> {
  const now = new Date();
  const exam = store.getExamById(examId);
  if (!exam) {
    return {
      chatId: user.id,
      text: '❌ Examination not found. Please type /exams to see available tests.',
      type: 'sendMessage',
    };
  }

  void linkStudentToTeacher(student, exam.teacherId);

  let attempt = store.getAttempt(examId, student.telegramUserId!);
  if (!attempt) {
    const startRes = await handleStartOrResumeExam(examId, student, user);
    attempt = store.getAttempt(examId, student.telegramUserId!);
    if (!attempt) return startRes;
  }

  if (now.getTime() > new Date(attempt.expiresAt).getTime()) {
    return await autoSubmitExam(exam, attempt);
  }

  attempt.currentQuestionIndex = qIdx;

  // Answers are loaded on demand from SQL — hydrate if empty so OCR selections show
  if (!attempt.answers || Object.keys(attempt.answers).length === 0) {
    try {
      await store.loadAttemptAnswers(attempt.id);
      attempt = store.getAttempt(examId, student.telegramUserId!) || attempt;
    } catch (e: any) {
      console.error('[bot] loadAttemptAnswers', e?.message || e);
    }
  }

  const total = exam.questions.length;
  const question = exam.questions[qIdx];
  const qid = String(question.id || `q_${qIdx}`);
  if (!question.id) (question as any).id = qid;

  const rawSelected = attempt.answers?.[qid] ?? attempt.answers?.[String(question.id)];
  const selectedOpt =
    rawSelected === undefined || rawSelected === null || (rawSelected as any) === ''
      ? null
      : Number(rawSelected);
  const remaining = formatRemaining(attempt.expiresAt);

  // Bold question + each option in its own blockquote box
  let text =
    `📝 <b>${escapeHtml(exam.title)}</b>
` +
    `⏱️ <b>${escapeHtml(remaining)}</b> left · Q${qIdx + 1}/${total}

` +
    `<b>${escapeHtml(question.question || '')}</b>
`;

  const optsList = (question.options || []).map((o: any) =>
    typeof o === 'string' ? o : o?.text != null ? String(o.text) : String(o ?? '')
  );
  optsList.forEach((optText, oIdx) => {
    const letter = String.fromCharCode(65 + oIdx);
    const isSelected = selectedOpt !== null && !Number.isNaN(selectedOpt) && selectedOpt === oIdx;
    text += `
${optionBox(letter, String(optText || ''), isSelected)}`;
  });
  if (selectedOpt !== null && !Number.isNaN(selectedOpt)) {
    text += `

<i>Selected: ${String.fromCharCode(65 + selectedOpt)}</i>`;
  }

  // Buttons: A B C D only (full text is above)
  const keyboard: InlineKeyboardButton[][] = [];
  let letterRow: InlineKeyboardButton[] = [];
  optsList.forEach((_optText, oIdx) => {
    const letter = String.fromCharCode(65 + oIdx);
    const isSelected = selectedOpt !== null && !Number.isNaN(selectedOpt) && selectedOpt === oIdx;
    letterRow.push({
      text: isSelected ? `● ${letter}` : letter,
      callback_data: `ans_${exam.id}_${qIdx}_${oIdx}`,
    });
    if (letterRow.length === 4 || oIdx === optsList.length - 1) {
      keyboard.push(letterRow);
      letterRow = [];
    }
  });

  const navRow: InlineKeyboardButton[] = [];
  if (qIdx > 0) {
    navRow.push({ text: '◀ Previous', callback_data: `nav_${exam.id}_${qIdx - 1}` });
  }
  if (qIdx < total - 1) {
    navRow.push({ text: 'Next ▶', callback_data: `nav_${exam.id}_${qIdx + 1}` });
  }
  if (navRow.length) keyboard.push(navRow);

  keyboard.push([
    { text: '📋 Question Grid', callback_data: `grid_${exam.id}` },
    { text: '✅ Submit Exam', callback_data: `confirm_submit_${exam.id}` },
  ]);
  // Question surface: always InlineKeyboard (A–D / nav / grid / submit).
  // On exam entry only, also request ReplyKeyboard = Main menu so the My Exams
  // list keyboard is replaced. sendTelegramResponse applies both without duplicates.
  // Later answers/nav: edit the same message (inline only).

  const prevSess = getKbSession(user.id);
  const refreshKb = opts.refreshKeyboard === true;
  const prevMessageId = refreshKb ? undefined : prevSess?.lastMessageId;
  const prevKind = (prevSess?.lastMessageKind as 'photo' | 'text' | undefined) || 'text';

  const photoFileId = question.image?.fileId || undefined;
  const mediaKind: 'photo' | 'text' = photoFileId ? 'photo' : 'text';

  // Keep previous message id for cross-kind delete; do NOT flip lastMessageKind until send succeeds
  setKbSession(user.id, {
    screen: 'in_exam',
    examId: exam.id,
    qIdx,
    lastMessageId: prevMessageId,
    lastMessageKind: prevSess?.lastMessageKind,
    lastPhotoFileId: prevSess?.lastPhotoFileId,
  });
  const messageId = prevMessageId;

  // Caption limit for Telegram photos is 1024 chars.
  // Image-type: photo is the full question block (stem + figure + options).
  let caption = text;
  if (photoFileId) {
    const sel =
      selectedOpt !== null && selectedOpt !== undefined && !Number.isNaN(Number(selectedOpt))
        ? ` · Selected ${String.fromCharCode(65 + Number(selectedOpt))}`
        : '';
    caption =
      `📝 <b>${escapeHtml(exam.title)}</b>
` +
      `⏱️ <b>${escapeHtml(remaining)}</b> left · Q${qIdx + 1}/${total}${sel}
` +
      `<i>Answer using A B C D below</i>`;
  }
  if (caption.length > 1000) caption = caption.slice(0, 997) + '…';

  if (messageId && !refreshKb) {
    // Same media kind → edit in place; cross kind → force new send (handler deletes old)
    if (photoFileId && prevKind === 'photo') {
      return {
        chatId: user.id,
        text: caption,
        caption,
        photoFileId,
        replyMarkup: { inline_keyboard: keyboard },
        messageId,
        parseMode: 'HTML',
        type: 'editMessageMedia',
      };
    }
    if (!photoFileId && prevKind === 'text') {
      return {
        chatId: user.id,
        text,
        replyMarkup: { inline_keyboard: keyboard },
        messageId,
        parseMode: 'HTML',
        type: 'editMessageText',
      };
    }
    // text↔photo transition: new message + delete previous bubble
    if (photoFileId) {
      return {
        chatId: user.id,
        text: caption,
        caption,
        photoFileId,
        replyMarkup: { inline_keyboard: keyboard },
        deletePreviousMessageId: messageId,
        parseMode: 'HTML',
        type: 'sendPhoto',
      };
    }
    return {
      chatId: user.id,
      text,
      replyMarkup: { inline_keyboard: keyboard },
      deletePreviousMessageId: messageId,
      parseMode: 'HTML',
      type: 'sendMessage',
    };
  }

  // Spec: ACTIVE_EXAM uses InlineKeyboard only — remove any ReplyKeyboard on entry
  const entryKb = refreshKb ? ({ remove_keyboard: true } as any) : undefined;

  if (photoFileId) {
    return {
      chatId: user.id,
      text: caption,
      caption,
      photoFileId,
      replyMarkup: { inline_keyboard: keyboard },
      replyKeyboard: entryKb,
      parseMode: 'HTML',
      type: 'sendPhoto',
    };
  }

  return {
    chatId: user.id,
    text,
    replyMarkup: { inline_keyboard: keyboard },
    replyKeyboard: entryKb,
    parseMode: 'HTML',
    type: 'sendMessage',
  };
}

async function renderQuestionGrid(
  examId: string,
  student: Student,
  user: TelegramUser,
  page?: number
): Promise<SimulatorResponse> {
  const exam = store.getExamById(examId);
  if (!exam) {
    return {
      chatId: user.id,
      text: '❌ Examination not found.',
      replyKeyboard: mainNavReplyKeyboard(),
      type: 'sendMessage',
    };
  }

  let attempt = store.getAttempt(examId, student.telegramUserId!);
  if (!attempt) {
    await handleStartOrResumeExam(examId, student, user);
    attempt = store.getAttempt(examId, student.telegramUserId!);
    if (!attempt) {
      return { chatId: user.id, text: '❌ Exam session missing.', type: 'sendMessage' };
    }
  }

  const answeredCount = Object.keys(attempt.answers || {}).length;
  const total = exam.questions.length;
  const remaining = formatRemaining(attempt.expiresAt);
  const sessForQ = getKbSession(user.id);
  const fromSess = sessForQ?.examId === examId && sessForQ.qIdx != null ? sessForQ.qIdx : undefined;
  const currentIdx = Math.max(
    0,
    Math.min(fromSess ?? attempt.currentQuestionIndex ?? 0, total - 1)
  );
  const PER = 20;
  const totalPages = Math.max(1, Math.ceil(total / PER));
  // Open page containing the current question unless page is forced
  const p = Math.max(
    0,
    Math.min(page != null && page !== undefined ? page : Math.floor(currentIdx / PER), totalPages - 1)
  );
  const startIdx = p * PER;
  const endIdx = Math.min(startIdx + PER, total);

  let text = `📋 *Question Grid*
`;
  text += `📝 *${escapeMd(exam.title)}*
`;
  text += `⏱️ *${remaining}* left · 🟢 ${answeredCount}/${total}
`;
  text += `📄 Page ${p + 1}/${totalPages} · Now on *Q${currentIdx + 1}*

`;
  text += `_Tap a number to jump:_`;

  // Inline grid on the same bot message (edit-in-place, no chat spam)
  const keyboard: InlineKeyboardButton[][] = [];
  let row: InlineKeyboardButton[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    const q = exam.questions[i];
    const answered = attempt.answers && attempt.answers[q.id] !== undefined;
    const isCurrent = i === currentIdx;
    let label = isCurrent ? `👉${i + 1}` : answered ? `✅${i + 1}` : `${i + 1}`;
    row.push({ text: label.slice(0, 64), callback_data: `nav_${exam.id}_${i}` });
    if (row.length === 5) {
      keyboard.push(row);
      row = [];
    }
  }
  if (row.length) keyboard.push(row);

  const pageNav: InlineKeyboardButton[] = [];
  if (p > 0) pageNav.push({ text: '◀ Prev page', callback_data: `grid_${exam.id}_${p - 1}` });
  if (p < totalPages - 1) pageNav.push({ text: 'Next page ▶', callback_data: `grid_${exam.id}_${p + 1}` });
  if (pageNav.length) keyboard.push(pageNav);
  // Back to current question
  keyboard.push([
    { text: '🔙 Back to question', callback_data: `nav_${exam.id}_${currentIdx}` },
    { text: '✅ Submit Exam', callback_data: `confirm_submit_${exam.id}` },
  ]);

  const sess = getKbSession(user.id);
  setKbSession(user.id, {
    screen: 'grid',
    examId: exam.id,
    gridPage: p,
    qIdx: currentIdx,
    lastMessageId: sess?.lastMessageId,
  });

  const messageId = sess?.lastMessageId;
  return {
    chatId: user.id,
    text,
    replyMarkup: { inline_keyboard: keyboard },
    messageId,
    type: messageId ? 'editMessageText' : 'sendMessage',
  };
}

function renderSubmitConfirmation(examId: string, student: Student, user: TelegramUser): SimulatorResponse {
  const exam = store.getExamById(examId);
  const attempt = store.getAttempt(examId, student.telegramUserId!);

  if (!exam || !attempt) {
    return {
      chatId: user.id,
      text: emptyState('❌', 'Session missing', 'Open My Exams and continue the exam.'),
      parseMode: 'HTML',
      type: 'sendMessage',
    };
  }

  const answeredCount = Object.keys(attempt.answers || {}).length;
  const total = exam.questions.length;
  const unansweredCount = total - answeredCount;
  const remaining = formatRemaining(attempt.expiresAt);

  const body =
    `${titleBlock('⚠️', 'Confirm Submission')}\n` +
    `${subtitle(exam.title)}\n\n` +
    `${DIV}\n` +
    `⏱️ Time left: <b>${escapeHtml(remaining)}</b>\n` +
    `🟢 Answered: <b>${answeredCount}</b>\n` +
    `⚪ Unanswered: <b>${unansweredCount}</b>\n\n` +
    `${subtitle('Submit your examination now?')}`;

  setKbSession(user.id, {
    screen: 'submit_confirm',
    examId: exam.id,
    qIdx: attempt.currentQuestionIndex || 0,
  });

  const sess = getKbSession(user.id);
  const messageId = sess?.lastMessageId;
  const wasPhoto = sess?.lastMessageKind === 'photo';
  if (wasPhoto && messageId) {
    return {
      chatId: user.id,
      text: quote(body),
      replyMarkup: {
        inline_keyboard: [
          [{ text: '🚀 Yes, Submit Now', callback_data: `do_submit_${exam.id}` }],
          [{ text: '🔙 Continue Answering', callback_data: `nav_${exam.id}_${attempt.currentQuestionIndex || 0}` }],
        ],
      },
      deletePreviousMessageId: messageId,
      parseMode: 'HTML',
      type: 'sendMessage',
    };
  }
  return {
    chatId: user.id,
    text: quote(body),
    replyMarkup: {
      inline_keyboard: [
        [{ text: '🚀 Yes, Submit Now', callback_data: `do_submit_${exam.id}` }],
        [{ text: '🔙 Continue Answering', callback_data: `nav_${exam.id}_${attempt.currentQuestionIndex || 0}` }],
      ],
    },
    messageId,
    parseMode: 'HTML',
    type: messageId ? 'editMessageText' : 'sendMessage',
  };
}

async function handleFinalSubmit(examId: string, student: Student, user: TelegramUser): Promise<SimulatorResponse> {
  const now = new Date();
  const exam = store.getExamById(examId);
  const attempt = store.getAttempt(examId, student.telegramUserId!);

  if (!exam || !attempt) {
    return { chatId: user.id, text: '❌ Exam session missing.', type: 'sendMessage' };
  }

  if (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED') {
    return renderAttemptSummary(exam, attempt);
  }

  const startMs = new Date(attempt.startedAt).getTime();
  const timeTakenSecs = Math.max(1, Math.floor((now.getTime() - startMs) / 1000));

  const stats = calculateAttemptScore(exam, attempt.answers, timeTakenSecs);

  attempt.status = 'SUBMITTED';
  attempt.submittedAt = now.toISOString();
  attempt.score = stats.score;
  attempt.maxScore = stats.maxScore;
  attempt.percentage = stats.percentage;
  attempt.correctCount = stats.correctCount;
  attempt.wrongCount = stats.wrongCount;
  attempt.skippedCount = stats.skippedCount;
  attempt.timeTakenSeconds = stats.timeTakenSeconds;

  const saved = await store.submitAttemptIfInProgress(attempt);
  if (!saved) {
    // Already submitted (duplicate callback) — return existing summary
    const existing = store.getAttempt(examId, student.telegramUserId!);
    if (existing) return renderAttemptSummary(exam, existing);
  }
  await updateExamRanks(exam.id);
  store.addAuditLog('EXAM_SUBMITTED', `Student ${student.name} (${student.studentId}) submitted ${exam.title} with score ${attempt.score}/${attempt.maxScore}`);

  return renderAttemptSummary(exam, attempt);
}

async function autoSubmitExam(exam: Exam, attempt: Attempt): Promise<SimulatorResponse> {
  const now = new Date();
  const startMs = new Date(attempt.startedAt).getTime();
  const timeTakenSecs = Math.floor((new Date(attempt.expiresAt).getTime() - startMs) / 1000);

  const stats = calculateAttemptScore(exam, attempt.answers, timeTakenSecs);

  attempt.status = 'AUTO_SUBMITTED';
  attempt.submittedAt = now.toISOString();
  attempt.score = stats.score;
  attempt.maxScore = stats.maxScore;
  attempt.percentage = stats.percentage;
  attempt.correctCount = stats.correctCount;
  attempt.wrongCount = stats.wrongCount;
  attempt.skippedCount = stats.skippedCount;
  attempt.timeTakenSeconds = stats.timeTakenSeconds;

  const autoSaved = await store.submitAttemptIfInProgress(attempt);
  if (!autoSaved) {
    logTelegramDiag({ event: 'SUBMISSION_ALREADY_COMPLETED', action: 'auto_submit', attempt: attempt.id });
    const existing = store.getAttempt(exam.id, attempt.telegramUserId!);
    if (existing) return renderAttemptSummary(exam, existing);
    return { chatId: attempt.telegramUserId!, text: 'Already submitted.', type: 'sendMessage' };
  }
  await updateExamRanks(exam.id);
  store.addAuditLog('EXAM_AUTO_SUBMITTED', `Exam ${exam.title} auto-submitted for ${attempt.studentName} due to time expiration`);

  return renderAttemptSummary(exam, attempt);
}

function reviewWebAppUrl(attemptId: string): string {
  const base = 'https://testspace-webapp-tg.vercel.app';
  return `${base}/review?a=${encodeURIComponent(attemptId)}`;
}

function renderAttemptSummary(exam: Exam, attempt: Attempt, reviewPage: number | null = null): SimulatorResponse {
  const chatId = attempt.telegramUserId!;
  const keyboard: InlineKeyboardButton[][] = [];
  const totalQ = exam.questions?.length || 0;
  const PER_PAGE = 8;
  const totalPages = Math.max(1, Math.ceil(totalQ / PER_PAGE));
  let text = '';

  if (exam.resultVisibility === 'PUBLISHED') {
    if (reviewPage === null || reviewPage === undefined) {
      const mins = Math.floor(attempt.timeTakenSeconds / 60);
      const secs = attempt.timeTakenSeconds % 60;
      let body =
        `${titleBlock('🎉', 'Exam submitted')}\n` +
        `${subtitle(exam.title)}\n\n` +
        `👤 <b>${escapeHtml(attempt.studentName || '')}</b>\n`;
      if (attempt.attemptNumber && attempt.attemptNumber > 1) {
        body += `🔁 Practice attempt #${attempt.attemptNumber} <i>(not ranked)</i>\n`;
      }
      body +=
        `📌 ${
          attempt.status === 'AUTO_SUBMITTED' ? '⏰ Auto-submitted' : '✅ Submitted'
        }\n\n` +
        `${DIV}\n` +
        `${titleBlock('📊', 'Your score')}\n` +
        `⭐ <b>${attempt.score}</b> / ${attempt.maxScore} <i>(${attempt.percentage}%)</i>\n` +
        `✅ ${attempt.correctCount}   ❌ ${attempt.wrongCount}   ⚪ ${attempt.skippedCount}\n` +
        `⏱️ ${mins}m ${secs}s\n`;
      if (attempt.isOfficial !== false && isExamTimeEnded(exam) && attempt.rank) {
        body += `🏆 Rank: <b>#${attempt.rank}</b>\n`;
      } else if (attempt.isOfficial !== false && !isExamTimeEnded(exam)) {
        body += `🏆 Rank after exam ends\n`;
      }
      body += `\n${subtitle('Tap Review answers to open the full scrollable review.')}`;
      text = quote(body);
      if (totalQ > 0) {
        keyboard.push([
          {
            text: '📖 Review answers',
            web_app: { url: reviewWebAppUrl(attempt.id) },
          },
        ]);
      }
      keyboard.push([{ text: '🏠 Main menu', callback_data: 'btn_home' }]);
    } else {
      const page = Math.max(0, Math.min(reviewPage, totalPages - 1));
      const startQ = page * PER_PAGE;
      const endQ = Math.min(startQ + PER_PAGE, totalQ);
      let body =
        `${titleBlock('📖', 'Review answers')}\n` +
        `${subtitle(exam.title)}\n` +
        `<i>Questions ${startQ + 1}–${endQ} of ${totalQ} · Page ${page + 1}/${totalPages}</i>\n\n`;

      for (let i = startQ; i < endQ; i++) {
        const q = exam.questions[i];
        const sel = attempt.answers?.[q.id];
        const has = sel !== undefined && sel !== null;
        let mark = '⚪';
        if (has) {
          const ok = q.answer !== null && sel === q.answer;
          mark = ok ? '✅' : '❌';
        }

        const qText = escapeHtml(q.question || '');
        body += `${mark} <b>Q${i + 1}.</b>\n`;
        body += `<blockquote><b>${qText}</b></blockquote>\n`;

        if (q.options && q.options.length) {
          q.options.forEach((optText: string, oi: number) => {
            const letter = String.fromCharCode(65 + oi);
            const isCorrect = q.answer !== null && q.answer === oi;
            const prefix = isCorrect ? '✅' : '○';
            body += `${prefix} <b>${letter}.</b> ${escapeHtml(String(optText ?? ''))}\n`;
          });
        } else if (has) {
          body += `<i>${escapeHtml('Answer recorded')}</i>\n`;
        } else {
          body += `<i>Skipped</i>\n`;
        }
        body += `\n`;
      }
      text = body;
      const nav: InlineKeyboardButton[] = [];
      if (page > 0) {
        nav.push({ text: '◀ Previous', callback_data: `revatt_${attempt.id}_${page - 1}` });
      }
      if (page < totalPages - 1) {
        nav.push({ text: 'Next ▶', callback_data: `revatt_${attempt.id}_${page + 1}` });
      }
      if (nav.length) keyboard.push(nav);
      keyboard.push([{ text: '📊 Score summary', callback_data: `revatt_${attempt.id}_sum` }]);
    }
  } else {
    text = quote(
      `${titleBlock('🔒', 'Results hidden')}\n\n` +
        `${subtitle(exam.title)}\n` +
        `Your teacher has not published results yet.`
    );
  }

  if (text.length > 3900) {
    text = text.slice(0, 3890) + '…';
  }

  setKbSession(chatId, {
    screen: reviewPage != null ? 'review' : 'result_detail',
    examId: exam.id,
    attemptId: attempt.id,
    reviewPage: reviewPage != null ? reviewPage : undefined,
  });

  if (reviewPage !== null && reviewPage !== undefined) {
    const sess = getKbSession(chatId);
    const messageId = sess?.lastMessageId;
    return {
      chatId,
      text,
      replyMarkup: { inline_keyboard: keyboard },
      messageId,
      parseMode: 'HTML',
      type: messageId ? 'editMessageText' : 'sendMessage',
    };
  }

  const rows: string[][] = [];
  if (exam.resultVisibility === 'PUBLISHED' && totalQ > 0) {
    rows.push([LABELS.review]);
  }
  rows.push([LABELS.practiceAgain]);
  rows.push([LABELS.exams]);
  rows.push([LABELS.home]);

  return {
    chatId,
    text,
    replyMarkup: keyboard.length ? { inline_keyboard: keyboard } : undefined,
    replyKeyboard: kbMarkup(rows),
    parseMode: 'HTML',
    type: 'sendMessage',
  };
}

function renderStudentResults(student: Student): SimulatorResponse {
  const attempts = store
    .getAttempts()
    .filter(
      (a) =>
        (a.telegramUserId === student.telegramUserId || a.studentId === student.studentId) &&
        (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED')
    )
    .slice()
    .sort((a, b) => {
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tb - ta;
    });

  if (attempts.length === 0) {
    return {
      chatId: student.telegramUserId!,
      text: emptyState(
        '📊',
        'My Results',
        'You have not submitted any exams yet.\nOpen the link from your teacher to start.'
      ),
      replyKeyboard: mainNavReplyKeyboard(),
      parseMode: 'HTML',
      type: 'sendMessage',
    };
  }

  const shown = attempts.slice(0, 12);
  let body =
    `${titleBlock('📊', 'My Results')}\n` +
    `${subtitle(student.name)}\n\n` +
    `${DIV}\n` +
    `${subtitle('Tap an attempt below to open it.')}\n`;

  shown.forEach((att, idx) => {
    const exam = store.getExamById(att.examId);
    const title = exam?.title || 'Exam';
    const practice = att.isOfficial === false ? ' · practice' : '';
    body += `\n<b>${idx + 1}.</b> ${escapeHtml(title)}${escapeHtml(practice)}\n`;
    if (exam?.resultVisibility === 'PUBLISHED') {
      body += `<i>⭐ ${att.score}/${att.maxScore} (${att.percentage}%)</i>\n`;
    } else {
      body += `<i>🔒 Results hidden</i>\n`;
    }
  });

  const titles = shown.map((att) => {
    const exam = store.getExamById(att.examId);
    const kind = att.isOfficial === false ? 'P' : 'O';
    return `${(exam?.title || 'Exam').slice(0, 28)} (${kind})`;
  });
  const numbered = numberedListRows(titles, [
    [LABELS.exams, LABELS.leaderboard],
    [LABELS.home],
  ]);
  const labelMap: Record<string, string> = {};
  for (const [lab, idx] of Object.entries(numbered.labels)) {
    labelMap[lab] = `att:${shown[Number(idx)].id}`;
  }
  if (student.telegramUserId) {
    setKbSession(student.telegramUserId, {
      screen: 'results',
      attemptIds: shown.map((a) => a.id),
      labels: labelMap,
    });
  }

  return {
    chatId: student.telegramUserId!,
    text: quote(body),
    replyKeyboard: kbMarkup(numbered.rows),
    parseMode: 'HTML',
    type: 'sendMessage',
  };
}

function renderLeaderboardExamPicker(student: Student): SimulatorResponse {
  const myAttempts = store.getAttempts().filter(
    (a) => a.telegramUserId === student.telegramUserId || a.studentId === student.studentId
  );
  const examIds = [...new Set(myAttempts.map((a) => a.examId))];
  const exams = examIds.map((id) => store.getExamById(id)).filter(Boolean) as Exam[];

  if (exams.length === 0) {
    return {
      chatId: student.telegramUserId!,
      text: emptyState(
        '🏆',
        'Leaderboard',
        'No exams yet.\nComplete an exam from your teacher’s link to unlock rankings.'
      ),
      replyKeyboard: mainNavReplyKeyboard(),
      parseMode: 'HTML',
      type: 'sendMessage',
    };
  }

  const { rows, labels } = numberedListRows(
    exams.map((e) => e.title),
    [[LABELS.home]]
  );
  const labelMap: Record<string, string> = {};
  for (const [lab, idx] of Object.entries(labels)) {
    labelMap[lab] = `exam:${exams[Number(idx)].id}`;
  }
  if (student.telegramUserId) {
    setKbSession(student.telegramUserId, {
      screen: 'lb_pick',
      examIds: exams.map((e) => e.id),
      labels: labelMap,
    });
  }

  let body =
    `${titleBlock('🏆', 'Leaderboard')}\n` +
    `${subtitle('Pick an exam to see rankings.')}\n\n` +
    `${DIV}\n`;
  exams.forEach((exam, idx) => {
    body += `\n<b>${idx + 1}.</b> ${escapeHtml(exam.title)}\n`;
  });

  return {
    chatId: student.telegramUserId!,
    text: quote(body),
    replyKeyboard: kbMarkup(rows),
    parseMode: 'HTML',
    type: 'sendMessage',
  };
}

function renderExamLeaderboard(
  examId: string,
  student: Student,
  showAll = false
): SimulatorResponse {
  const exam = store.getExamById(examId);
  if (!exam) {
    return {
      chatId: student.telegramUserId!,
      text: emptyState('❌', 'Exam not found', 'Pick another exam from the leaderboard list.'),
      replyKeyboard: mainNavReplyKeyboard(),
      parseMode: 'HTML',
      type: 'sendMessage',
    };
  }

  if (!isExamTimeEnded(exam)) {
    return {
      chatId: student.telegramUserId!,
      text: quote(
        `${titleBlock('🏆', exam.title)}\n\n` +
          `⏳ Rankings unlock after the exam time ends.`
      ),
      replyKeyboard: kbMarkup([[LABELS.otherLb], [LABELS.home]]),
      parseMode: 'HTML',
      type: 'sendMessage',
    };
  }

  const attempts = store
    .getAttempts(exam.id)
    .filter(
      (a) =>
        (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED') && a.isOfficial !== false
    )
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.timeTakenSeconds !== b.timeTakenSeconds) return a.timeTakenSeconds - b.timeTakenSeconds;
      return 0;
    });

  let body =
    `${titleBlock('🏆', exam.title)}\n` +
    `${subtitle('Official attempts only')}\n\n` +
    `${DIV}\n`;

  if (attempts.length === 0) {
    body += `\nNo submissions yet.`;
  } else {
    const list = showAll ? attempts : attempts.slice(0, 10);
    list.forEach((att, i) => {
      const rank = i + 1;
      const medal2 = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const isMe =
        att.telegramUserId === student.telegramUserId || att.studentId === student.studentId
          ? ' ← you'
          : '';
      body += `\n${medal2} <b>${escapeHtml(att.studentName || 'Student')}</b>${escapeHtml(isMe)}\n`;
      body += `<i>⭐ ${att.score}/${att.maxScore} · ${att.percentage}%</i>\n`;
    });
    if (!showAll && attempts.length > 10) {
      body += `\n<i>…and ${attempts.length - 10} more</i>`;
    }
  }

  const rows: string[][] = [];
  if (!showAll && attempts.length > 10) {
    rows.push([LABELS.showFullLb]);
  }
  rows.push([LABELS.otherLb]);
  rows.push([LABELS.exams, LABELS.home]);

  if (student.telegramUserId) {
    setKbSession(student.telegramUserId, {
      screen: 'lb_exam',
      examId: exam.id,
    });
  }

  let text = quote(body);
  if (text.length > 3900) text = text.slice(0, 3890) + '…';

  return {
    chatId: student.telegramUserId!,
    text,
    replyKeyboard: kbMarkup(rows),
    parseMode: 'HTML',
    type: 'sendMessage',
  };
}


/** @deprecated — kept for any legacy callback; redirects to picker */
function renderStudentLeaderboard(student: Student, _showAll = false): SimulatorResponse {
  return renderLeaderboardExamPicker(student);
}

export async function sendTelegramResponse(respIn: SimulatorResponse): Promise<void> {
  let resp = respIn;
  const token = process.env.TELEGRAM_BOT_TOKEN || store.getSettings().telegramBotToken;
  if (!token) return;

  const chatId = resp.chatId;

  if (resp.clearReplyKeyboard) {
    // Reply keyboards persist at chat level. Remove the old keyboard first so
    // users cannot relaunch the unauthenticated keyboard-button Web App.
    const clearResult = await sendSafeTelegramMessage(token, chatId, '⁠', {
      replyKeyboard: { remove_keyboard: true },
    });
    const carrierId = clearResult.messageIds?.[0];
    if (carrierId) {
      await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: carrierId }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    }
  }

  const hasReplyKb = Boolean(resp.replyKeyboard);
  const hasInline = Boolean(resp.replyMarkup && (resp.replyMarkup as any).inline_keyboard);

  const rememberId = (ids?: number[]) => {
    const mid = ids && ids.length ? ids[ids.length - 1] : undefined;
    if (mid == null) return;
    const sess = getKbSession(chatId);
    if (sess) setKbSession(chatId, { ...sess, lastMessageId: mid });
    else setKbSession(chatId, { screen: 'main', lastMessageId: mid });
  };

  /**
   * ReplyKeyboard is chat-level (persists). InlineKeyboard is per-message.
   * When both needed: one sendMessage with ReplyKeyboard + text, then edit same
   * message for InlineKeyboard — one bubble, no "." / notice spam.
   */
  /**
   * Telegram allows only ONE reply_markup per message.
   * Never send the question text twice (that caused duplicate Q1 bubbles).
   * Pattern: optional silent carrier for bottom ReplyKeyboard (deleted),
   * then a SINGLE sendMessage with the question + inline A–D / nav.
   */
  /**
   * ROOT RULE: one visible content message → one reply_markup on that message.
   *
   * renderQuestionView NEVER sets replyKeyboard — only InlineKeyboard.
   * So the question path is always a single send/edit with buttons. No dual-path,
   * no second bubble, no button loss.
   *
   * Screens that need both (exam options: Main-menu ReplyKeyboard + action InlineKeyboard)
   * use: send text+ReplyKeyboard, then editMessageReplyMarkup for inline on the SAME id.
   * That path must not run for questions (they never pass both).
   */

  // ── Photo questions (diagram MCQ) ─────────────────────────────────────────
  if (resp.photoFileId) {
    const mode: 'HTML' | 'Markdown' | undefined = resp.parseMode || 'HTML';
    const caption = (resp.caption || resp.text || '').slice(0, 1024);
    const prevId = resp.messageId;

    const sendPhoto = async () => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: resp.photoFileId,
            caption,
            parse_mode: mode,
            reply_markup: resp.replyMarkup || undefined,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const data: any = await res.json().catch(() => ({}));
        if (data?.ok && data.result?.message_id != null) {
          rememberId([data.result.message_id]);
          const sess = getKbSession(chatId);
          if (sess) {
            setKbSession(chatId, {
              ...sess,
              lastMessageKind: 'photo',
              lastPhotoFileId: resp.photoFileId,
            });
          }
          return true;
        }
        console.warn('[Telegram] sendPhoto failed:', data?.description);
        return false;
      } catch (e: any) {
        console.warn('[Telegram] sendPhoto error:', e?.message || e);
        return false;
      }
    };

    if ((resp.type === 'editMessageMedia' || resp.type === 'editMessageText') && prevId) {
      const sessPrev = getKbSession(chatId);
      const samePhoto =
        Boolean(sessPrev?.lastPhotoFileId) &&
        Boolean(resp.photoFileId) &&
        sessPrev?.lastPhotoFileId === resp.photoFileId;

      // Same diagram (answer tap): caption + buttons only — no delete/resend
      if (samePhoto) {
        try {
          const resCap = await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: prevId,
              caption,
              parse_mode: mode,
              reply_markup: resp.replyMarkup || undefined,
            }),
            signal: AbortSignal.timeout(12000),
          });
          const dataCap: any = await resCap.json().catch(() => ({}));
          if (dataCap?.ok || String(dataCap?.description || '').includes('not modified')) {
            rememberId([prevId]);
            const sess = getKbSession(chatId);
            if (sess) {
              setKbSession(chatId, {
                ...sess,
                lastMessageKind: 'photo',
                lastPhotoFileId: resp.photoFileId,
              });
            }
            return;
          }
        } catch {
          /* try media edit */
        }
      }

      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/editMessageMedia`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: prevId,
            media: {
              type: 'photo',
              media: resp.photoFileId,
              caption,
              parse_mode: mode,
            },
            reply_markup: resp.replyMarkup || undefined,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const data: any = await res.json().catch(() => ({}));
        if (data?.ok) {
          rememberId([prevId]);
          const sess = getKbSession(chatId);
          if (sess) {
            setKbSession(chatId, {
              ...sess,
              lastMessageKind: 'photo',
              lastPhotoFileId: resp.photoFileId,
            });
          }
          return;
        }
      } catch {
        /* fall through to delete+send */
      }
    }

    // Cross-type transition or failed edit: delete previous bubble then send photo once
    if (prevId) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: prevId }),
          signal: AbortSignal.timeout(4000),
        });
      } catch {
        /* ignore */
      }
    }
    const ok = await sendPhoto();
    if (!ok) {
      // Fallback: text-only so exam can continue
      const r = await sendSafeTelegramMessage(token, chatId, resp.text || caption, {
        parseMode: mode,
        replyMarkup: resp.replyMarkup,
      });
      if (r.ok) {
        rememberId(r.messageIds);
        const sess = getKbSession(chatId);
        if (sess) setKbSession(chatId, { ...sess, lastMessageKind: 'text', lastPhotoFileId: undefined });
      }
    }
    // ACTIVE_EXAM: remove reply keyboard if requested (no status spam)
    if (resp.replyKeyboard && (resp.replyKeyboard as any).remove_keyboard) {
      try {
        const r0 = await sendSafeTelegramMessage(token, chatId, '⁠', {
          replyKeyboard: { remove_keyboard: true } as any,
        });
        const carrierId = r0.messageIds?.[0];
        if (carrierId) {
          await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: carrierId }),
            signal: AbortSignal.timeout(4000),
          }).catch(() => {});
        }
        logTelegramDiag({ event: 'REPLY_KEYBOARD_REMOVED', chatId, via: 'photo' });
      } catch { /* ignore */ }
    }
    return;
  }

  // Explicit cross-kind delete (diagram → text or text → diagram)
  const delId = (resp as any).deletePreviousMessageId as number | undefined;
  if (delId) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: delId }),
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      /* ignore */
    }
    resp = { ...resp, messageId: undefined, deletePreviousMessageId: undefined } as any;
  }


  if (hasReplyKb && hasInline) {
    /**
     * ACTIVE_EXAM entry: remove ReplyKeyboard then ONE question + InlineKeyboard.
     * Never send a second status bubble ("Exam started") and never dual-send question text.
     */
    const isRemove = Boolean((resp.replyKeyboard as any)?.remove_keyboard);
    if (isRemove) {
      try {
        const r0 = await sendSafeTelegramMessage(token, chatId, '⁠', {
          replyKeyboard: { remove_keyboard: true } as any,
        });
        const carrierId = r0.messageIds?.[0];
        if (carrierId) {
          await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: carrierId }),
            signal: AbortSignal.timeout(4000),
          }).catch(() => {});
        }
        logTelegramDiag({ event: 'REPLY_KEYBOARD_REMOVED', chatId });
      } catch {
        /* best-effort */
      }
    }

    let mode: 'Markdown' | 'HTML' | undefined = resp.parseMode || 'Markdown';
    const raw = resp.text || '';
    if (
      !resp.parseMode &&
      (raw.includes('<blockquote>') || raw.includes('<b>') || raw.includes('<i>'))
    ) {
      mode = 'HTML';
    }

    let rQ = await sendSafeTelegramMessage(token, chatId, raw, {
      parseMode: mode,
      replyMarkup: resp.replyMarkup,
    });
    if (!rQ.ok && mode) {
      rQ = await sendSafeTelegramMessage(token, chatId, raw, {
        replyMarkup: resp.replyMarkup,
      });
    }
    if (rQ.ok) {
      rememberId(rQ.messageIds);
      const sess = getKbSession(chatId);
      if (sess) setKbSession(chatId, { ...sess, lastMessageKind: 'text', lastPhotoFileId: undefined });
      logTelegramDiag({ event: 'QUESTION_UI_UPDATED', chatId, mode: 'send' });
    } else {
      console.warn('[Telegram] content+inline send failed:', rQ.error);
    }
    return;
  }

  const useInline = hasInline;
  const useReplyKb = hasReplyKb;

  let messageId = resp.messageId;
  if (!messageId && resp.type === 'editMessageText') {
    messageId = getKbSession(chatId)?.lastMessageId;
  }
  // Edit in place only when not applying a new ReplyKeyboard
  const preferEdit = Boolean(messageId) && !useReplyKb;

  let mode = resp.parseMode || 'Markdown';
  const rawText = resp.text || '';
  if (
    !resp.parseMode &&
    (rawText.includes('<blockquote>') || rawText.includes('<b>') || rawText.includes('<i>'))
  ) {
    mode = 'HTML';
  }
  const result = await sendSafeTelegramMessage(token, chatId, rawText, {
    parseMode: mode,
    replyMarkup: useInline ? resp.replyMarkup : undefined,
    replyKeyboard: useReplyKb ? resp.replyKeyboard : undefined,
    messageId,
    preferEdit,
  });

  if (!result.ok) {
    console.warn('[Telegram] send failed:', result.error);
    if (preferEdit) {
      const r2 = await sendSafeTelegramMessage(token, chatId, resp.text || '', {
        parseMode: mode,
        replyMarkup: resp.replyMarkup,
      });
      if (r2.ok) rememberId(r2.messageIds);
    }
    return;
  }
  rememberId(result.messageIds);
  {
    const sess = getKbSession(chatId);
    if (sess) setKbSession(chatId, { ...sess, lastMessageKind: 'text', lastPhotoFileId: undefined });
  }
}
