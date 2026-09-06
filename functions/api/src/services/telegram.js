/**
 * Telegram bot — product scope: Mini App launcher + navigation + results/leaderboard.
 * In-chat exam UI from legacy bot.ts is intentionally not the primary product path;
 * exams run in the Mini App. Commands and deep links are fully supported.
 */
const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || '';
const WEBAPP = () => process.env.WEBAPP_URL || 'https://testspace-webapp.appwrite.network';

export async function tgApi(method, body, { retries = 3 } = {}) {
  const token = TOKEN();
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN not set' };
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      last = await res.json();
      if (res.status === 429) {
        const wait = Number(last?.parameters?.retry_after || 1) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return last;
    } catch (e) {
      last = { ok: false, description: String(e?.message || e) };
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return last;
}

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function splitTelegramMessage(text, max = 4000) {
  const s = String(text || '');
  if (s.length <= max) return [s];
  const parts = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + max, s.length);
    if (end < s.length) {
      const nl = s.lastIndexOf('\n', end);
      if (nl > i + max * 0.5) end = nl + 1;
    }
    parts.push(s.slice(i, end));
    i = end;
  }
  return parts;
}

export async function sendMessage(chatId, text, extra = {}) {
  const chunks = splitTelegramMessage(text, 4000);
  let last;
  for (const chunk of chunks) {
    last = await tgApi('sendMessage', { chat_id: chatId, text: chunk, parse_mode: 'HTML', ...extra });
  }
  return last;
}

function miniAppKeyboard(examId) {
  const url = examId ? `${WEBAPP()}?examId=${encodeURIComponent(examId)}` : WEBAPP();
  return { inline_keyboard: [[{ text: examId ? 'Start exam' : 'Open TestSpace', web_app: { url } }]] };
}

export async function getOrCreateStudent(store, user) {
  const uid = Number(user.id);
  let student = await store.getStudentByTelegramId(uid);
  if (student) return student;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `Student ${uid}`;
  student = {
    id: `STU_${uid}`,
    studentId: `TG-${uid}`,
    name,
    className: '',
    telegramUserId: uid,
    telegramUsername: user.username || null,
    status: 'linked',
    teacherIds: [],
    joinedAt: new Date().toISOString(),
  };
  await store.saveStudent(student);
  return student;
}

async function renderExamsList(store, chatId) {
  const exams = (await store.getExams()).filter((e) => e.status !== 'DRAFT' && e.status !== 'CANCELLED').slice(0, 12);
  if (!exams.length) return sendMessage(chatId, 'No exams available yet.');
  const rows = exams.map((e) => [{ text: e.title, web_app: { url: `${WEBAPP()}?examId=${encodeURIComponent(e.id)}` } }]);
  rows.push([{ text: 'Open TestSpace home', web_app: { url: WEBAPP() } }]);
  const lines = exams.map((e, i) => `${i + 1}. <b>${escapeHtml(e.title)}</b>`).join('\n');
  return sendMessage(chatId, `<b>Available exams</b>\n\n${lines}`, { reply_markup: { inline_keyboard: rows } });
}

