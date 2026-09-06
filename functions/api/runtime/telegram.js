const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || '';

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

export async function processTelegramUpdate(update, store, webappUrl) {
  const msg = update.message || update.edited_message;
  const cq = update.callback_query;
  if (cq) {
    await tgApi('answerCallbackQuery', { callback_query_id: cq.id });
    const chatId = cq.message?.chat?.id;
    if (chatId) {
      await sendMessage(chatId, 'Open the TestSpace Mini App to take exams.', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Open TestSpace', web_app: { url: webappUrl || process.env.WEBAPP_URL } }]],
        },
      });
    }
    return;
  }
  if (!msg?.chat?.id) return;
  const chatId = msg.chat.id;
  const text = String(msg.text || '').trim();
  if (text.startsWith('/start') || text.startsWith('/help')) {
    await sendMessage(
      chatId,
      `<b>TestSpace</b>\n\nWelcome! Use the Mini App to browse exams, attempt tests, and view results.\n\nTap the button below to open.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: 'Open TestSpace', web_app: { url: webappUrl || process.env.WEBAPP_URL } }]],
        },
      }
    );
    return;
  }
  if (text.startsWith('/exams')) {
    const exams = (await store.getExams()).filter((e) => e.status !== 'DRAFT' && e.status !== 'CANCELLED').slice(0, 10);
    if (!exams.length) {
      await sendMessage(chatId, 'No exams available yet.');
      return;
    }
    const lines = exams.map((e, i) => `${i + 1}. <b>${e.title}</b> (${e.subject || 'General'})`).join('\n');
    await sendMessage(chatId, `<b>Available exams</b>\n\n${lines}\n\nOpen the Mini App to start.`, {
      reply_markup: {
        inline_keyboard: [[{ text: 'Open TestSpace', web_app: { url: webappUrl || process.env.WEBAPP_URL } }]],
      },
    });
    return;
  }
  await sendMessage(chatId, 'Use /start or open the TestSpace Mini App.');
}
