import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockBackendMode: 'supabase' | 'local' = 'supabase';
jest.mock('../src/services/backendMode', () => ({
  get backendMode() {
    return mockBackendMode;
  },
  hasSupabaseConfig: true,
}));
jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
const mockDb = {
  getFirstAsync: jest.fn(async (..._args: unknown[]) => null as any),
  runAsync: jest.fn(async (..._args: unknown[]) => ({ lastInsertRowId: 77 }) as any),
};
jest.mock('../src/db', () => ({ getDb: async () => mockDb }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  restoreActiveSessionByUser,
  startWorkoutSession,
  stopWorkoutSession,
} from '../src/services/sessionService';

const NOW = new Date('2026-11-12T12:00:00.000Z');

beforeEach(() => {
  mockBackendMode = 'supabase';
  supabaseMock.reset();
  mockDb.getFirstAsync.mockReset().mockResolvedValue(null);
  mockDb.runAsync.mockReset().mockResolvedValue({ lastInsertRowId: 77 });
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('supabase errors', () => {
  it('restoring rethrows a failed read', async () => {
    supabaseMock.queue('workout_sessions.select', { error: { message: 'down' } });
    await expect(restoreActiveSessionByUser(3)).rejects.toEqual({ message: 'down' });
  });

  it('closing the other open sessions touches only this user\'s open rows, and its error is reported', async () => {
    supabaseMock.queue('workout_sessions.update', {}, { error: { message: 'denied' } });
    await expect(
      stopWorkoutSession({ userId: 3, sessionId: 10, startedAt: '2026-11-12T11:00:00.000Z', cancelOnly: false }),
    ).rejects.toEqual({ message: 'denied' });

    const [, closeOthers] = supabaseMock.calls('workout_sessions', 'update');
    expect(filter(closeOthers, 'eq', 'user_id')).toEqual(['eq', 'user_id', 3]);
    expect(filter(closeOthers, 'is', 'ended_at')).toEqual(['is', 'ended_at', null]);
    expect(filter(closeOthers, 'neq', 'id')).toEqual(['neq', 'id', 10]);
    expect(closeOthers.payload).toEqual({ ended_at: NOW.toISOString(), duration_seconds: 0, completed: 0 });
  });
});

describe('local mode', () => {
  beforeEach(() => {
    mockBackendMode = 'local';
  });

  it('restores only that user\'s open session', async () => {
    expect(await restoreActiveSessionByUser(3)).toBeNull();
    mockDb.getFirstAsync.mockResolvedValueOnce({ id: 5, workout_id: 2, started_at: 's' });
    expect(await restoreActiveSessionByUser(3)).toEqual({ sessionId: 5, workoutId: 2, startedAt: 's', isRunning: true });
    expect(mockDb.getFirstAsync).toHaveBeenLastCalledWith(expect.stringContaining('ended_at IS NULL AND user_id = ?'), 3);
  });

  it('starts an unfinished session for that user', async () => {
    expect(await startWorkoutSession(3, 2)).toEqual({
      sessionId: 77,
      workoutId: 2,
      startedAt: NOW.toISOString(),
      isRunning: true,
    });
    expect(mockDb.runAsync.mock.calls[0].slice(1)).toEqual([3, 2, NOW.toISOString()]);
  });

  it('stops the session with its duration and closes the user\'s other open sessions', async () => {
    const result = await stopWorkoutSession({
      userId: 3,
      sessionId: 10,
      startedAt: '2026-11-12T11:30:00.000Z',
      cancelOnly: false,
    });
    expect(result.completed).toBe(1);
    const [current, others] = mockDb.runAsync.mock.calls;
    expect(current.slice(1)).toEqual([NOW.toISOString(), 1800, 1, 10]);
    expect(others.slice(1)).toEqual([NOW.toISOString(), 3, 10]);
  });

  it('a forgotten session is recorded on its start day, without duration; discarding is not completed', async () => {
    const startedAt = '2026-11-10T08:00:00.000Z';
    const result = await stopWorkoutSession({ userId: 3, sessionId: 10, startedAt, cancelOnly: true });
    expect(result).toEqual({ completed: 0, attendanceDate: new Date(startedAt) });
    expect(mockDb.runAsync.mock.calls[0].slice(1)).toEqual([startedAt, null, 0, 10]);
  });
});
