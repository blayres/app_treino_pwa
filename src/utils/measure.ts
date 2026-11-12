/**
 * How an exercise is measured: by load (kg, the default) or by time (plank,
 * wall sit…). It is read from the scheme itself, so it stays flexible: any
 * exercise — catalogue, the user's own, imported, or a coach's per-workout
 * override — becomes timed as soon as its reps are written in time
 * ("3x30s", "3x30-45s", "4x1min", "3 x 40 seg").
 *
 * Timed exercises show a hold-time input (seconds, saved like a load in
 * exercise_loads.load_kg but never in the load history) and a countdown.
 */

export type Measure = 'load' | 'time';

/** A number followed by a time unit, not part of a longer word ("4 séries" is not time). */
const TIME_UNIT = /\d\s*(?:s|seg|segs|segundos?|sec|secs|seconds?|min|mins|minutos?|minutes?|"|'')(?![a-zà-ÿ])/i;

/** Main part of a scheme: "3x10-12 e 1x falha" → "3x10-12". */
function mainPart(scheme: string): string {
  return scheme.split(' e ')[0] ?? '';
}

export function schemeMeasure(scheme: string | null | undefined): Measure {
  return scheme && TIME_UNIT.test(mainPart(scheme)) ? 'time' : 'load';
}

export const isTimeScheme = (scheme: string | null | undefined) => schemeMeasure(scheme) === 'time';

export const DEFAULT_TIME_REPS = '30s';
export const DEFAULT_LOAD_REPS = '10-12';

/** Number of sets at the start of a scheme ("4x10-12", "5 séries", "3 sets" → 4, 5, 3), else 3. */
function setsOf(scheme: string): number {
  const match = scheme.trim().match(/^(\d+)\s*(?:[x×*]|s[ée]ries?|sets?)/i);
  return match ? Number(match[1]) : 3;
}

/** Same number of sets, reps switched to the other measure: "4x10-12" ⇄ "4x30s". */
export function switchSchemeMeasure(scheme: string, to: Measure): string {
  if (schemeMeasure(scheme) === to) return scheme;
  const sets = setsOf(scheme);
  return `${sets}x${to === 'time' ? DEFAULT_TIME_REPS : DEFAULT_LOAD_REPS}`;
}

/**
 * Target hold time in seconds from a timed scheme, using the upper end of a
 * range: "3x30-45s" → 45, "4x1min" → 60, "3x1-2min" → 120. Null if not timed.
 */
export function targetSeconds(scheme: string | null | undefined): number | null {
  if (!isTimeScheme(scheme)) return null;
  const main = mainPart(scheme!);
  const reps = main.replace(/^\s*\d+\s*[x×]\s*/i, '');
  const match = reps.match(/(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s*([a-z"']+)/i);
  if (!match) return null;
  const value = Number((match[2] ?? match[1]).replace(',', '.'));
  const unit = match[3].toLowerCase();
  const isMinutes = unit.startsWith('m') || unit === "'";
  return Math.round(isMinutes ? value * 60 : value);
}

/** "45 s", "1 min", "1 min 30 s". */
export function formatSeconds(totalSeconds: number, minuteShort = 'min', secondShort = 's'): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} ${secondShort}`;
  if (rest === 0) return `${minutes} ${minuteShort}`;
  return `${minutes} ${minuteShort} ${rest} ${secondShort}`;
}

/** Exercises timed in these workout rows (their effective, per-workout scheme). */
export function timedExerciseIds(rows: readonly { exercise: { id: number; scheme: string } }[]): Set<number> {
  return new Set(rows.filter((row) => isTimeScheme(row.exercise.scheme)).map((row) => row.exercise.id));
}
