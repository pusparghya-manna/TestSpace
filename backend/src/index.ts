import express from 'express';
import { env, assertSecureConfig } from './config/env.js';
import { initDb } from './database/client.js';
import { ensureTeachersTable } from './auth.js';
import { store } from './store.js';
import { startTelegramPolling } from './telegram/polling.js';
import { startServer } from './api/server.js';
import { finalizeExpiredAttempts } from './services/attemptFinalizer.js';

async function main() {
  // Fail fast on missing production secrets (JWT / Appwrite / Telegram token)
  assertSecureConfig();

  const PORT = env.port;
  const app = express();
  let bootError: string | null = null;

  // Liveness — process is up (Railway healthcheck). Independent of Telegram.
  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'testspace-api' });
  });
  // Readiness — DB/store initialized
  app.get('/ready', (_req, res) => {
    if (!store.isReady()) {
      return res.status(503).json({
        ok: false,
        ready: false,
        error: bootError || 'initializing',
      });
    }
    return res.status(200).json({ ok: true, ready: true, service: 'testspace-api' });
  });
  app.get('/', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'testspace-api',
      ready: store.isReady(),
    });
  });

  // Bind PORT immediately so Railway healthchecks can succeed
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[boot] listening on 0.0.0.0:${PORT} (health up)`);
      resolve();
    });
    server.on('error', reject);
    const shutdown = () => {
      console.log('[boot] shutting down…');
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 8000);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  });

  // Mount CORS/API routes before DB initialization so startup failures are
  // returned as JSON with CORS headers instead of an opaque browser fetch error.
  await startServer(app);

  // Database + store (after HTTP is up)
  try {
    await initDb();
    await ensureTeachersTable();
    await store.init();
    if (!store.isReady()) {
      throw new Error('Store failed to become ready');
    }
    const expirySweep = setInterval(() => {
      void finalizeExpiredAttempts().catch((error: any) => {
        console.warn('[attempt-finalizer] sweep failed:', error?.message || error);
      });
    }, 5000);
    expirySweep.unref?.();
    void finalizeExpiredAttempts().catch((error: any) => {
      console.warn('[attempt-finalizer] initial sweep failed:', error?.message || error);
    });
  } catch (e: any) {
    bootError = e?.message || String(e);
    console.error('[boot] FATAL database/store init:', bootError);
    // In production, exit so Railway marks deploy unhealthy rather than serving a half-broken API
    if (env.isProd) {
      process.exit(1);
    }
  }

  // Telegram after HTTP + DB (must not block /health)
  try {
    startTelegramPolling();
  } catch (e: any) {
    console.error('[boot] Telegram polling failed to start (HTTP still up):', e?.message || e);
  }

  console.log('[boot] TestSpace API fully ready');
}
main().catch((err) => {
  console.error('[boot] FATAL:', err);
  process.exit(1);
});