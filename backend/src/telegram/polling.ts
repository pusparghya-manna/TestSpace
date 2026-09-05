import { store } from '../store.js';
import { processTelegramUpdate, sendTelegramResponse } from './bot.js';
import {
  classifySlowCallback,
  sendLoadingEdit,
  answerCallbackLoading,
} from './loadingFeedback.js';

let isPollingRunning = false;

export function startTelegramPolling() {
  if (isPollingRunning) {
    console.warn('[Telegram Bot Engine] Polling already running — skip duplicate worker');
    return;
  }
  if (process.env.TELEGRAM_POLLING_ENABLED === 'false') {
    console.log('[Telegram Bot Engine] TELEGRAM_POLLING_ENABLED=false — polling disabled');
    return;
  }
  isPollingRunning = true;

  console.log('[Telegram Bot Engine] Starting live Telegram long polling service...');

  let offset = 0;
  let webhookCleared = false;

  const pollLoop = async () => {
    while (true) {
      const settings = store.getSettings();
      const token = process.env.TELEGRAM_BOT_TOKEN || settings.telegramBotToken;

      if (!token || settings.botActive === false) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      if (!webhookCleared) {
        webhookCleared = true;
        try {
          await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
          console.log('[Telegram Bot Engine] Webhook cleared once for polling');
        } catch { /* ignore */ }
      }

      try {
        const url =
          `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=25` +
          `&allowed_updates=${encodeURIComponent(JSON.stringify(['message', 'callback_query']))}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(35000) });

        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          if (errData.error_code === 409) {
            console.log('[Telegram Bot Engine] Webhook conflict — deleting webhook for polling…');
            await fetch(
              `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`
            ).catch(() => {});
            await new Promise((resolve) => setTimeout(resolve, 300));
            continue;
          }
          console.warn('[Telegram Bot Engine] Polling warning:', errData.description || res.statusText);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }

        const data: any = await res.json();
        if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
          for (const update of data.result) {
            offset = update.update_id + 1;

            const cb = update.callback_query;
            const slowKind = cb?.data ? classifySlowCallback(String(cb.data)) : null;

            // Answer callback immediately (toast for slow ops)
            if (cb?.id) {
              if (slowKind) {
                // Await so toast is not lost; still fast
                await answerCallbackLoading(token, cb.id, slowKind).catch(() => {});
              } else {
                fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ callback_query_id: cb.id }),
                }).catch(() => {});
              }
            }

            // CRITICAL: await loading edit BEFORE processing so it cannot overwrite the final reply
            if (slowKind && cb) {
              const chatId = cb.message?.chat?.id || cb.from?.id;
              const messageId = cb.message?.message_id;
              if (chatId) {
                await sendLoadingEdit({
                  token,
                  chatId: Number(chatId),
                  messageId: messageId ? Number(messageId) : undefined,
                  kind: slowKind,
                });
              }
            }

            try {
              const response = await processTelegramUpdate(update);
              if (response) {
                await sendTelegramResponse(response);
              }
              // null response = duplicate/stale/ignored — never inject Main Menu
            } catch (procErr: any) {
              console.error(
                '[Telegram Bot Engine] Error processing update:',
                procErr?.message || procErr
              );
              if (cb) {
                const chatId = cb.message?.chat?.id || cb.from?.id;
                const messageId = cb.message?.message_id;
                if (chatId) {
                  try {
                    await sendTelegramResponse({
                      chatId: Number(chatId),
                      messageId: messageId ? Number(messageId) : undefined,
                      type: messageId ? 'editMessageText' : 'sendMessage',
                      text: '⚠️ Something went wrong. Please try again from the main menu.',
                      replyMarkup: {
                        inline_keyboard: [[{ text: '🏠 Main menu', callback_data: 'btn_home' }]],
                      },
                    } as any);
                  } catch {
                    /* ignore */
                  }
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (err?.name !== 'TimeoutError' && err?.name !== 'AbortError') {
          console.error('[Telegram Bot Engine] Polling fetch error:', err?.message || err);
        }
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  };

  pollLoop();
}
