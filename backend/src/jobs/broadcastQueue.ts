import { sendSafeTelegramMessage } from '../telegram/safeSend.js';
import { store } from '../store.js';
import { db } from '../db.js';

type Job = {
  id: string;
  teacherId: string;
  message: string;
  recipients: number[];
};

const queue: Job[] = [];
let running = false;

export function enqueueBroadcast(job: Job) {
  queue.push(job);
  void processQueue();
  return job.id;
}

async function processQueue() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const job = queue.shift()!;
      const token = process.env.TELEGRAM_BOT_TOKEN || store.getSettings().telegramBotToken;
      let sent = 0;
      let failed = 0;
      await db.execute({
        sql: `INSERT OR REPLACE INTO broadcast_jobs (id, teacher_id, message, status, total, sent, failed, created_at)
              VALUES (?,?,?,?,?,?,?,?)`,
        args: [job.id, job.teacherId, job.message, 'running', job.recipients.length, 0, 0, new Date().toISOString()],
      }).catch(() => {});

      for (const tg of job.recipients) {
        if (!token) {
          failed++;
          continue;
        }
        const r = await sendSafeTelegramMessage(token, tg, job.message, { parseMode: 'Markdown' });
        if (r.ok) sent++;
        else failed++;
        // ~25 msg/sec soft limit
        await new Promise((res) => setTimeout(res, 45));
      }

      await db.execute({
        sql: `UPDATE broadcast_jobs SET status='done', sent=?, failed=?, finished_at=? WHERE id=?`,
        args: [sent, failed, new Date().toISOString(), job.id],
      }).catch(() => {});
      store.addAuditLog('BROADCAST', `Broadcast ${job.id}: sent=${sent} failed=${failed}`, job.teacherId);
      console.log(`[broadcast] ${job.id} sent=${sent} failed=${failed}`);
    }
  } finally {
    running = false;
  }
}
