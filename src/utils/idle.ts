/**
 * Runs background work when the browser is idle (after the current screen has
 * painted). Returns a cancel function for effects.
 */
export function prefetchWhenIdle(
  work: (isCancelled: () => boolean) => void | Promise<void>,
  timeoutMs = 2000,
): () => void {
  let cancelled = false;
  const run = () => {
    if (!cancelled) void Promise.resolve(work(() => cancelled)).catch(() => {});
  };
  const w = globalThis as any;
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(run, { timeout: timeoutMs });
    return () => {
      cancelled = true;
      w.cancelIdleCallback?.(id);
    };
  }
  const id = setTimeout(run, 300);
  return () => {
    cancelled = true;
    clearTimeout(id);
  };
}
