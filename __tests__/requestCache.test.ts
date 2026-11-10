import { describe, expect, it, jest } from '@jest/globals';
import { createRequestCache } from '../src/services/requestCache';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe('createRequestCache', () => {
  it('returns a fresh value without a new request', async () => {
    const cache = createRequestCache<number, string>(60_000);
    const fetcher = jest.fn(async () => 'a');
    await cache.get(1, fetcher);
    expect(await cache.get(1, fetcher)).toBe('a');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('shares one request between concurrent callers (boot prefetch + screen)', async () => {
    const cache = createRequestCache<number, string>(60_000);
    const d = deferred<string>();
    const fetcher = jest.fn(() => d.promise);
    const first = cache.get(1, fetcher);
    const second = cache.get(1, fetcher);
    d.resolve('x');
    expect(await Promise.all([first, second])).toEqual(['x', 'x']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('peek keeps the last value after it expires (TTL 0 = always re-read)', async () => {
    const cache = createRequestCache<number, string>(0);
    expect(cache.peek(1)).toBeUndefined();
    await cache.get(1, async () => 'old');
    expect(cache.peek(1)).toBe('old');
    expect(cache.fresh(1)).toBeUndefined();
    const fetcher = jest.fn(async () => 'new');
    expect(await cache.get(1, fetcher)).toBe('new');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a request started before an invalidation does not repopulate the cache', async () => {
    const cache = createRequestCache<number, string>(60_000);
    const d = deferred<string>();
    const pending = cache.get(1, () => d.promise);
    cache.invalidate(1); // e.g. the user saved while the old list was loading
    d.resolve('stale');
    await pending;
    expect(cache.peek(1)).toBeUndefined();
    expect(await cache.get(1, async () => 'fresh')).toBe('fresh');
  });

  it('invalidating one key keeps the others', async () => {
    const cache = createRequestCache<string, number>(60_000);
    await cache.get('5:2026:10', async () => 1);
    await cache.get('6:2026:10', async () => 2);
    cache.invalidate((key) => key.startsWith('5:'));
    expect(cache.peek('5:2026:10')).toBeUndefined();
    expect(cache.peek('6:2026:10')).toBe(2);
  });

  it('force re-reads but keeps the old value peekable until the new one arrives', async () => {
    const cache = createRequestCache<number, string>(60_000);
    await cache.get(1, async () => 'old');
    const d = deferred<string>();
    const pending = cache.get(1, () => d.promise, { force: true });
    expect(cache.peek(1)).toBe('old');
    d.resolve('new');
    expect(await pending).toBe('new');
    expect(cache.peek(1)).toBe('new');
  });

  it('a failed request is not cached and can be retried', async () => {
    const cache = createRequestCache<number, string>(60_000);
    await expect(cache.get(1, async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect(await cache.get(1, async () => 'ok')).toBe('ok');
  });
});
