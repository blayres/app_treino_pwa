import { useCallback } from 'react';
import { create } from 'zustand';
import { getSeenTours, saveSeenTours, withTourSeen, type TourId } from '../services/tours';

/** Elements the tour can point at (registered with useTourTarget). */
const targets = new Map<string, any>();

export const getTourTarget = (id: string) => targets.get(id) ?? null;
export const hasTourTarget = (id: string) => targets.has(id);

/** Ref callback that registers an element as a tour target (null id = not a target). */
export function useTourTarget(id: string | null) {
  return useCallback(
    (node: any) => {
      if (!id) return;
      if (node) targets.set(id, node);
      else if (targets.get(id)) targets.delete(id);
    },
    [id],
  );
}

type TourState = {
  userId: number | null;
  /** null until loaded for the current user. */
  seen: TourId[] | null;
  active: TourId | null;
  load: (userId: number) => Promise<void>;
  /** Starts the tour if the user hasn't seen it (and none is running). */
  startIfNew: (tour: TourId) => void;
  /** Ends the running tour (finished or skipped): never shown again. */
  finish: () => void;
  /** "Ver tutorial de novo" (Settings): tours show again on their screens. */
  replay: () => void;
};

export const useTourStore = create<TourState>((set, get) => ({
  userId: null,
  seen: null,
  active: null,

  load: async (userId) => {
    if (get().userId === userId && get().seen) return;
    set({ userId, seen: null, active: null });
    const seen = await getSeenTours(userId);
    if (get().userId === userId) set({ seen });
  },

  startIfNew: (tour) => {
    const { seen, active } = get();
    if (!seen || active || seen.includes(tour)) return;
    set({ active: tour });
  },

  finish: () => {
    const { active, seen, userId } = get();
    if (!active) return;
    const next = withTourSeen(seen ?? [], active);
    set({ active: null, seen: next });
    if (userId) saveSeenTours(userId, next).catch(() => {});
  },

  replay: () => set({ seen: [], active: null }),
}));
