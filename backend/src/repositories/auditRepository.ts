import { listDocs, createDoc, COLLECTIONS, Query, ID } from '../database/client.js';

export const auditRepository = {
  async findRecent(limit = 200): Promise<any[]> {
    return listDocs(COLLECTIONS.audit_logs, [Query.orderDesc('timestamp')], limit);
  },

  async insert(entry: {
    id?: string;
    timestamp: string;
    action: string;
    details?: string;
    actor?: string;
    teacher_id?: string;
  }): Promise<void> {
    await createDoc(
      COLLECTIONS.audit_logs,
      {
        timestamp: entry.timestamp,
        action: entry.action,
        details: entry.details || '',
        actor: entry.actor || '',
        teacher_id: entry.teacher_id || '',
      },
      entry.id || ID.unique()
    );
  },
};
