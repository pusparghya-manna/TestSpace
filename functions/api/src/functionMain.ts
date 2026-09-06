import express from 'express';
import { assertSecureConfig } from './config/env.js';
import { initDb } from './database/client.js';
import { ensureTeachersTable } from './auth.js';
import { store } from './store.js';
import { startServer } from './api/server.js';
import { finalizeExpiredAttempts } from './services/attemptFinalizer.js';

let appPromise: Promise<express.Express> | null = null;

async function boot(): Promise<express.Express> {
  try { assertSecureConfig(); } catch (e: any) { console.warn('[boot] config', e?.message || e); }
  const app = express();
  app.set('trust proxy', true);
  await startServer(app);
  try {
    await initDb();
    await ensureTeachersTable();
    await store.init();
    setInterval(() => { void finalizeExpiredAttempts().catch(() => {}); }, 8000).unref?.();
    console.log('[function] store ready', store.isReady());
  } catch (e: any) {
    console.error('[function] store init', e?.message || e);
  }
  return app;
}

function getApp() {
  if (!appPromise) appPromise = boot();
  return appPromise;
}

function runExpress(app: express.Express, awReq: any): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve) => {
    const method = String(awReq.method || 'GET').toUpperCase();
    let path = String(awReq.path || '/');
    if (!path.startsWith('/')) path = '/' + path;
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(awReq.headers || {})) {
      if (v == null) continue;
      headers[String(k).toLowerCase()] = Array.isArray(v) ? (v as any).join(',') : String(v);
    }
    let parsed: any = awReq.body;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
    }
    const chunks: Buffer[] = [];
    let status = 200;
    const resHeaders: Record<string, string> = {};
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve({ status, headers: resHeaders, body: Buffer.concat(chunks).toString('utf8') });
    };
    const req: any = {
      method, url: path, originalUrl: path, path, headers, body: parsed || {}, query: awReq.query || {},
      ip: headers['x-forwarded-for'] || '127.0.0.1',
      get: (n: string) => headers[n.toLowerCase()],
      on: (ev: string, cb: any) => { if (ev === 'end') cb(); return req; },
    };
    const res: any = {
      statusCode: 200, headersSent: false,
      setHeader: (k: string, v: any) => { resHeaders[k.toLowerCase()] = String(v); },
      getHeader: (k: string) => resHeaders[k.toLowerCase()],
      status(code: number) { status = code; this.statusCode = code; return this; },
      set(k: any, v?: string) {
        if (typeof k === 'object') Object.entries(k).forEach(([a, b]) => { resHeaders[a.toLowerCase()] = String(b); });
        else if (v != null) resHeaders[k.toLowerCase()] = v;
        return this;
      },
      json(obj: any) {
        resHeaders['content-type'] = 'application/json; charset=utf-8';
        chunks.push(Buffer.from(JSON.stringify(obj)));
        this.headersSent = true; finish(); return this;
      },
      send(body?: any) {
        if (body != null) {
          if (typeof body === 'object' && !Buffer.isBuffer(body)) {
            resHeaders['content-type'] = resHeaders['content-type'] || 'application/json; charset=utf-8';
            chunks.push(Buffer.from(JSON.stringify(body)));
          } else chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body)));
        }
        this.headersSent = true; finish(); return this;
      },
      end(body?: any) { if (body != null) this.send(body); else finish(); return this; },
      write(c: any) { if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))); return true; },
      redirect(a: any, b?: string) {
        if (typeof a === 'string') { status = 302; resHeaders.location = a; }
        else { status = a; resHeaders.location = b || '/'; }
        finish(); return this;
      },
      type(t: string) { resHeaders['content-type'] = t; return this; },
      on() { return this; }, once() { return this; }, emit() { return false; },
    };
    try {
      app(req, res, (err?: any) => {
        if (err) { status = 500; chunks.push(Buffer.from(JSON.stringify({ error: err?.message || 'error' }))); }
        finish();
      });
    } catch (e: any) {
      status = 500;
      chunks.push(Buffer.from(JSON.stringify({ error: e?.message || 'error' })));
      finish();
    }
    setTimeout(finish, 280000);
  });
}

export default async ({ req, res, log, error }: any) => {
  const cors: Record<string, string> = {
    'access-control-allow-origin': req?.headers?.origin || req?.headers?.Origin || '*',
    'access-control-allow-headers': 'Content-Type, Authorization, X-Telegram-Init-Data',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-credentials': 'true',
    vary: 'Origin',
  };
  try {
    if (String(req.method || 'GET').toUpperCase() === 'OPTIONS') return res.empty();
    const app = await getApp();
    const out = await runExpress(app, req);
    log(`${req.method} ${req.path} -> ${out.status}`);
    const headers = { ...cors, ...out.headers };
    if ((headers['content-type'] || '').includes('application/json')) {
      try { return res.json(JSON.parse(out.body || 'null'), out.status, headers); }
      catch { return res.send(out.body, out.status, headers); }
    }
    return res.send(out.body, out.status, headers);
  } catch (e: any) {
    error(String(e?.stack || e));
    return res.json({ error: String(e?.message || e) }, 500, cors);
  }
};
