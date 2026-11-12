import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prefetchWhenIdle } from '../src/utils/idle';

const g = globalThis as any;
const flush = () => Promise.resolve().then(() => undefined);

afterEach(() => {
  delete g.requestIdleCallback;
  delete g.cancelIdleCallback;
  jest.useRealTimers();
});

describe('prefetchWhenIdle with requestIdleCallback', () => {
  let pending: (() => void) | null;
  beforeEach(() => {
    pending = null;
    g.requestIdleCallback = jest.fn((cb: () => void) => {
      pending = cb;
      return 42;
    });
    g.cancelIdleCallback = jest.fn<(isCancelled: () => boolean) => void>();
  });

  it('runs the work when idle, with the given timeout', () => {
    const work = jest.fn<(isCancelled: () => boolean) => void>();
    prefetchWhenIdle(work, 500);
    expect(g.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 500 });
    expect(work).not.toHaveBeenCalled();
    pending!();
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('cancel stops pending work and tells running work it was cancelled', () => {
    let isCancelled: (() => boolean) | undefined;
    const cancel = prefetchWhenIdle((check) => {
      isCancelled = check;
    });
    pending!();
    expect(isCancelled!()).toBe(false);
    cancel();
    expect(isCancelled!()).toBe(true);
    expect(g.cancelIdleCallback).toHaveBeenCalledWith(42);

    const work = jest.fn<(isCancelled: () => boolean) => void>();
    prefetchWhenIdle(work)();
    pending!();
    expect(work).not.toHaveBeenCalled();
  });

  it('swallows errors of background work', async () => {
    prefetchWhenIdle(async () => {
      throw new Error('offline');
    });
    expect(() => pending!()).not.toThrow();
    await flush();
  });
});

describe('prefetchWhenIdle without requestIdleCallback (Safari)', () => {
  it('falls back to a short timeout, cancellable', () => {
    jest.useFakeTimers();
    const work = jest.fn<(isCancelled: () => boolean) => void>();
    prefetchWhenIdle(work);
    jest.advanceTimersByTime(299);
    expect(work).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(work).toHaveBeenCalledTimes(1);

    const other = jest.fn<(isCancelled: () => boolean) => void>();
    prefetchWhenIdle(other)();
    jest.advanceTimersByTime(1000);
    expect(other).not.toHaveBeenCalled();
  });
});
