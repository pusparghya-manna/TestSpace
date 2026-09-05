import { db } from '../database/client.js';

export const auditRepository = {
  async findRecent(limit = 200): Promise<any[]> {
    const logs = await db.execute({
      sql: `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?`,
      args: [limit],
    });
    return logs.rows as any[];
  },

  async insert(log: {
    id: string;
    timestamp: string;
    action: string;
    details: string;
    actor: string;
    teacherId?: string | null;
  }): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO audit_logs (id, timestamp, action, details, actor, teacher_id) VALUES (?,?,?,?,?,?)',
      args: [log.id, log.timestamp, log.action, log.details, log.actor, log.teacherId ?? null],
    });
  },
};
