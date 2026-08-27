import { lazy, type ComponentType } from 'react';

/** Wraps React.lazy so lazy screens satisfy Stack.Screen's component prop type. */
export function lazyScreen<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): T {
  return lazy(factory) as unknown as T;
}
