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

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  deleteLoadHistoryEntries,
  getCompletedSessionDates,
  getLoadHistoryByUser,
  recordLoadHistory,
} from '../src/services/progressService';

beforeEach(() => {
  mockBackendMode = 'supabase';
  supabaseMock.reset();
  mockDb.getAllAsync.mockReset().mockResolvedValue([]);
  mockDb.runAsync.mockReset().mockResolvedValue(undefined);
});

describe('recordLoadHistory (supabase)', () => {
  it('warns (without throwing) when Supabase refuses the insert', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    supabaseMock.queue('exercise_load_history.insert', { error: { message: 'new row violates row-level security' } });
    await expect(recordLoadHistory({ userId: 5, exerciseId: 3, loadKg: 40 })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[progressService] recordLoadHistory failed:', { message: 'new row violates row-level security' });
    warn.mockRestore();
  });

  it('writes one row for that user and exercise with a timestamp', async () => {
    await recordLoadHistory({ userId: 5, exerciseId: 3, loadKg: 42.5 });
    const [insert] = supabaseMock.calls('exercise_load_history', 'insert');
    expect(insert.payload).toEqual({ user_id: 5, exercise_id: 3, load_kg: 42.5, recorded_at: expect.any(String) });
    expect(Number.isNaN(Date.parse((insert.payload as any).recorded_at))).toBe(false);
  });

  it('skips negative loads too', async () => {
    await recordLoadHistory({ userId: 5, exerciseId: 3, loadKg: -1 });
    expect(supabaseMock.queries).toHaveLength(0);
  });
});

describe('reads (supabase)', () => {
  it('history uses placeholders when the exercise join is missing, and rethrows errors', async () => {
    supabaseMock.queue('exercise_load_history.select', {
      data: [{ id: 1, exercise_id: 2, load_kg: 10, recorded_at: '2026-10-01', exercises: null }],
    });
    expect(await getLoadHistoryByUser(5)).toEqual([
      { id: 1, exercise_id: 2, exercise_name: '—', load_kg: 10, recorded_at: '2026-10-01', scheme: '' },
    ]);
    supabaseMock.queue('exercise_load_history.select', { error: { message: 'denied' } });
    await expect(getLoadHistoryByUser(5)).rejects.toEqual({ message: 'denied' });
  });

  it('completed sessions are scoped to the user, oldest first; errors propagate', async () => {
    await getCompletedSessionDates(9);
    const [query] = supabaseMock.calls('workout_sessions', 'select');
    expect(filter(query, 'eq', 'user_id')).toEqual(['eq', 'user_id', 9]);
    expect(filter(query, 'order')).toEqual(['order', 'started_at', { ascending: true }]);

    supabaseMock.queue('workout_sessions.select', { error: { message: 'down' } });
    await expect(getCompletedSessionDates(9)).rejects.toEqual({ message: 'down' });
  });

  it('a failed delete is reported (the entry is still there)', async () => {
    supabaseMock.queue('exercise_load_history.delete', { error: { message: 'denied' } });
    await expect(deleteLoadHistoryEntries([7])).rejects.toEqual({ message: 'denied' });
  });
});

describe('local mode', () => {
  beforeEach(() => {
    mockBackendMode = 'local';
  });

  it('records history in SQLite and swallows its errors', async () => {
    await recordLoadHistory({ userId: 5, exerciseId: 3, loadKg: 20 });
    expect(mockDb.runAsync.mock.calls[0].slice(1, 4)).toEqual([5, 3, 20]);

    mockDb.runAsync.mockRejectedValueOnce(new Error('disk full'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(recordLoadHistory({ userId: 5, exerciseId: 3, loadKg: 20 })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reads history and completed sessions only for that user', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([{ id: 1 }]);
    expect(await getLoadHistoryByUser(5)).toEqual([{ id: 1 }]);
    expect(mockDb.getAllAsync).toHaveBeenLastCalledWith(expect.stringContaining('WHERE h.user_id = ?'), 5);

    mockDb.getAllAsync.mockResolvedValueOnce([{ started_at: 'a' }, { started_at: 'b' }]);
    expect(await getCompletedSessionDates(5)).toEqual(['a', 'b']);
    expect(mockDb.getAllAsync).toHaveBeenLastCalledWith(expect.stringContaining('user_id = ? AND completed = 1'), 5);
  });

  it('deletes each given entry', async () => {
    await deleteLoadHistoryEntries([7, 8]);
    expect(mockDb.runAsync.mock.calls).toEqual([
      ['DELETE FROM exercise_load_history WHERE id = ?;', 7],
      ['DELETE FROM exercise_load_history WHERE id = ?;', 8],
    ]);
  });
});
