/**
 * progressUtils.ts
 *
 * Pure, side-effect-free functions for progress calculations.
 * These are the source of truth tested by unit tests.
 */

export type LoadHistoryRow = {
  exercise_id: number;
  exercise_name: string;
  load_kg: number;
  recorded_at: string; // ISO timestamp
};

export type ProgressDataPoint = {
  date: string;   // YYYY-MM-DD
  load_kg: number;
};

export type PersonalRecord = {
  exercise_id: number;
  exercise_name: string;
  load_kg: number;
  recorded_at: string;
};

export type VolumeResult = {
  /** Total kg·reps in the period */
  current: number;
  /** Total kg·reps in the previous equivalent period */
  previous: number;
  /** Percentage change. null when previous === 0. */
  changePercent: number | null;
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

// ── Scheme parser ─────────────────────────────────────────────────────────────

/**
 * Parses a scheme string such as "4x10-12" or "3x15" or "3x30-45s".
 * Returns { sets, avgReps } where avgReps is the midpoint of the rep range.
 * Returns null for strings that cannot be parsed (time-based, bodyweight, etc.).
 */
export function parseScheme(scheme: string): { sets: number; avgReps: number } | null {
  const match = scheme.match(/^(\d+)\s*[xX×]\s*(\d+)(?:\s*[-–]\s*(\d+))?/);
  if (!match) return null;

  const sets = parseInt(match[1], 10);
  const repsLow = parseInt(match[2], 10);
  const repsHigh = match[3] ? parseInt(match[3], 10) : repsLow;

  if (Number.isNaN(sets) || Number.isNaN(repsLow)) return null;

  return { sets, avgReps: (repsLow + repsHigh) / 2 };
}

// ── Volume calculation ────────────────────────────────────────────────────────

/**
 * Calculates total volume (kg × reps) for a list of load rows.
 * Each row's volume = load_kg × sets × avgReps derived from exercise scheme.
 * Rows without a parseable scheme are skipped.
 */
export function calculateVolume(
  rows: { load_kg: number; scheme: string }[],
): number {
  let total = 0;
  for (const row of rows) {
    const parsed = parseScheme(row.scheme);
    if (!parsed) continue;
    total += row.load_kg * parsed.sets * parsed.avgReps;
  }
  return total;
}

/**
 * Calculates current and previous period volume and the % change.
 *
 * @param allRows All history rows for a user (exercise_id, load_kg, recorded_at, scheme).
 * @param now     The reference "now" timestamp (injectable for testing).
 * @param period  Period key.
 */
export function calculateVolumeComparison(
  allRows: { exercise_id: number; load_kg: number; recorded_at: string; scheme: string }[],
  now: Date,
  period: PeriodKey,
): VolumeResult {
  const days = periodToDays(period);

  if (!days) {
    // 'all' — return sum with no comparison
    const current = calculateVolume(allRows);
    return { current, previous: 0, changePercent: null };
  }

  const currentStart = dateFrom(now, days);
  const previousStart = dateFrom(now, days * 2);

  const currentRows = allRows.filter(r => r.recorded_at >= currentStart);
  const previousRows = allRows.filter(
    r => r.recorded_at >= previousStart && r.recorded_at < currentStart,
  );

  const current = calculateVolume(currentRows);
  const previous = calculateVolume(previousRows);
  const changePercent =
    previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

  return { current, previous, changePercent };
}

// ── Personal records ──────────────────────────────────────────────────────────

/**
 * Returns the all-time best load per exercise, derived entirely from
 * exercise_load_history rows. Sorted by load_kg descending.
 */
export function calculatePersonalRecords(rows: LoadHistoryRow[]): PersonalRecord[] {
  const best = new Map<
    number,
    { exercise_name: string; load_kg: number; recorded_at: string }
  >();

  for (const row of rows) {
    const current = best.get(row.exercise_id);
    if (!current || row.load_kg > current.load_kg) {
      best.set(row.exercise_id, {
        exercise_name: row.exercise_name,
        load_kg: row.load_kg,
        recorded_at: row.recorded_at,
      });
    }
  }

  return Array.from(best.entries())
    .map(([exercise_id, v]) => ({ exercise_id, ...v }))
    .sort((a, b) => b.load_kg - a.load_kg);
}

// ── Exercise progression ──────────────────────────────────────────────────────

/**
 * Returns the best (highest) load per workout-day for a given exercise,
 * ordered chronologically. Filters by period and collapses multiple entries
 * on the same calendar day to the maximum.
 *
 * @param rows       History rows for the target exercise, any order.
 * @param exerciseId The exercise to filter.
 * @param now        Reference "now" (injectable for testing).
 * @param period     Period key.
 */
export function buildProgressionSeries(
  rows: LoadHistoryRow[],
  exerciseId: number,
  now: Date,
  period: PeriodKey,
): ProgressDataPoint[] {
  const days = periodToDays(period);
  const cutoff = days ? dateFrom(now, days) : null;

  const filtered = rows.filter(
    r => r.exercise_id === exerciseId && (cutoff === null || r.recorded_at >= cutoff),
  );

  // Collapse to best per calendar day
  const byDay = new Map<string, number>();
  for (const row of filtered) {
    const day = row.recorded_at.slice(0, 10);
    const existing = byDay.get(day);
    if (existing === undefined || row.load_kg > existing) {
      byDay.set(day, row.load_kg);
    }
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, load_kg]) => ({ date, load_kg }));
}

