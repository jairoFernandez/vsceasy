/**
 * In-memory TTL + LRU cache. Pair with the ORM for cheap reads:
 *
 *   const cache = createCache<User>({ ttlMs: 60_000, max: 200 });
 *   const u = await cache.wrap(`user:${id}`, () => orm(User).findById(id));
 *
 * Survives only while the extension host is running (cleared on reload).
 * For persistent caches, write through to the ORM or `globalState`.
 */

export interface CacheOptions {
  /** Time-to-live in ms. 0 = never expire. Default: 60000. */
  ttlMs?: number;
  /** Max entries. LRU eviction once exceeded. 0 = unlimited. Default: 500. */
  max?: number;
}

export interface Cache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V, ttlMsOverride?: number): void;
  delete(key: string): boolean;
  has(key: string): boolean;
  clear(): void;
  /** Memoize a loader. Returns cached value if fresh, else runs `fn` and stores. */
  wrap(key: string, fn: () => Promise<V>, ttlMsOverride?: number): Promise<V>;
  /** Force-refresh: invalidate then wrap. */
  refresh(key: string, fn: () => Promise<V>, ttlMsOverride?: number): Promise<V>;
  readonly size: number;
}

interface Entry<V> {
  value: V;
  expiresAt: number; // 0 = no expiry
}

export function createCache<V = unknown>(opts: CacheOptions = {}): Cache<V> {
  const ttl = opts.ttlMs ?? 60_000;
  const max = opts.max ?? 500;
  // Map preserves insertion order — re-insert on access for LRU behavior.
  const store = new Map<string, Entry<V>>();
  // De-dupe concurrent loads for the same key.
  const inflight = new Map<string, Promise<V>>();

  const isFresh = (e: Entry<V>) => e.expiresAt === 0 || e.expiresAt > Date.now();

  const evictIfNeeded = () => {
    if (max <= 0) return;
    while (store.size > max) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  };

  const cache: Cache<V> = {
    get(key) {
      const e = store.get(key);
      if (!e) return undefined;
      if (!isFresh(e)) {
        store.delete(key);
        return undefined;
      }
      // LRU touch
      store.delete(key);
      store.set(key, e);
      return e.value;
    },
    set(key, value, ttlMsOverride) {
      const t = ttlMsOverride ?? ttl;
      store.delete(key); // re-insert for LRU order
      store.set(key, { value, expiresAt: t > 0 ? Date.now() + t : 0 });
      evictIfNeeded();
    },
    delete(key) {
      return store.delete(key);
    },
    has(key) {
      const e = store.get(key);
      if (!e) return false;
      if (!isFresh(e)) {
        store.delete(key);
        return false;
      }
      return true;
    },
    clear() {
      store.clear();
      inflight.clear();
    },
    async wrap(key, fn, ttlMsOverride) {
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const pending = inflight.get(key);
      if (pending) return pending;
      const p = (async () => {
        try {
          const v = await fn();
          cache.set(key, v, ttlMsOverride);
          return v;
        } finally {
          inflight.delete(key);
        }
      })();
      inflight.set(key, p);
      return p;
    },
    async refresh(key, fn, ttlMsOverride) {
      cache.delete(key);
      return cache.wrap(key, fn, ttlMsOverride);
    },
    get size() {
      return store.size;
    },
  };

  return cache;
}
