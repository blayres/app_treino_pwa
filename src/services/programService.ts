/**
 * The weekly program as an editable draft, shared by OnboardingScreen and
 * MyWorkoutScreen: load the current program, build one from pasted text, and
 * save a draft by applying only what changed.
 */
import type { Exercise, WorkoutExercise, WorkoutWithLastDone } from './types';
import {
  archiveWorkout,
  createCustomExercise,
  createWorkoutForUser,
  DEFAULT_CUSTOM_REST_SECONDS,
  DEFAULT_CUSTOM_SCHEME,
  getCachedWorkoutExercises,
  getCachedWorkoutsByUser,
  getWorkoutExercises,
  getWorkoutsByUser,
  invalidateWorkoutsByUserCache,
  MoveNotSupportedError,
  moveWorkoutsToDays,
  replaceWorkoutItems,
  updateWorkoutTitle,
  type WorkoutItemInput,
} from './workoutService';
import { assignWeekdays, matchExercise, parseWorkoutText } from './workoutTextParser';

export type DraftItem = {
  key: string;
  /** Catalogue/private exercise; null = created as a private exercise on save. */
  exercise: Exercise | null;
  name: string;
  /** Effective scheme shown in the editor. */
  scheme: string;
  /** Explicit rest for this workout; null = the exercise's default. */
  restSeconds: number | null;
  /** Original imported text when matched to a differently named exercise. */
  wrote: string | null;
  /** Coach instructions (cadence, drop-sets…) for this exercise in this workout. */
  notes: string | null;
};

export type DraftDay = {
  key: string;
  /** Existing workout this card edits; undefined for a new day. */
  workoutId?: number;
  dayOfWeek: number;
  title: string;
  items: DraftItem[];
  /** Unselected in the editor but kept so re-selecting restores it. */
  hidden?: boolean;
};

let keySeq = 0;
export const nextDraftKey = () => `k${++keySeq}`;

export const visibleDays = (days: DraftDay[]) => days.filter((day) => !day.hidden);

export function newDraftItem(exercise: Exercise): DraftItem {
  return {
    key: nextDraftKey(),
    exercise,
    name: exercise.name,
    scheme: exercise.scheme,
    restSeconds: null,
    wrote: null,
    notes: null,
  };
}

// Base (catalogue) values of exercises loaded from an existing workout, so
// saving can tell a per-workout override from the default. Keyed by exercise id.
const baseValues = new Map<number, { scheme: string; restSeconds: number }>();

function baseOf(exercise: Exercise) {
  return baseValues.get(exercise.id) ?? { scheme: exercise.scheme, restSeconds: exercise.rest_seconds };
}

/** Current active program as draft days (sorted by weekday). */
function toDraftDay(workout: WorkoutWithLastDone, rows: WorkoutExercise[]): DraftDay {
  return {
    key: nextDraftKey(),
    workoutId: workout.id,
    dayOfWeek: workout.day_of_week,
    title: workout.title,
    items: rows.map((row) => {
      baseValues.set(row.exercise_id, {
        scheme: row.base_scheme ?? row.exercise.scheme,
        restSeconds: row.base_rest_seconds ?? row.exercise.rest_seconds,
      });
      return {
        key: nextDraftKey(),
        exercise: row.exercise,
        name: row.exercise.name,
        scheme: row.exercise.scheme,
        restSeconds: row.rest_seconds_override ?? null,
        wrote: null,
        notes: row.notes ?? null,
      };
    }),
  };
}

