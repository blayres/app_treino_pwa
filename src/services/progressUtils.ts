/**
 * progressUtils.ts
 *
 * Pure, side-effect-free functions for the progress page (tested in
 * __tests__/progressUtils.test.ts).
 */

export type LoadHistoryRow = {
  /** Row id in exercise_load_history (absent in older callers/tests). */
  id?: number;
  exercise_id: number;
  exercise_name: string;
  load_kg: number;
  recorded_at: string; // ISO timestamp
};

export type ProgressDataPoint = {
  date: string;   // YYYY-MM-DD
  load_kg: number;
};

// ── Period helpers ────────────────────────────────────────────────────────────

export type PeriodKey = '1m' | '3m' | '6m' | 'all';

export function periodToDays(period: PeriodKey): number | null {
  if (period === '1m') return 30;
  if (period === '3m') return 90;
  if (period === '6m') return 180;
  return null; // 'all'
}

/** Returns start-of-day ISO for `daysAgo` days before `now`. */
export function dateFrom(now: Date, daysAgo: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ── Progress page (per-exercise evolution + period summary) ─────────────────

export type ExerciseProgress = {
  exercise_id: number;
  exercise_name: string;
  /** Best load per training day inside the period, oldest first. */
  points: ProgressDataPoint[];
  /**
   * Table view: one row per training day (newest first) with that day's load —
   * the value the chart uses. `ids` are the history rows holding that value, so
   * deleting a wrong entry (e.g. 435 instead of 43,5) removes all its copies.
   * Lower same-day values (keystrokes saved by older app versions) are hidden.
   */
  entries: { date: string; load_kg: number; ids: number[] }[];
  /** Load at the start: last training day before the period, else the first in it. */
  start: number;
  /** Load on the most recent training day. */
  current: number;
  /** All-time best and when it happened. */
  best: number;
  bestDate: string;
  change: number;
  /** null when start is 0. */
  changePercent: number | null;
  /** The period beat everything recorded before it (needs earlier history). */
  isNewRecord: boolean;
  lastDate: string;
};

function bestPerDay(rows: LoadHistoryRow[]): ProgressDataPoint[] {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const day = row.recorded_at.slice(0, 10);
    const existing = byDay.get(day);
    if (existing === undefined || row.load_kg > existing) byDay.set(day, row.load_kg);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, load_kg]) => ({ date, load_kg }));
}

/**
 * One entry per exercise trained in the period, sorted by biggest relative
 * gain first (then name). Values are rounded to 0.1 kg.
 */
export function buildExerciseProgress(
  rows: LoadHistoryRow[],
  now: Date,
  period: PeriodKey,
): ExerciseProgress[] {
  const days = periodToDays(period);
  const cutoff = days ? dateFrom(now, days) : null;
  const round = (v: number) => Math.round(v * 10) / 10;

  const byExercise = new Map<number, LoadHistoryRow[]>();
  for (const row of rows) {
    const list = byExercise.get(row.exercise_id) ?? [];
    list.push(row);
    byExercise.set(row.exercise_id, list);
  }

  const result: ExerciseProgress[] = [];
  for (const [exerciseId, exerciseRows] of byExercise) {
    const inPeriod = exerciseRows.filter((r) => cutoff === null || r.recorded_at >= cutoff);
    if (inPeriod.length === 0) continue;
    const before = cutoff === null ? [] : exerciseRows.filter((r) => r.recorded_at < cutoff);

    const points = bestPerDay(inPeriod);
    const previousDays = bestPerDay(before);
    const start = previousDays.length > 0 ? previousDays[previousDays.length - 1].load_kg : points[0].load_kg;
    const current = points[points.length - 1].load_kg;

    let best = -Infinity;
    let bestDate = '';
    for (const r of exerciseRows) {
      if (r.load_kg > best) {
        best = r.load_kg;
        bestDate = r.recorded_at.slice(0, 10);
      }
    }
    const bestBefore = before.reduce((max, r) => Math.max(max, r.load_kg), -Infinity);
    const bestInPeriod = points.reduce((max, p) => Math.max(max, p.load_kg), -Infinity);

    result.push({
      exercise_id: exerciseId,
      exercise_name: exerciseRows[exerciseRows.length - 1].exercise_name,
      points,
      entries: [...points].reverse().map((p) => ({
        date: p.date,
        load_kg: p.load_kg,
        ids: inPeriod
          .filter((r) => r.recorded_at.slice(0, 10) === p.date && r.load_kg === p.load_kg && r.id != null)
          .map((r) => r.id!),
      })),
      start,
      current,
      best,
      bestDate,
      change: round(current - start),
      changePercent: start > 0 ? Math.round(((current - start) / start) * 100) : null,
      isNewRecord: before.length > 0 && bestInPeriod > bestBefore,
      lastDate: points[points.length - 1].date,
    });
  }

  return result.sort(
    (a, b) =>
      (b.changePercent ?? 0) - (a.changePercent ?? 0) || a.exercise_name.localeCompare(b.exercise_name),
  );
}

export type ProgressSummary = {
  sessions: number;
  /** Sessions in the previous equivalent period; null for 'all'. */
  previousSessions: number | null;
  improved: number;
  trained: number;
  records: number;
};

export function summarizeProgress(
  progress: ExerciseProgress[],
  sessionDates: string[],
  now: Date,
  period: PeriodKey,
): ProgressSummary {
  const days = periodToDays(period);
  const currentStart = days ? dateFrom(now, days) : null;
  const previousStart = days ? dateFrom(now, days * 2) : null;
  const sessions = sessionDates.filter((d) => currentStart === null || d >= currentStart).length;
  const previousSessions =
    currentStart && previousStart
      ? sessionDates.filter((d) => d >= previousStart && d < currentStart).length
      : null;
  return {
    sessions,
    previousSessions,
    improved: progress.filter((p) => p.change > 0).length,
    trained: progress.length,
    records: progress.filter((p) => p.isNewRecord).length,
  };
}

/** "Nice" axis ticks (1, 2, 2.5, 5 × 10ⁿ) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    min -= pad;
    max += pad;
  }
  const rawStep = (max - min) / Math.max(1, count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? rawStep;
  const first = Math.floor(min / step) * step;
  const last = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= last + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}
