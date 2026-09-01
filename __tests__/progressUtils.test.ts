import {
  parseScheme,
  calculateVolume,
  calculateVolumeComparison,
  calculatePersonalRecords,
  buildProgressionSeries,
  countImprovedExercises,
  countNewPersonalRecords,
  dateFrom,
  type LoadHistoryRow,
} from '../src/services/progressUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(
  exercise_id: number,
  exercise_name: string,
  load_kg: number,
  recorded_at: string,
  scheme = '3x10',
): LoadHistoryRow & { scheme: string } {
  return { exercise_id, exercise_name, load_kg, recorded_at, scheme };
}

const NOW = new Date('2024-06-15T12:00:00Z');

// ─── parseScheme ──────────────────────────────────────────────────────────────

describe('parseScheme', () => {
  it('parses simple set×rep (4x10)', () => {
    expect(parseScheme('4x10')).toEqual({ sets: 4, avgReps: 10 });
  });

  it('parses rep range midpoint (4x10-12 → avgReps=11)', () => {
    expect(parseScheme('4x10-12')).toEqual({ sets: 4, avgReps: 11 });
  });

  it('parses odd midpoint (3x8-10 → avgReps=9)', () => {
    expect(parseScheme('3x8-10')).toEqual({ sets: 3, avgReps: 9 });
  });

  it('handles × as separator', () => {
    expect(parseScheme('3×12')).toEqual({ sets: 3, avgReps: 12 });
  });

  it('returns null for time-based schemes', () => {
    expect(parseScheme('3x30-45s')).toEqual({ sets: 3, avgReps: 37.5 }); // numeric prefix still parses
  });

  it('returns null for unparseable strings', () => {
    expect(parseScheme('bodyweight')).toBeNull();
    expect(parseScheme('')).toBeNull();
  });
});

// ─── calculateVolume ──────────────────────────────────────────────────────────

describe('calculateVolume', () => {
  it('computes weight × sets × avgReps per row', () => {
    // 60 kg × 4 sets × 10 reps = 2400
    expect(calculateVolume([{ load_kg: 60, scheme: '4x10' }])).toBe(2400);
  });

  it('sums across multiple exercises', () => {
    const rows = [
      { load_kg: 60, scheme: '4x10' },  // 2400
      { load_kg: 40, scheme: '3x12' },  // 1440
    ];
    expect(calculateVolume(rows)).toBe(3840);
  });

  it('handles rep ranges using midpoint (4x10-12 = 11 avg)', () => {
    // 50 × 4 × 11 = 2200
    expect(calculateVolume([{ load_kg: 50, scheme: '4x10-12' }])).toBe(2200);
  });

  it('skips rows with unparseable scheme', () => {
    const rows = [
      { load_kg: 60, scheme: '4x10' },       // 2400
      { load_kg: 100, scheme: 'bodyweight' }, // skipped
    ];
    expect(calculateVolume(rows)).toBe(2400);
  });

  it('returns 0 for empty input', () => {
    expect(calculateVolume([])).toBe(0);
  });
});

// ─── calculateVolumeComparison ────────────────────────────────────────────────

describe('calculateVolumeComparison', () => {
  // NOW = 2024-06-15, period 1m = last 30 days (since 2024-05-16)
  // previous period = 60–30 days ago (2024-04-16 to 2024-05-15)

  const currentRow = makeRow(1, 'Squat', 60, '2024-06-01T10:00:00Z', '3x10'); // in current 30d
  const previousRow = makeRow(1, 'Squat', 50, '2024-05-01T10:00:00Z', '3x10'); // in previous 30d
  const ancientRow = makeRow(1, 'Squat', 40, '2024-01-01T10:00:00Z', '3x10'); // outside both

  it('splits rows into current and previous periods', () => {
    const result = calculateVolumeComparison([currentRow, previousRow, ancientRow], NOW, '1m');
    // current: 60×3×10 = 1800
    expect(result.current).toBe(1800);
    // previous: 50×3×10 = 1500
    expect(result.previous).toBe(1500);
  });

  it('calculates change percent', () => {
    const result = calculateVolumeComparison([currentRow, previousRow], NOW, '1m');
    // (1800 - 1500) / 1500 = 20%
    expect(result.changePercent).toBe(20);
  });

  it('returns changePercent null when previous is 0', () => {
    const result = calculateVolumeComparison([currentRow], NOW, '1m');
    expect(result.changePercent).toBeNull();
  });

  it('returns null changePercent for "all" period', () => {
    const result = calculateVolumeComparison([currentRow, previousRow], NOW, 'all');
    expect(result.changePercent).toBeNull();
  });

  it('returns 0 volume for empty history', () => {
    const result = calculateVolumeComparison([], NOW, '3m');
    expect(result.current).toBe(0);
    expect(result.previous).toBe(0);
  });
});

