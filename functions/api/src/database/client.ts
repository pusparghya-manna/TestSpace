/**
 * Database client — Appwrite TablesDB adapter.
 *
 * The project API key cannot use Databases collections (missing collections.*
 * scopes; DocumentsDB has no shared pool). Repositories keep calling
 * listDocs/getDoc/createDoc; this module stores each collection as
 * entity=<collectionId> rows on the existing TestSpace table.
 */
import { ID, Query } from 'node-appwrite';
import { env } from '../config/env.js';
import { COLLECTIONS, BUCKETS } from './appwriteClient.js';
import * as rest from './tablesRest.js';

export type SqlStmt = { sql: string; args?: unknown[] };

type Doc = Record<string, any> & { $id: string };

const endpoint = () => env.appwriteEndpoint || process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const projectId = () => env.appwriteProjectId || process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID || '';
const apiKey = () => env.appwriteApiKey || process.env.APPWRITE_API_KEY || '';
const databaseId = () => env.appwriteDatabaseId || process.env.APPWRITE_DATABASE_ID || '';
const tableId = () => process.env.APPWRITE_TABLE_ID || '6a9b8c670019ae6d8d79';

function parsePayload(row: any): Doc {
  let data: any = {};
  try {
    data = typeof row.payload === 'string' ? JSON.parse(row.payload || '{}') : row.payload || {};
  } catch {
    data = {};
  }
  const id = data.id || data.$id || row.record_id;
  return { ...data, $id: String(id), id: String(id), $rowId: row.$id };
}

function applyQueries(docs: Doc[], queries: string[]): Doc[] {
  let out = docs;
  for (const q of queries || []) {
    const s = String(q);
    const eq = s.match(/equal\("([^"]+)",\[(.*)\]\)/) || s.match(/equal\("([^"]+)",\s*"?([^"\]]+)"?\)/);
    if (eq) {
      const key = eq[1];
      let raw = eq[2] || '';
      const values = raw
        .split(',')
        .map((x) => x.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
      out = out.filter((d) => values.includes(String(d[key] ?? '')));
      continue;
    }
    if (/orderDesc\("([^"]+)"\)/.test(s)) {
      const key = s.match(/orderDesc\("([^"]+)"\)/)![1];
      out = [...out].sort((a, b) => String(b[key] || '').localeCompare(String(a[key] || '')));
    }
    if (/orderAsc\("([^"]+)"\)/.test(s)) {
      const key = s.match(/orderAsc\("([^"]+)"\)/)![1];
      out = [...out].sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || '')));
    }
  }
  return out;
}

async function listEntity(entity: string, limit = 500): Promise<{ rows: any[] }> {
  const all: any[] = [];
  let cursor: string | undefined;
  while (all.length < limit) {
    const queries: string[] = [
      Query.equal('entity', entity),
      Query.limit(Math.min(100, limit - all.length)),
      Query.orderDesc('updated_at'),
    ];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await rest.listRows(queries);
    const rows = res.rows || [];
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < 100) break;
    cursor = rows[rows.length - 1].$id;
  }
  return { rows: all };
}

export async function listDocs(collectionId: string, queries: string[] = [], limit = 100): Promise<any[]> {
  const { rows } = await listEntity(collectionId, Math.max(limit * 3, 500));
  const docs = applyQueries(rows.map(parsePayload), queries);
  return docs.slice(0, limit);
}

export async function getDoc(collectionId: string, documentId: string): Promise<any | null> {
  const res = await rest.listRows([
    Query.equal('entity', collectionId),
    Query.equal('record_id', String(documentId)),
    Query.limit(1),
  ]);
  if (!res.rows?.length) return null;
  return parsePayload(res.rows[0]);
}

export async function createDoc(
  collectionId: string,
  data: Record<string, unknown>,
  documentId?: string
): Promise<any> {
  const id = documentId || ID.unique();
  const payload = { ...data, id, $id: id };
  const row = await rest.createRow(ID.unique(), {
    entity: collectionId,
    record_id: String(id),
    payload: JSON.stringify(payload),
    updated_at: new Date().toISOString(),
  });
  return { ...payload, $rowId: row.$id };
}

export async function updateDoc(
  collectionId: string,
  documentId: string,
  data: Record<string, unknown>
): Promise<any> {
  const existing = await getDoc(collectionId, documentId);
  const next = { ...(existing || {}), ...data, id: documentId, $id: documentId };
  const t = tables();
  if (existing?.$rowId) {
    await rest.updateRow(existing.$rowId, {
      entity: collectionId,
      record_id: String(documentId),
      payload: JSON.stringify(next),
      updated_at: new Date().toISOString(),
    });
    return next;
  }
  return createDoc(collectionId, next, documentId);
}

export async function deleteDoc(collectionId: string, documentId: string): Promise<void> {
  const existing = await getDoc(collectionId, documentId);
  if (existing?.$rowId) {
    await rest.deleteRow(existing.$rowId);
  }
}

export async function findOne(collectionId: string, queries: string[]): Promise<any | null> {
  const docs = await listDocs(collectionId, queries, 1);
  return docs[0] || null;
}

export async function withWriteTx<T>(fn: (tx: { execute: (s: SqlStmt) => Promise<unknown> }) => Promise<T>): Promise<T> {
  return fn({
    execute: async () => {
      throw new Error('SQL execute is not supported. Use document helpers.');
    },
  });
}

export async function batchWrite(_stmts: SqlStmt[]): Promise<void> {}

export const db = {
  execute: async () => {
    throw new Error('SQL execute is not supported.');
  },
  transaction: async () => {
    throw new Error('SQL transactions are not supported.');
  },
};

export async function initDb(): Promise<void> {
  await rest.listRows([Query.limit(1)]);
  console.log('[db] TablesDB connected');
}

export { COLLECTIONS, ID, Query, BUCKETS };
export const dbId = databaseId;

export function getDatabases() {
  throw new Error('Databases collections API is not available on this key. Use TablesDB helpers.');
}

export function getStorage() {
  const { Storage } = require('node-appwrite');
  const client = new Client().setEndpoint(endpoint()).setProject(projectId());
  if (apiKey()) client.setKey(apiKey());
  return new Storage(client);
}
