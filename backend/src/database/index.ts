export {
  db,
  withWriteTx,
  batchWrite,
  initDb,
  listDocs,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  findOne,
  COLLECTIONS,
  ID,
  Query,
  getStorage,
  getDatabases,
  dbId,
  type SqlStmt,
} from './client.js';

export { ensureAppwriteSchema, BUCKETS } from './appwriteClient.js';