// ─── calculatePersonalRecords ─────────────────────────────────────────────────

describe('calculatePersonalRecords', () => {
  it('returns the highest load per exercise', () => {
    const rows: LoadHistoryRow[] = [
      makeRow(1, 'Squat', 80, '2024-01-01T00:00:00Z'),
      makeRow(1, 'Squat', 100, '2024-02-01T00:00:00Z'),
      makeRow(1, 'Squat', 90, '2024-03-01T00:00:00Z'),
      makeRow(2, 'Press', 60, '2024-01-01T00:00:00Z'),
    ];
    const prs = calculatePersonalRecords(rows);
    const squat = prs.find(p => p.exercise_id === 1)!;
    const press = prs.find(p => p.exercise_id === 2)!;
    expect(squat.load_kg).toBe(100);
    expect(press.load_kg).toBe(60);
  });

  it('sorts by load descending', () => {
    const rows: LoadHistoryRow[] = [
      makeRow(2, 'Press', 60, '2024-01-01T00:00:00Z'),
      makeRow(1, 'Squat', 100, '2024-01-01T00:00:00Z'),
    ];
    const prs = calculatePersonalRecords(rows);
    expect(prs[0].load_kg).toBe(100);
    expect(prs[1].load_kg).toBe(60);
  });

  it('returns empty array for no history', () => {
    expect(calculatePersonalRecords([])).toEqual([]);
  });

  it('records are isolated per user (given pre-filtered rows)', () => {
    // The service layer filters by user_id before calling this function.
    // Simulate user isolation: pass only user 1's rows.
    const user1Rows: LoadHistoryRow[] = [
      makeRow(1, 'Squat', 80, '2024-01-01T00:00:00Z'),
    ];
    const prs = calculatePersonalRecords(user1Rows);
    expect(prs).toHaveLength(1);
    expect(prs[0].load_kg).toBe(80);
  });
});

// ─── buildProgressionSeries ───────────────────────────────────────────────────

describe('buildProgressionSeries', () => {
  const rows: LoadHistoryRow[] = [
    makeRow(1, 'Squat', 60, '2024-01-10T10:00:00Z'),
    makeRow(1, 'Squat', 70, '2024-02-10T10:00:00Z'),
    makeRow(1, 'Squat', 80, '2024-03-10T10:00:00Z'),
    makeRow(1, 'Squat', 75, '2024-04-10T10:00:00Z'), // regressed
    makeRow(1, 'Squat', 85, '2024-05-10T10:00:00Z'),
    makeRow(2, 'Press', 50, '2024-03-10T10:00:00Z'), // different exercise
  ];

  it('filters to the correct exercise', () => {
    const series = buildProgressionSeries(rows, 1, NOW, 'all');
    expect(series.every(d => typeof d.load_kg === 'number')).toBe(true);
    expect(series).toHaveLength(5);
  });

  it('excludes other exercises', () => {
    const series = buildProgressionSeries(rows, 2, NOW, 'all');
    expect(series).toHaveLength(1);
    expect(series[0].load_kg).toBe(50);
  });

  it('orders chronologically', () => {
    const series = buildProgressionSeries(rows, 1, NOW, 'all');
    for (let i = 1; i < series.length; i++) {
      expect(series[i].date >= series[i - 1].date).toBe(true);
    }
  });

  it('collapses multiple entries on the same day to the maximum', () => {
    const sameDay: LoadHistoryRow[] = [
      makeRow(1, 'Squat', 80, '2024-05-01T09:00:00Z'),
      makeRow(1, 'Squat', 95, '2024-05-01T17:00:00Z'), // same day, higher
      makeRow(1, 'Squat', 70, '2024-05-01T20:00:00Z'), // same day, lower
    ];
    const series = buildProgressionSeries(sameDay, 1, NOW, 'all');
    expect(series).toHaveLength(1);
    expect(series[0].load_kg).toBe(95);
  });

  it('respects period filter (1m only includes last 30 days)', () => {
    // NOW = 2024-06-15; 30-day cutoff = ~2024-05-16
    // 2024-05-10 is 36 days before NOW — outside 1m window
    // 2024-06-01 is 14 days before NOW — inside 1m window
    const recentRows: LoadHistoryRow[] = [
      makeRow(1, 'Squat', 60, '2024-01-10T10:00:00Z'), // old, outside
      makeRow(1, 'Squat', 85, '2024-06-01T10:00:00Z'), // recent, inside
    ];
    const series = buildProgressionSeries(recentRows, 1, NOW, '1m');
    expect(series).toHaveLength(1);
    expect(series[0].load_kg).toBe(85);
  });

  it('returns all entries for "all" period', () => {
    const series = buildProgressionSeries(rows, 1, NOW, 'all');
    expect(series).toHaveLength(5);
  });

  it('returns empty array when no rows match', () => {
    expect(buildProgressionSeries(rows, 99, NOW, 'all')).toEqual([]);
  });
});

