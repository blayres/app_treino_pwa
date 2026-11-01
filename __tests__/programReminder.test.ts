import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
jest.mock('../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  evaluateProgramReminder,
  getProgramReminder,
  restartProgramCycle,
  snoozeProgramReminder,
} from '../src/services/programReminder';

/** n trained days in month `ym` (YYYY-MM), starting on the 1st. */
const days = (ym: string, n: number) => Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
const start = new Date(2026, 8, 1); // 1 Sep 2026, local
const now = new Date(2026, 10, 20); // 20 Nov 2026

describe('evaluateProgramReminder', () => {
  it("the user's example: 22 days, then 9 → not yet; once the 2nd month reaches 14 → due", () => {
    const notYet = evaluateProgramReminder({ trainedDates: [...days('2026-09', 22), ...days('2026-10', 9)], cycleStart: start, now });
    expect(notYet).toMatchObject({ due: false, qualifyingMonths: ['2026-09'] });

    const due = evaluateProgramReminder({ trainedDates: [...days('2026-09', 22), ...days('2026-10', 14)], cycleStart: start, now });
    expect(due).toMatchObject({ due: true, qualifyingMonths: ['2026-09', '2026-10'] });
  });

  it('28 days spread as 20 + 8 is not enough (each month needs 14)', () => {
    const result = evaluateProgramReminder({ trainedDates: [...days('2026-09', 20), ...days('2026-10', 8)], cycleStart: start, now });
    expect(result.due).toBe(false);
  });

  it('months do not need to be consecutive', () => {
    const result = evaluateProgramReminder({
      trainedDates: [...days('2026-09', 15), ...days('2026-10', 5), ...days('2026-11', 14)],
      cycleStart: start,
      now,
    });
    expect(result).toMatchObject({ due: true, qualifyingMonths: ['2026-09', '2026-11'] });
  });

  it('only counts days since the cycle started (after updating the program)', () => {
    const result = evaluateProgramReminder({
      trainedDates: [...days('2026-09', 20), ...days('2026-10', 20)],
      cycleStart: new Date(2026, 9, 10), // 10 Oct → Sep doesn't count, Oct has 11 days left
      now,
    });
    expect(result).toMatchObject({ due: false, qualifyingMonths: [], daysByMonth: { '2026-10': 11 } });
  });

  it('respects "Lembrar depois" until the snooze ends, and ignores duplicate dates', () => {
    const trainedDates = [...days('2026-09', 14), ...days('2026-10', 14), '2026-10-01'];
    expect(evaluateProgramReminder({ trainedDates, cycleStart: start, now, snoozedUntil: new Date(2026, 10, 25) }).due).toBe(false);
    expect(evaluateProgramReminder({ trainedDates, cycleStart: start, now, snoozedUntil: new Date(2026, 10, 19) }).due).toBe(true);
    expect(evaluateProgramReminder({ trainedDates, cycleStart: start, now }).daysByMonth['2026-10']).toBe(14);
  });
});

describe('reminder persistence', () => {
  beforeEach(() => supabaseMock.reset());

  it('reads the cycle from the profile and the trained days since it started', async () => {
    supabaseMock.queue('profiles.select', {
      data: { program_cycle_started_at: start.toISOString(), program_reminder_snoozed_until: null },
    });
    supabaseMock.queue('attendance.select', { data: [...days('2026-09', 14), ...days('2026-10', 14)].map((date) => ({ date })) });

    const result = await getProgramReminder(5, now);

    expect(result?.due).toBe(true);
    const [attendance] = supabaseMock.calls('attendance', 'select');
    expect(filter(attendance, 'eq', 'user_id')).toEqual(['eq', 'user_id', 5]);
    expect(filter(attendance, 'gte', 'date')).toEqual(['gte', 'date', '2026-09-01']);
  });

  it('shows nothing before the migration (missing columns)', async () => {
    supabaseMock.queue('profiles.select', { error: { code: '42703' } });
    expect(await getProgramReminder(5, now)).toBeNull();
    expect(supabaseMock.calls('attendance')).toHaveLength(0);
  });

  it('restarting the cycle clears the snooze; snoozing hides it for 7 days', async () => {
    await restartProgramCycle(5, now);
    expect(supabaseMock.calls('profiles', 'update')[0].payload).toEqual({
      program_cycle_started_at: now.toISOString(),
      program_reminder_snoozed_until: null,
    });

    await snoozeProgramReminder(5, now);
    expect(supabaseMock.calls('profiles', 'update')[1].payload).toEqual({
      program_reminder_snoozed_until: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
    });
  });
});
