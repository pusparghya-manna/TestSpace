import { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Simple in-memory rate limiter (per process).
 * keyFn identifies the client (IP + path recommended).
 */
export function rateLimit(opts: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
}) {
  const keyFn = opts.keyFn || ((req: Request) => `${req.ip}:${req.path}`);
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > opts.max) {
      const retry = Math.ceil((b.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }
    next();
  };
}

/** Periodic cleanup */
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now > b.resetAt) buckets.delete(k);
  }
}, 60_000).unref?.();
