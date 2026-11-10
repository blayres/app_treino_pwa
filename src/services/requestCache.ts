/**
 * In-memory cache for read queries:
 * - fresh values (within the TTL) are returned without a request;
 * - concurrent calls for the same key share one request (boot prefetch + the
 *   screen asking for the same data don't hit the network twice);
 * - `peek` returns the last value synchronously (even if stale) so a screen
 *   can render data on its first frame and refresh in the background;
 * - invalidating during a request discards that request's (stale) result.
 */
export function createRequestCache<K, V>(ttlMs: number) {
  const values = new Map<K, { expiresAt: number; value: V }>();
  const inflight = new Map<K, Promise<V>>();
  // Bumped on invalidation: a request started before it must not repopulate
  // the cache with data read before the write.
  let epoch = 0;
  const keyGenerations = new Map<K, number>();
  const generationOf = (key: K) => `${epoch}:${keyGenerations.get(key) ?? 0}`;

  return {
    /** `force`: skip the cached value and read again (the old value stays peekable until replaced). */
    get(key: K, fetcher: () => Promise<V>, options?: { force?: boolean }): Promise<V> {
      if (!options?.force) {
        const cached = values.get(key);
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
        const running = inflight.get(key);
        if (running) return running;
      }

      const startedGeneration = generationOf(key);
      const request = fetcher().then(
        (value) => {
          if (generationOf(key) === startedGeneration) values.set(key, { expiresAt: Date.now() + ttlMs, value });
          if (inflight.get(key) === request) inflight.delete(key);
          return value;
        },
        (err) => {
          if (inflight.get(key) === request) inflight.delete(key);
          throw err;
        },
      );
      inflight.set(key, request);
      return request;
    },
    /** Last known value (fresh or not); undefined if never loaded. */
    peek(key: K): V | undefined {
      return values.get(key)?.value;
    },
    /** Fresh value only (within the TTL). */
    fresh(key: K): V | undefined {
      const cached = values.get(key);
      return cached && cached.expiresAt > Date.now() ? cached.value : undefined;
    },
    set(key: K, value: V) {
      values.set(key, { expiresAt: Date.now() + ttlMs, value });
    },
    /** Drops one key, the keys matching `match`, or everything. */
    invalidate(match?: K | ((key: K) => boolean)) {
      if (match === undefined) {
        epoch++;
        values.clear();
        inflight.clear();
        return;
      }
      const test = typeof match === 'function' ? (match as (key: K) => boolean) : (key: K) => key === match;
      const keys = new Set([...values.keys(), ...inflight.keys()].filter(test));
      if (typeof match !== 'function') keys.add(match);
      keys.forEach((key) => {
        values.delete(key);
        inflight.delete(key);
        keyGenerations.set(key, (keyGenerations.get(key) ?? 0) + 1);
      });
    },
  };
}
