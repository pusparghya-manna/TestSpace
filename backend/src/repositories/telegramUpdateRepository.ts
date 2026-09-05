import { findOne, createDoc, COLLECTIONS, Query } from '../database/client.js';

export const telegramUpdateRepository = {
  async isProcessed(updateId: number): Promise<boolean> {
    const d = await findOne(COLLECTIONS.telegram_processed_updates, [
      Query.equal('update_id', updateId),
    ]);
    return !!d;
  },

  async markProcessed(updateId: number): Promise<void> {
    if (await this.isProcessed(updateId)) return;
    await createDoc(COLLECTIONS.telegram_processed_updates, {
      update_id: updateId,
      processed_at: new Date().toISOString(),
    });
  },
};
