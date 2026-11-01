import {
  buildExerciseProgress,
  dateFrom,
  niceTicks,
  periodToDays,
  summarizeProgress,
} from '../src/services/progressUtils';

describe('periodToDays', () => {
  it('maps periods to days (all = no limit)', () => {
    expect(['1m', '3m', '6m', 'all'].map((p) => periodToDays(p as any))).toEqual([30, 90, 180, null]);
  });
});

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


describe('buildExerciseProgress', () => {
  const NOW = new Date('2026-11-01T12:00:00Z');
  const row = (exercise_id: number, name: string, load_kg: number, date: string, id?: number) => ({
    id,
    exercise_id,
    exercise_name: name,
    load_kg,
    recorded_at: `${date}T10:00:00Z`,
  });
  const rows = [
    row(1, 'Leg press', 100, '2026-06-01'), // before the 3-month window
    row(1, 'Leg press', 110, '2026-09-10', 1),
    row(1, 'Leg press', 108, '2026-09-10', 2), // same day → best (110) kept
    row(1, 'Leg press', 120, '2026-10-20', 3),
    row(2, 'Remada', 40, '2026-09-15', 4),
    row(2, 'Remada', 38, '2026-10-25', 5),
    row(3, 'Antigo', 50, '2026-01-01'), // not trained in the period
  ];

  it('uses the last load before the period as the start and flags new records', () => {
    const [leg, remada] = buildExerciseProgress(rows, NOW, '3m');
    expect(leg).toMatchObject({
      exercise_name: 'Leg press',
      start: 100,
      current: 120,
      best: 120,
      bestDate: '2026-10-20',
      change: 20,
      changePercent: 20,
      isNewRecord: true,
      lastDate: '2026-10-20',
    });
    expect(leg.points).toEqual([
      { date: '2026-09-10', load_kg: 110 },
      { date: '2026-10-20', load_kg: 120 },
    ]);
    expect(leg.entries).toEqual([
      { date: '2026-10-20', load_kg: 120, ids: [3] },
      { date: '2026-09-10', load_kg: 110, ids: [1] }, // the lower 108 of that day is hidden
    ]);
    // no history before the period → start = first point, never a "new record"
    expect(remada).toMatchObject({ start: 40, current: 38, change: -2, changePercent: -5, isNewRecord: false });
  });

  it('skips exercises not trained in the period and sorts by relative gain', () => {
    const list = buildExerciseProgress(rows, NOW, '3m');
    expect(list.map((p) => p.exercise_name)).toEqual(['Leg press', 'Remada']);
    expect(buildExerciseProgress(rows, NOW, 'all').map((p) => p.exercise_name)).toContain('Antigo');
  });

  it('summarises sessions vs the previous period, improved exercises and records', () => {
    const progress = buildExerciseProgress(rows, NOW, '1m');
    const sessions = ['2026-08-20T10:00:00Z', '2026-09-20T10:00:00Z', '2026-10-05T10:00:00Z', '2026-10-20T10:00:00Z', '2026-10-25T10:00:00Z'];
    expect(summarizeProgress(progress, sessions, NOW, '1m')).toEqual({
      sessions: 3,
      previousSessions: 1,
      improved: 1,
      trained: 2,
      records: 1,
    });
  });
});

describe('niceTicks', () => {
  it('returns round ticks covering the range', () => {
    expect(niceTicks(36.6, 52)).toEqual([30, 40, 50, 60]);
    expect(niceTicks(20, 27.5)).toEqual([20, 22.5, 25, 27.5]);
    expect(niceTicks(40, 40)[0]).toBeLessThan(40);
  });
});
