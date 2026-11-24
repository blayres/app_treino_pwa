import type { Translations } from '../i18n/translations';

/**
 * How a program is organised:
 * - 'week': each workout has a fixed weekday (Monday…Sunday);
 * - 'sequence': no fixed days, the workouts are done in order (1, 2, 3…) on
 *   whatever day the user trains, starting over after the last one.
 *
 * Both use workouts.day_of_week as the slot (weekday 1–7, or position 1–7), so
 * the one-active-workout-per-slot index and move_workouts() work for both. The
 * mode is stored on each workout (workouts.schedule, migration_workout_schedule.sql)
 * so a coach, who can edit the student's workouts but not their profile, can
 * switch it too.
 */
export type Schedule = 'week' | 'sequence';

/** Seven weekdays, or up to seven workouts in a sequence. */
export const MAX_SLOTS = 7;

/** Sequence as soon as one active workout says so (all of them do after a save). */
export function scheduleOf(rows: readonly { schedule?: string | null }[]): Schedule {
  return rows.some((row) => row.schedule === 'sequence') ? 'sequence' : 'week';
}

/** "Segunda" for a weekly program, "Treino 2" for a sequence. */
export function slotLabel(t: Translations, schedule: Schedule, slot: number): string {
  return schedule === 'sequence' ? t.sequenceSlot(slot) : t.dayLabels[slot];
}

/**
 * Workout to do next in a sequence: the one after the most recently completed
 * (back to the first after the last), or the first if none was done yet.
 * Rest days ("Repouso") are skipped.
 */
export function nextInSequence(
  workouts: readonly { id: number; day_of_week: number; title: string; last_done: string | null }[],
): number | null {
  const ordered = workouts
    .filter((w) => !w.title.toLowerCase().includes('repouso'))
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week);
  if (ordered.length === 0) return null;
  let lastIndex = -1;
  ordered.forEach((w, index) => {
    if (w.last_done && (lastIndex < 0 || w.last_done > ordered[lastIndex].last_done!)) lastIndex = index;
  });
  return ordered[(lastIndex + 1) % ordered.length].id;
}