async function renderResults(store, student, chatId) {
  const attempts = (await store.getAttempts()).filter(
    (a) => Number(a.telegramUserId) === Number(student.telegramUserId) && (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED')
  );
  if (!attempts.length) return sendMessage(chatId, 'No completed exams yet.', { reply_markup: miniAppKeyboard() });
  const exams = await store.getExams();
  const map = Object.fromEntries(exams.map((e) => [e.id, e]));
  const lines = attempts.slice(0, 10).map((a) => `• <b>${escapeHtml(map[a.examId]?.title || 'Exam')}</b> — ${a.score ?? 0}/${a.maxScore ?? 0}`);
  return sendMessage(chatId, `<b>Your results</b>\n\n${lines.join('\n')}`, { reply_markup: miniAppKeyboard() });
}

async function renderLeaderboard(store, chatId, examId) {
  let attempts = (await store.getAttempts()).filter((a) => (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED') && a.isOfficial !== false);
  if (examId) attempts = attempts.filter((a) => a.examId === examId);
  attempts.sort((a, b) => (b.percentage || 0) - (a.percentage || 0) || (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0));
  if (!attempts.length) return sendMessage(chatId, 'Leaderboard is empty.');
  const lines = attempts.slice(0, 10).map((a, i) => `${i + 1}. ${escapeHtml(a.studentName || 'Student')} — ${a.percentage ?? 0}%`);
  return sendMessage(chatId, `<b>Leaderboard</b>\n\n${lines.join('\n')}`);
}

export async function processTelegramUpdate(update, store) {
  if (update.update_id != null) {
    const claimed = await store.claimTelegramUpdate(update.update_id);
    if (!claimed) return; // duplicate
  }
  const msg = update.message || update.edited_message;
  const cq = update.callback_query;
  if (cq) {
    await tgApi('answerCallbackQuery', { callback_query_id: cq.id });
    const chatId = cq.message?.chat?.id;
    if (!chatId) return;
    const student = await getOrCreateStudent(store, cq.from || {});
    const data = String(cq.data || '');
    if (data === 'btn_exams') return renderExamsList(store, chatId);
    if (data === 'btn_results') return renderResults(store, student, chatId);
    if (data.startsWith('lb_') || data === 'btn_leaderboard') return renderLeaderboard(store, chatId, data.startsWith('lb_') ? data.slice(3) : '');
    return sendMessage(chatId, 'Open TestSpace to continue.', { reply_markup: miniAppKeyboard() });
  }
  if (!msg?.chat?.id) return;
  const chatId = msg.chat.id;
  const user = msg.from || {};
  const student = await getOrCreateStudent(store, user);
  const text = String(msg.text || '').trim();
  const [cmdRaw, ...rest] = text.split(/\s+/);
  const command = (cmdRaw || '').split('@')[0].toLowerCase();
  const arg = rest.join(' ').trim();
  if (command === '/start') {
    if (arg) {
      const examId = arg.replace(/^exam[_-]/i, '');
      const exam = await store.getExamById(examId);
      if (exam) {
        return sendMessage(chatId, `<b>${escapeHtml(exam.title)}</b>\nDuration: ${exam.durationMinutes || 60} min`, {
          reply_markup: miniAppKeyboard(exam.id),
        });
      }
    }
    return sendMessage(chatId, `<b>TestSpace</b>\n\nHi ${escapeHtml(student.name)}!`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Open TestSpace', web_app: { url: WEBAPP() } }],
          [
            { text: 'Exams', callback_data: 'btn_exams' },
            { text: 'Results', callback_data: 'btn_results' },
          ],
        ],
      },
    });
  }
  if (command === '/help') return sendMessage(chatId, '<b>Commands</b>\n/start /exams /results /leaderboard');
  if (command === '/exams') return renderExamsList(store, chatId);
  if (command === '/results') return renderResults(store, student, chatId);
  if (command === '/leaderboard') return renderLeaderboard(store, chatId, arg);
  return sendMessage(chatId, 'Use /exams or open the Mini App.', { reply_markup: miniAppKeyboard() });
}

export async function processBroadcastJobs(store, limit = 5) {
  const pending = await store.getBroadcastJobs('pending');
  const failed = await store.getBroadcastJobs('failed');
  const jobs = [...pending, ...failed].slice(0, limit);
  for (const job of jobs) {
    if (job.status === 'sent') continue;
    job.status = 'processing';
    await store.saveBroadcastJob(job);
    job.delivered = Array.isArray(job.delivered) ? job.delivered : [];
    let sent = Number(job.sent || 0);
    let failedN = 0;
    for (const rid of job.recipients || []) {
      if (job.delivered.includes(String(rid))) { sent++; continue; }
      const r = await sendMessage(rid, job.message);
      if (r?.ok) {
        sent++;
        job.delivered.push(String(rid));
      } else failedN++;
    }
    job.sent = sent;
    job.failed = failedN;
    job.status = failedN ? 'failed' : 'sent';
    job.finishedAt = new Date().toISOString();
    await store.saveBroadcastJob(job);
  }
  return jobs.length;
}
