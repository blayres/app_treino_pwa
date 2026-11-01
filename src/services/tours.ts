/**
 * Guided tour for new users: short spotlight steps over the real screen
 * (GuidedTour component). Each step points at a target registered with
 * useTourTarget(id); steps whose target is not on screen are skipped.
 *
 * Seen tours are stored in profiles.tours_seen (migration_guided_tour.sql).
 */
import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import type { Translations } from '../i18n/translations';

export type TourId = 'home' | 'workout';
export const ALL_TOURS: TourId[] = ['home', 'workout'];

type TextKey = {
  [K in keyof Translations]: Translations[K] extends string ? K : never;
}[keyof Translations];

export type TourStep = { target: string; title: TextKey; text: TextKey };

export const TOURS: Record<TourId, TourStep[]> = {
  home: [
    { target: 'home.days', title: 'tourDaysTitle', text: 'tourDaysText' },
    { target: 'home.edit', title: 'tourEditTitle', text: 'tourEditText' },
    { target: 'home.frequency', title: 'tourFrequencyTitle', text: 'tourFrequencyText' },
    { target: 'home.progress', title: 'tourProgressTitle', text: 'tourProgressText' },
    { target: 'home.settings', title: 'tourSettingsTitle', text: 'tourSettingsText' },
  ],
  workout: [
    { target: 'workout.start', title: 'tourStartTitle', text: 'tourStartText' },
    { target: 'workout.load', title: 'tourLoadTitle', text: 'tourLoadText' },
    { target: 'workout.substitutes', title: 'tourSubstitutesTitle', text: 'tourSubstitutesText' },
  ],
};

/** First step at or after `from` whose target is on screen; -1 when none is left. */
export function nextAvailableStep(steps: TourStep[], from: number, hasTarget: (id: string) => boolean): number {
  for (let i = Math.max(0, from); i < steps.length; i += 1) {
    if (hasTarget(steps[i].target)) return i;
  }
  return -1;
}

/** Steps that will actually be shown (for "2 de 4"). */
export function availableSteps(steps: TourStep[], hasTarget: (id: string) => boolean): number[] {
  return steps.map((step, i) => (hasTarget(step.target) ? i : -1)).filter((i) => i >= 0);
}

export function withTourSeen(seen: TourId[], tour: TourId): TourId[] {
  return seen.includes(tour) ? seen : [...seen, tour];
}

const LOCAL_KEY = (userId: number) => `toursSeen:${userId}`;

/** Tours already seen. If it can't be read (e.g. migration missing), all — never nag. */
export async function getSeenTours(userId: number): Promise<TourId[]> {
  if (backendMode !== 'supabase') {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY(userId)) ?? '[]');
    } catch {
      return ALL_TOURS;
    }
  }
  ensureSupabaseEnabled();
  const { data, error } = await supabase.from('profiles').select('tours_seen').eq('id', userId).maybeSingle();
  if (error || !data) return ALL_TOURS;
  return ((data as any).tours_seen ?? []).filter((t: string): t is TourId => (ALL_TOURS as string[]).includes(t));
}

export async function saveSeenTours(userId: number, seen: TourId[]): Promise<void> {
  if (backendMode !== 'supabase') {
    try {
      localStorage.setItem(LOCAL_KEY(userId), JSON.stringify(seen));
    } catch {
      // ignore
    }
    return;
  }
  ensureSupabaseEnabled();
  const { error } = await supabase.from('profiles').update({ tours_seen: seen }).eq('id', userId);
  if (error) throw error;
}
