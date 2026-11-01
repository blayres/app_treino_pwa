import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
jest.mock('../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  closeStaleSessions,
  restoreActiveSessionByUser,
  startWorkoutSession,
  stopWorkoutSession,
} from '../src/services/sessionService';

const NOW = new Date('2026-11-01T12:00:00Z');

beforeEach(() => {
  supabaseMock.reset();
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterEach(() => {
  jest.useRealTimers();
});

describe('startWorkoutSession', () => {
  it('opens an unfinished session and returns it as running', async () => {
    supabaseMock.queue('workout_sessions.insert', { data: { id: 77 } });

    const session = await startWorkoutSession(5, 12);

    expect(session).toEqual({ sessionId: 77, workoutId: 12, startedAt: NOW.toISOString(), isRunning: true });
    expect(supabaseMock.calls('workout_sessions', 'insert')[0].payload).toEqual({
      user_id: 5,
      workout_id: 12,
      started_at: NOW.toISOString(),
      completed: 0,
    });
  });

  it('propagates database errors', async () => {
    supabaseMock.queue('workout_sessions.insert', { error: { message: 'boom' } });
    await expect(startWorkoutSession(5, 12)).rejects.toEqual({ message: 'boom' });
  });
});

describe('stopWorkoutSession', () => {
  const startedAt = new Date(NOW.getTime() - 45 * 60 * 1000).toISOString(); // 45 min ago

  it('finishing marks the session completed with its duration and closes other open sessions', async () => {
    const result = await stopWorkoutSession({ userId: 5, sessionId: 77, startedAt, cancelOnly: false });

    expect(result.completed).toBe(1);
    const [current, others] = supabaseMock.calls('workout_sessions', 'update');
    expect(current.payload).toEqual({ ended_at: NOW.toISOString(), duration_seconds: 2700, completed: 1 });
    expect(filter(current, 'eq', 'id')).toEqual(['eq', 'id', 77]);
    // Other sessions left open by the same user are closed as not completed.
    expect(others.payload).toEqual({ ended_at: NOW.toISOString(), duration_seconds: 0, completed: 0 });
    expect(filter(others, 'eq', 'user_id')).toEqual(['eq', 'user_id', 5]);
    expect(filter(others, 'is', 'ended_at')).toEqual(['is', 'ended_at', null]);
    expect(filter(others, 'neq', 'id')).toEqual(['neq', 'id', 77]);
  });

  it('discarding ("Descartar treino") is not counted as completed', async () => {
    const result = await stopWorkoutSession({ userId: 5, sessionId: 77, startedAt, cancelOnly: true });
    expect(result.completed).toBe(0);
    expect(supabaseMock.calls('workout_sessions', 'update')[0].payload).toMatchObject({ completed: 0 });
  });

  it('stops before closing other sessions if the first update fails', async () => {
    supabaseMock.queue('workout_sessions.update', { error: { message: 'denied' } });
    await expect(stopWorkoutSession({ userId: 5, sessionId: 77, startedAt, cancelOnly: false })).rejects.toEqual({
      message: 'denied',
    });
    expect(supabaseMock.calls('workout_sessions', 'update')).toHaveLength(1);
  });
});

describe('restoreActiveSessionByUser', () => {
  it("returns the user's latest unfinished session", async () => {
    supabaseMock.queue('workout_sessions.select', {
      data: { id: '9', workout_id: '3', started_at: '2026-11-01T11:00:00Z' },
    });

    expect(await restoreActiveSessionByUser(5)).toEqual({
      sessionId: 9,
      workoutId: 3,
      startedAt: '2026-11-01T11:00:00Z',
      isRunning: true,
    });
    const query = supabaseMock.calls('workout_sessions', 'select')[0];
    expect(filter(query, 'eq', 'user_id')).toEqual(['eq', 'user_id', 5]);
    expect(filter(query, 'is', 'ended_at')).toEqual(['is', 'ended_at', null]);
    expect(filter(query, 'order')).toEqual(['order', 'started_at', { ascending: false }]);
  });

  it('returns null when nothing is running', async () => {
    expect(await restoreActiveSessionByUser(5)).toBeNull();
  });
});

describe('closeStaleSessions', () => {
  it('closes only sessions of that user started more than 4 hours ago', async () => {
    await closeStaleSessions(5);
    const [update] = supabaseMock.calls('workout_sessions', 'update');
    const fourHoursAgo = new Date(NOW.getTime() - 4 * 60 * 60 * 1000).toISOString();
    expect(update.payload).toEqual({ ended_at: fourHoursAgo, duration_seconds: 0, completed: 0 });
    expect(filter(update, 'eq', 'user_id')).toEqual(['eq', 'user_id', 5]);
    expect(filter(update, 'lt', 'started_at')).toEqual(['lt', 'started_at', fourHoursAgo]);
  });

  it('does nothing without a user', async () => {
    await closeStaleSessions(undefined);
    expect(supabaseMock.queries).toHaveLength(0);
  });
});
