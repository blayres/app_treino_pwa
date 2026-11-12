import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockBackendMode: 'supabase' | 'local' = 'supabase';
jest.mock('../src/services/backendMode', () => ({
  get backendMode() {
    return mockBackendMode;
  },
  hasSupabaseConfig: true,
}));
jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
const mockDb = {
  getAllAsync: jest.fn(async (..._args: unknown[]) => [] as any[]),
  runAsync: jest.fn(async (..._args: unknown[]) => undefined as any),
};
jest.mock('../src/db', () => ({ getDb: async () => mockDb }));

import { supabaseMock } from './helpers/supabaseMock';
import {
  getAttendanceDatesByMonth,
  getCachedAttendanceMonth,
  invalidateAttendanceCache,
  markAttendance,
} from '../src/services/attendanceService';

beforeEach(() => {
  mockBackendMode = 'supabase';
  supabaseMock.reset();
  [1, 2].forEach(invalidateAttendanceCache);
  mockDb.getAllAsync.mockReset().mockResolvedValue([]);
  mockDb.runAsync.mockReset().mockResolvedValue(undefined);
});

describe('attendance cache', () => {
  it('is per user: a check-in by one user does not drop another user\'s month', async () => {
    supabaseMock.queue('attendance.select', { data: [{ date: '2026-11-03' }] }, { data: [] });
    await getAttendanceDatesByMonth({ userId: 1, year: 2026, month: 10 });
    await getAttendanceDatesByMonth({ userId: 2, year: 2026, month: 10 });

    await markAttendance(2, new Date(2026, 10, 4));
    expect(getCachedAttendanceMonth({ userId: 1, year: 2026, month: 10 })?.dates.has('2026-11-03')).toBe(true);
    expect(getCachedAttendanceMonth({ userId: 2, year: 2026, month: 10 })).toBeNull();
  });

  it('normalises the month like Date (month -1 = December of the previous year)', async () => {
    supabaseMock.queue('attendance.select', { data: [{ date: '2025-12-24' }] });
    await getAttendanceDatesByMonth({ userId: 1, year: 2026, month: -1 });
    expect(getCachedAttendanceMonth({ userId: 1, year: 2025, month: 11 })?.totalDays).toBe(31);
  });

  it('a failed check-in keeps the cached month (nothing was written)', async () => {
    await getAttendanceDatesByMonth({ userId: 1, year: 2026, month: 10 });
    supabaseMock.queue('attendance.upsert', { error: { message: 'denied' } });
    await expect(markAttendance(1, new Date(2026, 10, 4))).rejects.toEqual({ message: 'denied' });
    expect(getCachedAttendanceMonth({ userId: 1, year: 2026, month: 10 })).not.toBeNull();
  });

  it('a failed read is reported and not cached', async () => {
    supabaseMock.queue('attendance.select', { error: { message: 'down' } });
    await expect(getAttendanceDatesByMonth({ userId: 1, year: 2026, month: 10 })).rejects.toEqual({ message: 'down' });
    expect(getCachedAttendanceMonth({ userId: 1, year: 2026, month: 10 })).toBeNull();
  });
});

describe('local mode', () => {
  beforeEach(() => {
    mockBackendMode = 'local';
  });

  it('reads that user\'s check-ins between the first and last day of the month', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([{ date: '2026-02-03' }]);
    const result = await getAttendanceDatesByMonth({ userId: 1, year: 2026, month: 1 });
    expect([...result.dates]).toEqual(['2026-02-03']);
    expect(result.totalDays).toBe(28);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('user_id = ? AND date BETWEEN ? AND ?'),
      1,
      '2026-02-01',
      '2026-02-28',
    );
  });

  it('marks the local day once (INSERT OR IGNORE) and invalidates that user\'s cache', async () => {
    await getAttendanceDatesByMonth({ userId: 1, year: 2026, month: 10 });
    await markAttendance(1, new Date(2026, 10, 1, 23, 30));
    expect(mockDb.runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE'), 1, '2026-11-01');
    expect(getCachedAttendanceMonth({ userId: 1, year: 2026, month: 10 })).toBeNull();
  });
});