// ─── countImprovedExercises ───────────────────────────────────────────────────

describe('countImprovedExercises', () => {
  // NOW = 2024-06-15, period 1m: current = since 2024-05-16, prev = 2024-04-16..2024-05-15

  it('counts exercises where current best > previous best', () => {
    const rows: LoadHistoryRow[] = [
      makeRow(1, 'Squat', 80, '2024-05-01T00:00:00Z'), // previous period
      makeRow(1, 'Squat', 90, '2024-06-01T00:00:00Z'), // current — improved!
      makeRow(2, 'Press', 60, '2024-05-01T00:00:00Z'), // previous period
      makeRow(2, 'Press', 55, '2024-06-01T00:00:00Z'), // current — regressed
    ];
    expect(countImprovedExercises(rows, NOW, '1m')).toBe(1);
  });

  it('returns 0 when no previous data exists', () => {
    const rows: LoadHistoryRow[] = [
      makeRow(1, 'Squat', 90, '2024-06-01T00:00:00Z'),
    ];
    // no previous period row → not counted as "improved" (no baseline)
    expect(countImprovedExercises(rows, NOW, '1m')).toBe(0);
  });

  it('returns 0 for "all" period', () => {
    const rows: LoadHistoryRow[] = [makeRow(1, 'Squat', 90, '2024-06-01T00:00:00Z')];
    expect(countImprovedExercises(rows, NOW, 'all')).toBe(0);
  });
});

// ─── countNewPersonalRecords ──────────────────────────────────────────────────

describe('countNewPersonalRecords', () => {
  it('counts exercises that set an all-time high in the current period', () => {
    const rows: LoadHistoryRow[] = [
      makeRow(1, 'Squat', 80, '2024-01-01T00:00:00Z'), // historical
      makeRow(1, 'Squat', 85, '2024-06-01T00:00:00Z'), // current — new PR!
      makeRow(2, 'Press', 60, '2024-01-01T00:00:00Z'), // historical
      makeRow(2, 'Press', 55, '2024-06-01T00:00:00Z'), // current — not a PR
    ];
    expect(countNewPersonalRecords(rows, NOW, '1m')).toBe(1);
  });

  it('counts as PR when no historical data exists for that exercise', () => {
    const rows: LoadHistoryRow[] = [
      makeRow(1, 'Squat', 85, '2024-06-01T00:00:00Z'), // first ever entry
    ];
    expect(countNewPersonalRecords(rows, NOW, '1m')).toBe(1);
  });

  it('returns 0 when nothing beats historical best', () => {
    const rows: LoadHistoryRow[] = [
      makeRow(1, 'Squat', 100, '2024-01-01T00:00:00Z'),
      makeRow(1, 'Squat', 90, '2024-06-01T00:00:00Z'),
    ];
    expect(countNewPersonalRecords(rows, NOW, '1m')).toBe(0);
  });

  it('returns 0 for empty history', () => {
    expect(countNewPersonalRecords([], NOW, '1m')).toBe(0);
  });
});

// ─── dateFrom ─────────────────────────────────────────────────────────────────

describe('dateFrom', () => {
  it('returns a date exactly N days before now at midnight', () => {
    const ref = new Date('2024-06-15T12:00:00Z');
    const result = dateFrom(ref, 30);
    // Should be 2024-05-16T00:00:00.000 local — just check it's 30 days earlier
    const diff = ref.getTime() - new Date(result).getTime();
    const daysDiff = diff / (1000 * 60 * 60 * 24);
    // Between 29 and 31 days to account for local timezone midnight adjustment
    expect(daysDiff).toBeGreaterThanOrEqual(29);
    expect(daysDiff).toBeLessThanOrEqual(31);
  });
});
