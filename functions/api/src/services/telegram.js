/**
 * Converted from backend/src/telegram/bot.ts
 * Appwrite Function compatible: no Express, uses TablesDB store + Telegram Bot HTTP API.
 */
const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || '';
const WEBAPP = () => process.env.WEBAPP_URL || 'https://testspace-webapp.appwrite.network';

export async function tgApi(method, body) {
  const token = TOKEN();
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN not set' };
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function sendMessage(chatId, text, extra = {}) {
  return tgApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

export async function editMessage(chatId, messageId, text, extra = {}) {
  return tgApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    ...extra,
  });
}

function miniAppKeyboard(examId) {
  const url = examId ? `${WEBAPP()}?examId=${encodeURIComponent(examId)}` : WEBAPP();
  return {
    inline_keyboard: [[{ text: examId ? 'Start exam' : 'Open TestSpace', web_app: { url } }]],
  };
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
  const exams = (await store.getExams())
    .filter((e) => e.status !== 'DRAFT' && e.status !== 'CANCELLED')
    .slice(0, 12);
  if (!exams.length) {
    return sendMessage(chatId, 'No exams available yet. Ask your teacher to publish one.');
  }
  const rows = exams.map((e) => [
    {
      text: `${e.title}${e.subject ? ` · ${e.subject}` : ''}`,
      web_app: { url: `${WEBAPP()}?examId=${encodeURIComponent(e.id)}` },
    },
  ]);
  rows.push([{ text: 'Open TestSpace home', web_app: { url: WEBAPP() } }]);
  const lines = exams
    .map((e, i) => `${i + 1}. <b>${escapeHtml(e.title)}</b>${e.subject ? ` (${escapeHtml(e.subject)})` : ''}`)
    .join('\n');
  return sendMessage(chatId, `<b>Available exams</b>\n\n${lines}\n\nTap an exam to open it.`, {
    reply_markup: { inline_keyboard: rows },
  });
}

async function renderResults(store, student, chatId) {
  const attempts = (await store.getAttempts()).filter(
    (a) =>
      Number(a.telegramUserId) === Number(student.telegramUserId) &&
      (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED')
  );
  if (!attempts.length) {
    return sendMessage(chatId, 'No completed exams yet. Open TestSpace to take an exam.', {
      reply_markup: miniAppKeyboard(),
    });
  }
  const exams = await store.getExams();
  const map = Object.fromEntries(exams.map((e) => [e.id, e]));
  const lines = attempts.slice(0, 10).map((a) => {
    const title = map[a.examId]?.title || 'Exam';
    return `• <b>${escapeHtml(title)}</b> — ${a.score ?? 0}/${a.maxScore ?? 0} (${a.percentage ?? 0}%)`;
  });
  return sendMessage(chatId, `<b>Your results</b>\n\n${lines.join('\n')}`, {
    reply_markup: miniAppKeyboard(),
  });
}

async function renderLeaderboard(store, chatId, examId) {
  let attempts = (await store.getAttempts()).filter(
    (a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED'
  );
  if (examId) attempts = attempts.filter((a) => a.examId === examId);
  attempts.sort(
    (a, b) => (b.percentage || 0) - (a.percentage || 0) || (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0)
  );
  if (!attempts.length) return sendMessage(chatId, 'Leaderboard is empty.');
  const lines = attempts.slice(0, 10).map((a, i) => {
    return `${i + 1}. ${escapeHtml(a.studentName || 'Student')} — ${a.percentage ?? 0}%`;
  });
  return sendMessage(chatId, `<b>Leaderboard</b>\n\n${lines.join('\n')}`);
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function processTelegramUpdate(update, store) {
  const msg = update.message || update.edited_message;
  const cq = update.callback_query;

  if (cq) {
    const user = cq.from;
    const chatId = cq.message?.chat?.id;
    const data = String(cq.data || '');
    await tgApi('answerCallbackQuery', { callback_query_id: cq.id });
    if (!chatId) return;
    const student = await getOrCreateStudent(store, user);
    if (data === 'btn_exams' || data.startsWith('exams')) return renderExamsList(store, chatId);
    if (data === 'btn_results' || data.startsWith('results')) return renderResults(store, student, chatId);
    if (data.startsWith('lb_') || data === 'btn_leaderboard') {
      return renderLeaderboard(store, chatId, data.startsWith('lb_') ? data.slice(3) : '');
    }
    if (data.startsWith('exam_')) {
      return sendMessage(chatId, 'Open the Mini App to take this exam.', {
        reply_markup: miniAppKeyboard(data.slice(5)),
      });
    }
    return sendMessage(chatId, 'Open TestSpace to continue.', { reply_markup: miniAppKeyboard() });
  }

  if (!msg?.chat?.id) return;
  const chatId = msg.chat.id;
  const user = msg.from || {};
  const student = await getOrCreateStudent(store, user);
  const text = String(msg.text || '').trim();
  const [cmd, ...rest] = text.split(/\s+/);
  const command = (cmd || '').split('@')[0].toLowerCase();
  const arg = rest.join(' ').trim();

  if (command === '/start') {
    // Deep link: /start exam_<id> or examId
    if (arg) {
      const examId = arg.replace(/^exam[_-]/i, '');
      const exam = await store.getExamById(examId);
      if (exam) {
        return sendMessage(
          chatId,
          `<b>${escapeHtml(exam.title)}</b>\n${exam.subject ? escapeHtml(exam.subject) + '\n' : ''}Duration: ${exam.durationMinutes || 60} min\n\nTap below to start.`,
          { reply_markup: miniAppKeyboard(exam.id) }
        );
      }
    }
    return sendMessage(
      chatId,
      `<b>TestSpace</b>\n\nHi ${escapeHtml(student.name)}!\n\nBrowse exams, attempt tests, and view results in the Mini App.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Open TestSpace', web_app: { url: WEBAPP() } }],
            [
              { text: 'Exams', callback_data: 'btn_exams' },
              { text: 'Results', callback_data: 'btn_results' },
            ],
          ],
        },
      }
    );
  }

  if (command === '/help') {
    return sendMessage(
      chatId,
      `<b>Commands</b>\n/start — home\n/exams — published exams\n/results — your scores\n/leaderboard — rankings\n\nExams run in the TestSpace Mini App.`
    );
  }
  if (command === '/exams') return renderExamsList(store, chatId);
  if (command === '/results') return renderResults(store, student, chatId);
  if (command === '/leaderboard') return renderLeaderboard(store, chatId, arg);
  if (command === '/id') return sendMessage(chatId, `Your Telegram ID: <code>${user.id}</code>`);

  return sendMessage(chatId, 'Use /exams or open the TestSpace Mini App.', {
    reply_markup: miniAppKeyboard(),
  });
}
