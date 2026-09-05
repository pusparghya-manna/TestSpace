/**
 * Bounded in-memory L1 cache.
 * - Tenant-aware keys required (caller must include teacherId).
 * - Request coalescing prevents stampedes.
 * - Failures never throw to callers of getOrSet beyond the loader itself.
 * - Extensible later with optional Redis L2 (not required).
 *
 * SQL remains source of truth. Cache is never permanent.
 */

type Entry<T> = { value: T; expiresAt: number };

const MAX_ENTRIES = 500;

class L1Cache {
  private map = new Map<string, Entry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  get<T>(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    return e.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.map.size >= MAX_ENTRIES) {
      // evict oldest ~10%
      let n = Math.ceil(MAX_ENTRIES * 0.1);
      for (const k of this.map.keys()) {
        this.map.delete(k);
        if (--n <= 0) break;
      }
    }
    this.map.set(key, { value, expiresAt: Date.now() + Math.max(0, ttlMs) });
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  /** Invalidate all keys starting with prefix (e.g. `t:TinkoriSir:`). */
  invalidatePrefix(prefix: string): void {
    for (const k of [...this.map.keys()]) {
      if (k.startsWith(prefix)) this.map.delete(k);
    }
  }

  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T> | T): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;

    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const p = Promise.resolve()
      .then(() => loader())
      .then((value) => {
        this.set(key, value, ttlMs);
        this.inflight.delete(key);
        return value;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });

    this.inflight.set(key, p);
    return p;
  }
}

export const l1Cache = new L1Cache();

/** Tenant-scoped key helper — always include teacher id. */
export function tenantKey(teacherId: string, resource: string): string {
  const t = teacherId || 'anonymous';
  return `t:${t}:${resource}`;
}

export function invalidateTeacherCache(teacherId: string): void {
  if (!teacherId) return;
  l1Cache.invalidatePrefix(`t:${teacherId}:`);
}
