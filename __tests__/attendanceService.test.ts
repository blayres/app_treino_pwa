import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
jest.mock('../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  getAttendanceDatesByMonth,
  invalidateAttendanceCache,
  markAttendance,
} from '../src/services/attendanceService';

beforeEach(() => {
  supabaseMock.reset();
  invalidateAttendanceCache(1);
});

describe('markAttendance', () => {
  it('records the local calendar day once per user (upsert on user_id,date)', async () => {
    await markAttendance(1, new Date(2026, 10, 1, 23, 30)); // 1 Nov, 23:30 local

    const [upsert] = supabaseMock.calls('attendance', 'upsert');
    expect(upsert.payload).toEqual({ user_id: 1, date: '2026-11-01' });
    expect(upsert.options).toEqual({ onConflict: 'user_id,date' });
  });

  it('throws when the database refuses', async () => {
    supabaseMock.queue('attendance.upsert', { error: { message: 'denied' } });
    await expect(markAttendance(1, new Date(2026, 10, 1))).rejects.toEqual({ message: 'denied' });
  });
});

describe('getAttendanceDatesByMonth', () => {
  it('queries the whole month and returns the days of that month', async () => {
    supabaseMock.queue('attendance.select', { data: [{ date: '2026-02-03' }, { date: '2026-02-10' }] });

    const result = await getAttendanceDatesByMonth({ userId: 1, year: 2026, month: 1 }); // February

    expect([...result.dates]).toEqual(['2026-02-03', '2026-02-10']);
    expect(result.totalDays).toBe(28);
    const [query] = supabaseMock.calls('attendance', 'select');
    expect(filter(query, 'eq', 'user_id')).toEqual(['eq', 'user_id', 1]);
    expect(filter(query, 'gte', 'date')).toEqual(['gte', 'date', '2026-02-01']);
    expect(filter(query, 'lte', 'date')).toEqual(['lte', 'date', '2026-02-28']);
  });

  it('normalises full timestamps to local calendar days', async () => {
    const localNoon = new Date(2026, 2, 15, 12, 0).toISOString();
    supabaseMock.queue('attendance.select', { data: [{ date: localNoon }] });
    const result = await getAttendanceDatesByMonth({ userId: 1, year: 2026, month: 2 });
    expect([...result.dates]).toEqual(['2026-03-15']);
  });

  it('serves repeat reads from cache until a new check-in is marked', async () => {
    supabaseMock.queue('attendance.select', { data: [] }, { data: [{ date: '2026-11-01' }] });
    const args = { userId: 1, year: 2026, month: 10 };

    await getAttendanceDatesByMonth(args);
    await getAttendanceDatesByMonth(args);
    expect(supabaseMock.calls('attendance', 'select')).toHaveLength(1);

    await markAttendance(1, new Date(2026, 10, 1));
    const after = await getAttendanceDatesByMonth(args);
    expect(supabaseMock.calls('attendance', 'select')).toHaveLength(2);
    expect(after.dates.has('2026-11-01')).toBe(true);
  });
});
