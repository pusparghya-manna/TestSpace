/**
 * Show interim "please wait" feedback on Telegram while slow work runs.
 * Single short line only — no extra buttons or paragraphs.
 */

const FRAMES = ['⏳', '⌛️', '🔄', '⏳'];

export function loadingText(kind: 'submit' | 'start' | 'generic' | 'results' | 'leaderboard'): string {
  const emoji = FRAMES[0];
  switch (kind) {
    case 'submit':
      return `${emoji} <b>Submitting exam…</b>`;
    case 'start':
      return `${emoji} <b>Starting exam…</b>`;
    case 'results':
      return `${emoji} <b>Loading results…</b>`;
    case 'leaderboard':
      return `${emoji} <b>Loading leaderboard…</b>`;
    default:
      return `${emoji} <b>Please wait…</b>`;
  }
}

export function classifySlowCallback(
  data: string
): 'submit' | 'start' | 'results' | 'leaderboard' | 'generic' | null {
  if (!data) return null;
  if (data.startsWith('do_submit_')) return 'submit';
  if (data.startsWith('start_exam_') || data.startsWith('resume_exam_') || data.startsWith('reattempt_'))
    return 'start';
  if (data.startsWith('rev_') || data.startsWith('revatt_')) return 'results';
  if (data === 'btn_results' || data === 'btn_leaderboard' || data === 'leaderboard_more') return null;
  if (data.startsWith('grid_')) return null;
  return null;
}

async function editText(
  token: string,
  chatId: number,
  messageId: number,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] },
      }),
      signal: AbortSignal.timeout(5000),
    });
    const data: any = await res.json().catch(() => ({}));
    return Boolean(data?.ok) || String(data?.description || '').includes('not modified');
  } catch {
    return false;
  }
}

/** Edit message to a single loading line (strips buttons). Starts a short animation loop. */
export async function sendLoadingEdit(opts: {
  token: string;
  chatId: number;
  messageId?: number;
  kind: 'submit' | 'start' | 'results' | 'leaderboard' | 'generic';
}): Promise<void> {
  const { token, chatId, messageId, kind } = opts;
  if (!token || !chatId) return;

  const labels: Record<string, string> = {
    submit: 'Submitting exam…',
    start: 'Starting exam…',
    results: 'Loading results…',
    leaderboard: 'Loading leaderboard…',
    generic: 'Please wait…',
  };
  const label = labels[kind] || labels.generic;

  const frame = (i: number) => `${FRAMES[i % FRAMES.length]} <b>${label}</b>`;

  try {
    if (messageId) {
      await editText(token, chatId, messageId, frame(0));
      // Animate a few frames while work continues (best-effort)
      for (let i = 1; i <= 3; i++) {
        await new Promise((r) => setTimeout(r, 400));
        await editText(token, chatId, messageId, frame(i));
      }
    } else {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: frame(0),
          parse_mode: 'HTML',
        }),
        signal: AbortSignal.timeout(5000),
      });
    }
  } catch {
    /* ignore */
  }
}

export async function answerCallbackLoading(
  token: string,
  callbackQueryId: string,
  kind: 'submit' | 'start' | 'results' | 'leaderboard' | 'generic'
): Promise<void> {
  const texts: Record<string, string> = {
    submit: 'Submitting…',
    start: 'Starting…',
    results: 'Loading…',
    leaderboard: 'Loading…',
    generic: 'Please wait…',
  };
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: texts[kind] || texts.generic,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* ignore */
  }
}
