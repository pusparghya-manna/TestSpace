/** @deprecated Prefer `import { db, withWriteTx, initDb } from './database/index.js'` */
export { db, withWriteTx, batchWrite, initDb, type SqlStmt } from './database/client.js';
