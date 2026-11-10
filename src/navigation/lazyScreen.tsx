import React, { lazy, Suspense, type ComponentType } from 'react';
import { prefetchWhenIdle } from '../utils/idle';

export type LazyScreen<T extends ComponentType<any>> = T & {
  /** Downloads the screen's code ahead of time (safe to call many times). */
  preload: () => Promise<unknown>;
};

/**
 * A code-split screen that never flashes a blank page:
 * - `preload()` fetches its code in the background (App calls it after the
 *   first paint), and once loaded the screen renders directly, without
 *   suspending — React.lazy alone suspends for a frame even when cached;
 * - if it is opened before its code arrives, `Fallback` (the screen's static
 *   shell: banner, header, skeletons) shows instead of an empty page.
 */
export function lazyScreen<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  Fallback?: ComponentType<any>,
): LazyScreen<T> {
  let loaded: T | null = null;
  let pending: Promise<{ default: T }> | null = null;

  const load = () => {
    pending ??= factory().then(
      (mod) => {
        loaded = mod.default;
        return mod;
      },
      (err) => {
        pending = null; // allow a retry (e.g. offline for a moment)
        throw err;
      },
    );
    return pending;
  };

  const Lazy = lazy(load);

  function Screen(props: any) {
    const Loaded = loaded;
    if (Loaded) return <Loaded {...props} />;
    return (
      <Suspense fallback={Fallback ? <Fallback {...props} /> : null}>
        <Lazy {...props} />
      </Suspense>
    );
  }

  return Object.assign(Screen, { preload: load }) as unknown as LazyScreen<T>;
}

/** Preloads screens when the browser is idle (after the first paint), one at a time. */
export function preloadWhenIdle(screens: { preload: () => Promise<unknown> }[]): () => void {
  return prefetchWhenIdle(async (isCancelled) => {
    for (const screen of screens) {
      if (isCancelled()) return;
      await screen.preload().catch(() => {});
    }
  });
}
