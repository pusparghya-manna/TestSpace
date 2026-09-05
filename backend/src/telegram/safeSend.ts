import { splitTelegramMessage } from '../utils/telegramSplit.js';

const TELEGRAM_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;

export type TelegramSendResult = {
  ok: boolean;
  messageIds?: number[];
  error?: string;
  permanent?: boolean;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchTelegram(token: string, method: string, body: Record<string, unknown>): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return await res.json().catch(() => ({ ok: false, description: 'Invalid JSON from Telegram' }));
  } finally {
    clearTimeout(timer);
  }
}

async function callWithRetry(token: string, method: string, body: Record<string, unknown>): Promise<any> {
  let last: any = { ok: false, description: 'unknown' };
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      last = await fetchTelegram(token, method, body);
      if (last?.ok) return last;
      const desc = String(last?.description || '');
      if (desc.toLowerCase().includes('message is not modified')) return { ok: true, result: last?.result };

      // Rate limit
      if (last?.error_code === 429 || desc.includes('Too Many Requests')) {
        const retryAfter = Number(last?.parameters?.retry_after || 2);
        await sleep(Math.min(30, Math.max(1, retryAfter)) * 1000);
        continue;
      }

      // Permanent-ish
      if (
        last?.error_code === 403 ||
        last?.error_code === 400 ||
        desc.includes('blocked') ||
        desc.includes('chat not found') ||
        desc.includes('user is deactivated')
      ) {
        return { ...last, permanent: true };
      }

      // Markdown issues — caller may retry without parse_mode
      if (desc.includes("can't parse entities") || desc.includes('parse entities')) {
        return last;
      }

      await sleep(100 * Math.pow(2, attempt));
    } catch (e: any) {
      last = { ok: false, description: e?.name === 'AbortError' ? 'timeout' : e?.message || 'network' };
      await sleep(100 * Math.pow(2, attempt));
    }
  }
  return last;
}

/** Send text, auto-splitting long messages. First chunk can include reply_markup. */
export async function sendSafeTelegramMessage(
  token: string,
  chatId: number,
  text: string,
  options: {
    parseMode?: 'Markdown' | 'HTML' | undefined;
    replyMarkup?: unknown;
    /** Bottom ReplyKeyboard — cannot be set via editMessageText */
    replyKeyboard?: unknown;
    messageId?: number;
    preferEdit?: boolean;
    /** If true with preferEdit, never fall back to a new sendMessage (avoids duplicate questions). */
    editOnly?: boolean;
  } = {}
): Promise<TelegramSendResult> {
  if (!token) return { ok: false, error: 'missing token', permanent: true };

  const chunks = splitTelegramMessage(text, 4000);
  const messageIds: number[] = [];
  let parseMode = options.parseMode;
  // Reply keyboard requires sendMessage
  const mustSendForKeyboard = Boolean(options.replyKeyboard);

  for (let i = 0; i < chunks.length; i++) {
    const isFirst = i === 0;
    const useEdit = Boolean(
      options.preferEdit && options.messageId && isFirst && chunks.length === 1 && !mustSendForKeyboard
    );

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: chunks[i],
    };
    if (parseMode) body.parse_mode = parseMode;
    // Prefer replyKeyboard on first chunk; else inline under message
    if (isFirst && options.replyKeyboard) body.reply_markup = options.replyKeyboard;
    else if (isFirst && options.replyMarkup) body.reply_markup = options.replyMarkup;

    let method = 'sendMessage';
    if (useEdit) {
      method = 'editMessageText';
      body.message_id = options.messageId;
    }

    let data = await callWithRetry(token, method, body);

    // Retry without parse_mode on entity errors
    if (!data?.ok && parseMode && String(data?.description || '').includes('parse')) {
      delete body.parse_mode;
      parseMode = undefined;
      data = await callWithRetry(token, method, body);
    }

    // Edit failed → fall back to sendMessage unless editOnly (exam dual-path)
    if (!data?.ok && (useEdit || method === 'editMessageText')) {
      if (options.editOnly) {
        return {
          ok: false,
          messageIds,
          error: String(data?.description || 'edit failed'),
          permanent: Boolean(data?.permanent),
        };
      }
      const desc = String(data?.description || '').toLowerCase();
      delete body.message_id;
      if (desc.includes('too long') && String(body.text || '').length > 3500) {
        body.text = String(body.text).slice(0, 3490) + '\n…';
      }
      data = await callWithRetry(token, 'sendMessage', body);
    }

    if (!data?.ok) {
      return {
        ok: false,
        messageIds,
        error: String(data?.description || 'telegram error'),
        permanent: Boolean(data?.permanent),
      };
    }
    if (data?.result?.message_id) messageIds.push(data.result.message_id);

    // Small delay between chunks to avoid burst limits
    if (i < chunks.length - 1) await sleep(50);
  }

  return { ok: true, messageIds };
}