/** `fresh`: also re-read the days (e.g. a coach viewing a program the student may have changed). */
export async function loadProgramDraft(userId: number, options?: { fresh?: boolean }): Promise<DraftDay[]> {
  const workouts = await getWorkoutsByUser(userId, options);
  const days = await Promise.all(
    workouts.map(async (workout) => {
      // Editing starts from fresh rows, never from a cached list.
      return toDraftDay(workout, await getWorkoutExercises(workout.id, { fresh: true }));
    }),
  );
  return days.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

/**
 * The program as last loaded (Home warms it), to draw the editor on its first
 * frame while loadProgramDraft fetches fresh rows. Null if anything is missing.
 */
export function peekProgramDraft(userId: number): DraftDay[] | null {
  const workouts = getCachedWorkoutsByUser(userId);
  if (!workouts) return null;
  const days: DraftDay[] = [];
  for (const workout of workouts) {
    const rows = getCachedWorkoutExercises(workout.id);
    if (!rows) return null;
    days.push(toDraftDay(workout, rows));
  }
  return days.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

/** Pasted text → draft days matched against the catalogue. Empty if nothing found. */
export function draftFromText(text: string, catalogue: Exercise[], usedWeekdays: number[] = []): DraftDay[] {
  const parsed = parseWorkoutText(text);
  if (parsed.length === 0) return [];
  return assignWeekdays(parsed, () => '', usedWeekdays)
    .map((day) => ({
      key: nextDraftKey(),
      dayOfWeek: day.dayOfWeek!,
      title: day.title,
      items: day.exercises.map((parsedItem) => {
        const match = matchExercise(parsedItem.name, catalogue);
        const exercise = match?.item ?? null;
        return {
          key: nextDraftKey(),
          exercise,
          name: exercise?.name ?? parsedItem.name,
          scheme: parsedItem.scheme ?? exercise?.scheme ?? DEFAULT_CUSTOM_SCHEME,
          restSeconds: parsedItem.restSeconds,
          wrote: match && !match.exact ? parsedItem.name : null,
          notes: parsedItem.notes ?? null,
        };
      }),
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

/** Stable signature of a day's exercises, to detect edits. */
export function itemsSignature(items: DraftItem[]): string {
  return items
    .map((item) => `${item.exercise?.id ?? `new:${item.name}`}|${item.scheme.trim()}|${item.restSeconds ?? ''}|${item.notes ?? ''}`)
    .join(';');
}

/** Creates (once) every private exercise the draft needs. */
async function resolveNewExercises(userId: number, days: DraftDay[]): Promise<Map<string, Exercise>> {
  const created = new Map<string, Exercise>();
  for (const day of days) {
    for (const item of day.items) {
      if (item.exercise) continue;
      const key = item.name.trim().toLowerCase();
      if (created.has(key)) continue;
      created.set(
        key,
        await createCustomExercise({
          userId,
          name: item.name,
          scheme: item.scheme.trim() || DEFAULT_CUSTOM_SCHEME,
          restSeconds: item.restSeconds ?? DEFAULT_CUSTOM_REST_SECONDS,
        }),
      );
    }
  }
  return created;
}

function toWorkoutItems(items: DraftItem[], created: Map<string, Exercise>): WorkoutItemInput[] {
  return items.map((item) => {
    const exercise = item.exercise ?? created.get(item.name.trim().toLowerCase())!;
    const base = baseOf(exercise);
    const scheme = item.scheme.trim();
    return {
      exerciseId: exercise.id,
      scheme: scheme && scheme !== base.scheme ? scheme : null,
      restSeconds: item.restSeconds != null && item.restSeconds !== base.restSeconds ? item.restSeconds : null,
      notes: item.notes?.trim() || null,
    };
  });
}

export type SaveProgramOptions = {
  userId: number;
  draft: DraftDay[];
  /** Days as loaded (to diff against). Empty for a brand-new program. */
  original: DraftDay[];
  /** Archive every original workout and create the draft from scratch. */
  replaceAll?: boolean;
  defaultTitle: (dayOfWeek: number) => string;
  /** Weekdays already created by an earlier failed attempt (skipped on retry). */
  createdDays?: Set<number>;
};

/**
 * Applies the draft: archives removed days (history is kept), moves days to
 * other weekdays in place (swaps included, history stays attached), updates
 * titles and exercise lists that changed, and creates new days.
 */
export async function saveProgram(options: SaveProgramOptions): Promise<void> {
  const { userId, original, replaceAll, defaultTitle } = options;
  const createdDays = options.createdDays ?? new Set<number>();
  const draft = visibleDays(options.draft);
  const created = await resolveNewExercises(userId, draft);
  const originalById = new Map(original.filter((d) => d.workoutId).map((d) => [d.workoutId!, d]));
  const titleOf = (day: DraftDay) => day.title.trim() || defaultTitle(day.dayOfWeek);

  // Classify existing days: kept on the same weekday, moved, or removed.
  const keptIds = new Set<number>();
  const moves: { workoutId: number; dayOfWeek: number }[] = [];
  if (!replaceAll) {
    draft.forEach((day) => {
      const before = day.workoutId ? originalById.get(day.workoutId) : undefined;
      if (!before) return;
      keptIds.add(day.workoutId!);
      if (before.dayOfWeek !== day.dayOfWeek) moves.push({ workoutId: day.workoutId!, dayOfWeek: day.dayOfWeek });
    });
  }

  // 1. Archive removed days (all of them when replacing) — frees their weekdays.
  for (const workoutId of originalById.keys()) {
    if (!keptIds.has(workoutId)) await archiveWorkout(workoutId);
  }

  // 2. Move days in place (swaps included), keeping their history. Without the
  //    move_workouts migration, fall back to archiving + re-creating them.
  try {
    await moveWorkoutsToDays(moves);
  } catch (err) {
    if (!(err instanceof MoveNotSupportedError)) throw err;
    for (const move of moves) {
      await archiveWorkout(move.workoutId);
      keptIds.delete(move.workoutId);
    }
  }

  // 3. Update kept/moved days whose title or exercises changed.
  for (const day of draft) {
    if (!day.workoutId || !keptIds.has(day.workoutId)) continue;
    const before = originalById.get(day.workoutId)!;
    if (titleOf(day) !== before.title) await updateWorkoutTitle(day.workoutId, titleOf(day));
    if (itemsSignature(day.items) !== itemsSignature(before.items)) {
      await replaceWorkoutItems(day.workoutId, toWorkoutItems(day.items, created));
    }
  }

  // 4. Create new days (and moved ones, in the fallback).
  for (const day of draft) {
    if (day.workoutId && keptIds.has(day.workoutId)) continue;
    if (createdDays.has(day.dayOfWeek)) continue;
    await createWorkoutForUser({
      userId,
      dayOfWeek: day.dayOfWeek,
      title: titleOf(day),
      items: toWorkoutItems(day.items, created),
    });
    createdDays.add(day.dayOfWeek);
  }

  invalidateWorkoutsByUserCache(userId);
}

/** Has the draft changed compared to what was loaded? */
export function isProgramDirty(original: DraftDay[], draft: DraftDay[]): boolean {
  const summarize = (days: DraftDay[]) =>
    visibleDays(days)
      .map((d) => `${d.workoutId ?? 'new'}@${d.dayOfWeek}:${d.title.trim()}:${itemsSignature(d.items)}`)
      .sort()
      .join('\n');
  return summarize(original) !== summarize(draft);
}

/** Copies a day (with its exercises) to another weekday, replacing a hidden card there. */
export function copyDayTo(days: DraftDay[], dayKey: string, dayOfWeek: number): DraftDay[] {
  const source = days.find((d) => d.key === dayKey);
  if (!source) return days;
  const copy: DraftDay = {
    key: nextDraftKey(),
    dayOfWeek,
    title: source.title,
    items: source.items.map((item) => ({ ...item, key: nextDraftKey() })),
  };
  return [...days.filter((d) => !(d.hidden && d.dayOfWeek === dayOfWeek)), copy].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek,
  );
}

/** Swaps the weekdays of two visible cards (drag & drop / "Trocar dia" onto a taken day). */
export function swapDays(days: DraftDay[], keyA: string, keyB: string): DraftDay[] {
  const a = days.find((d) => d.key === keyA);
  const b = days.find((d) => d.key === keyB);
  if (!a || !b || a === b) return days;
  return days
    .map((d) => (d.key === keyA ? { ...d, dayOfWeek: b.dayOfWeek } : d.key === keyB ? { ...d, dayOfWeek: a.dayOfWeek } : d))
    .sort((x, y) => x.dayOfWeek - y.dayOfWeek);
}