// ── Improvement count ─────────────────────────────────────────────────────────

/**
 * Counts exercises that have improved (higher max load) in the current period
 * vs the previous equivalent period.
 */
export function countImprovedExercises(
  rows: LoadHistoryRow[],
  now: Date,
  period: PeriodKey,
): number {
  const days = periodToDays(period);
  if (!days) return 0;

  const currentStart = dateFrom(now, days);
  const previousStart = dateFrom(now, days * 2);

  const currentBest = new Map<number, number>();
  const previousBest = new Map<number, number>();

  for (const row of rows) {
    if (row.recorded_at >= currentStart) {
      const prev = currentBest.get(row.exercise_id) ?? -Infinity;
      if (row.load_kg > prev) currentBest.set(row.exercise_id, row.load_kg);
    } else if (row.recorded_at >= previousStart) {
      const prev = previousBest.get(row.exercise_id) ?? -Infinity;
      if (row.load_kg > prev) previousBest.set(row.exercise_id, row.load_kg);
    }
  }

  let improved = 0;
  for (const [id, curLoad] of currentBest.entries()) {
    const prevLoad = previousBest.get(id);
    if (prevLoad !== undefined && curLoad > prevLoad) improved++;
  }
  return improved;
}

/**
 * Counts exercises that hit a new all-time high within the current period.
 */
export function countNewPersonalRecords(
  rows: LoadHistoryRow[],
  now: Date,
  period: PeriodKey,
): number {
  const days = periodToDays(period);
  if (!days) return 0;

  const currentStart = dateFrom(now, days);

  // All-time best BEFORE the current period
  const historicalBest = new Map<number, number>();
  for (const row of rows) {
    if (row.recorded_at < currentStart) {
      const prev = historicalBest.get(row.exercise_id) ?? -Infinity;
      if (row.load_kg > prev) historicalBest.set(row.exercise_id, row.load_kg);
    }
  }

  // Best in current period
  const currentBest = new Map<number, number>();
  for (const row of rows) {
    if (row.recorded_at >= currentStart) {
      const prev = currentBest.get(row.exercise_id) ?? -Infinity;
      if (row.load_kg > prev) currentBest.set(row.exercise_id, row.load_kg);
    }
  }

  let newPRs = 0;
  for (const [id, curLoad] of currentBest.entries()) {
    const historical = historicalBest.get(id);
    // New PR if no prior history or beat the historical best
    if (historical === undefined || curLoad > historical) newPRs++;
  }
  return newPRs;
}
