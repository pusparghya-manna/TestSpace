import { db } from '../database/client.js';

export const telegramUpdateRepository = {
  /**
   * Atomically claim update_id before any business logic.
   * Returns true only when this process inserted the row.
   */
  async claim(updateId: number): Promise<boolean> {
    try {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO telegram_processed_updates (update_id, processed_at) VALUES (?, ?)`,
        args: [updateId, new Date().toISOString()],
      });
      const affected = Number(
        (result as any)?.rowsAffected ?? (result as any)?.rows_affected ?? 0
      );
      return affected > 0;
    } catch {
      return false;
    }
  },
};
