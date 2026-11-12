import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
jest.mock('../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  deleteLoadHistoryEntries,
  getCompletedSessionDates,
  getLoadHistoryByUser,
  recordLoadHistory,
} from '../src/services/progressService';

beforeEach(() => supabaseMock.reset());

describe('progressService', () => {
  it('reads the history oldest first with exercise names and row ids', async () => {
    supabaseMock.queue('exercise_load_history.select', {
      data: [{ id: '7', exercise_id: '3', load_kg: '43.5', recorded_at: '2026-10-01T10:00:00Z', exercises: { name: 'Abdutora', scheme: '3x15' } }],
    });

    expect(await getLoadHistoryByUser(5)).toEqual([
      { id: 7, exercise_id: 3, exercise_name: 'Abdutora', load_kg: 43.5, recorded_at: '2026-10-01T10:00:00Z', scheme: '3x15' },
    ]);
    const [query] = supabaseMock.calls('exercise_load_history', 'select');
    expect(filter(query, 'eq', 'user_id')).toEqual(['eq', 'user_id', 5]);
    expect(filter(query, 'order')).toEqual(['order', 'recorded_at', { ascending: true }]);
  });

  it('deletes all copies of a wrong entry at once, and nothing for an empty list', async () => {
    await deleteLoadHistoryEntries([7, 8]);
    expect(filter(supabaseMock.calls('exercise_load_history', 'delete')[0], 'in', 'id')).toEqual(['in', 'id', [7, 8]]);

    supabaseMock.reset();
    await deleteLoadHistoryEntries([]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('counts only completed sessions', async () => {
    supabaseMock.queue('workout_sessions.select', { data: [{ started_at: '2026-10-01T10:00:00Z' }] });
    expect(await getCompletedSessionDates(5)).toEqual(['2026-10-01T10:00:00Z']);
    expect(filter(supabaseMock.calls('workout_sessions', 'select')[0], 'eq', 'completed')).toEqual(['eq', 'completed', 1]);
  });

  it('never records zero loads and never throws (history is best-effort)', async () => {
    await recordLoadHistory({ userId: 5, exerciseId: 3, loadKg: 0 });
    expect(supabaseMock.queries).toHaveLength(0);

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    supabaseMock.queue('exercise_load_history.insert', { error: { message: 'denied' } });
    await expect(recordLoadHistory({ userId: 5, exerciseId: 3, loadKg: 40 })).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
