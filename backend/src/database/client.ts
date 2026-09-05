/**
 * Database client — Appwrite Databases (replaces Turso/libSQL).
 * Provides a thin compatibility layer so repositories can migrate gradually.
 */
import {
  getDatabases,
  getStorage,
  ensureAppwriteSchema,
  dbId,
  COLLECTIONS,
  ID,
  Query,
  type Models,
} from './appwriteClient.js';
import { env } from '../config/env.js';

const isProd = env.isProd;

export type SqlStmt = { sql: string; args?: unknown[] };

/** Document helpers */
export async function listDocs(
  collectionId: string,
  queries: string[] = [],
  limit = 100
): Promise<Models.Document[]> {
  const dbs = getDatabases();
  const res = await dbs.listDocuments(dbId(), collectionId, [
    ...queries,
    Query.limit(limit),
  ]);
  return res.documents;
}

export async function getDoc(collectionId: string, documentId: string): Promise<Models.Document | null> {
  try {
    return await getDatabases().getDocument(dbId(), collectionId, documentId);
  } catch {
    return null;
  }
}

export async function createDoc(
  collectionId: string,
  data: Record<string, unknown>,
  documentId?: string
): Promise<Models.Document> {
  return getDatabases().createDocument(
    dbId(),
    collectionId,
    documentId || ID.unique(),
    data
  );
}

export async function updateDoc(
  collectionId: string,
  documentId: string,
  data: Record<string, unknown>
): Promise<Models.Document> {
  return getDatabases().updateDocument(dbId(), collectionId, documentId, data);
}

export async function deleteDoc(collectionId: string, documentId: string): Promise<void> {
  await getDatabases().deleteDocument(dbId(), collectionId, documentId);
}

export async function findOne(
  collectionId: string,
  queries: string[]
): Promise<Models.Document | null> {
  const docs = await listDocs(collectionId, queries, 1);
  return docs[0] || null;
}

/** Sequential multi-write (Appwrite transactions are limited; best-effort atomicity). */
export async function withWriteTx<T>(fn: (tx: { execute: (s: SqlStmt) => Promise<unknown> }) => Promise<T>): Promise<T> {
  // Compatibility shim: repositories still calling withWriteTx will need migration.
  // For Appwrite we run the callback with a no-op execute that logs a warning.
  console.warn('[db] withWriteTx is a compatibility shim — prefer document APIs');
  return fn({
    execute: async () => {
      throw new Error('SQL execute is not supported on Appwrite. Use document helpers.');
    },
  });
}

export async function batchWrite(_stmts: SqlStmt[]): Promise<void> {
  console.warn('[db] batchWrite is not supported on Appwrite document store');
}

/** Dummy client for any remaining SQL-style code paths during migration */
export const db = {
  execute: async (_q: unknown) => {
    throw new Error('SQL execute is not supported. Migrate to Appwrite document APIs (listDocs/getDoc/createDoc).');
  },
  transaction: async () => {
    throw new Error('SQL transactions are not supported on Appwrite. Use document helpers.');
  },
};

export async function initDb(): Promise<void> {
  const maxAttempts = isProd ? 8 : 5;
  let lastErr: unknown;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await ensureAppwriteSchema();
      console.log('[db] Appwrite connected; schema ready');
      return;
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message || String(err);
      console.error(`[db] init attempt ${i}/${maxAttempts} failed:`, msg);
      if (i < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * i));
      }
    }
  }
  if (isProd) {
    console.error('[db] FATAL: Could not connect to Appwrite after retries. Refusing to start.');
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
  console.warn('[db] Appwrite unavailable — continuing in development only (data may not persist)');
}

export { COLLECTIONS, ID, Query, getStorage, getDatabases, dbId };
