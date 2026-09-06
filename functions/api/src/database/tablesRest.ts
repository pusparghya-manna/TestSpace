import { env } from '../config/env.js';

const endpoint = () => (env.appwriteEndpoint || process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1').replace(/\/$/, '');
const projectId = () => env.appwriteProjectId || process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID || '';
const apiKey = () => env.appwriteApiKey || process.env.APPWRITE_API_KEY || '';
export const databaseId = () => env.appwriteDatabaseId || process.env.APPWRITE_DATABASE_ID || '';
export const tableId = () => process.env.APPWRITE_TABLE_ID || env.appwriteTableId || '6a9b8c670019ae6d8d79';

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${endpoint()}${path}`, {
    method,
    headers: {
      'X-Appwrite-Project': projectId(),
      'X-Appwrite-Key': apiKey(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.message || `Appwrite ${res.status} ${path}`);
  return data;
}

export async function listRows(queries: string[]) {
  const q = queries.map((x) => `queries[]=${encodeURIComponent(x)}`).join('&');
  return api('GET', `/tablesdb/${databaseId()}/tables/${tableId()}/rows?${q}`);
}

export async function createRow(rowId: string, data: Record<string, unknown>) {
  return api('POST', `/tablesdb/${databaseId()}/tables/${tableId()}/rows`, { rowId, data });
}

export async function updateRow(rowId: string, data: Record<string, unknown>) {
  return api('PATCH', `/tablesdb/${databaseId()}/tables/${tableId()}/rows/${rowId}`, { data });
}

export async function deleteRow(rowId: string) {
  return api('DELETE', `/tablesdb/${databaseId()}/tables/${tableId()}/rows/${rowId}`);
}

export function uniqueId() {
  return Date.now().toString(16) + Math.random().toString(16).slice(2, 10);
}
