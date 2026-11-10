import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
jest.mock('../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  FORGOTTEN_SESSION_SECONDS,
  isForgottenSession,
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
    expect(result.attendanceDate).toEqual(new Date(startedAt));
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

  it('a workout finished days later is recorded and checked on the day it started', async () => {
    const startedYesterday = '2026-10-30T21:40:00Z'; // ~38h before NOW
    const result = await stopWorkoutSession({ userId: 5, sessionId: 77, startedAt: startedYesterday, cancelOnly: false });

    expect(result.completed).toBe(1);
    expect(result.attendanceDate).toEqual(new Date(startedYesterday));
    const [current, others] = supabaseMock.calls('workout_sessions', 'update');
    // Real end unknown: ended on its start (so "feito há" shows that day), no duration.
    expect(current.payload).toEqual({ ended_at: startedYesterday.replace('Z', '.000Z'), duration_seconds: null, completed: 1 });
    // Other open sessions are still closed now.
    expect(others.payload).toMatchObject({ ended_at: NOW.toISOString() });
  });

  it('a workout crossing midnight is checked on the day it started', async () => {
    jest.setSystemTime(new Date(2026, 10, 2, 0, 30)); // 00:30 local
    const startedAt = new Date(2026, 10, 1, 23, 30).toISOString(); // 23:30 the day before
    const result = await stopWorkoutSession({ userId: 5, sessionId: 77, startedAt, cancelOnly: false });
    expect(result.attendanceDate.getDate()).toBe(1);
    expect(supabaseMock.calls('workout_sessions', 'update')[0].payload).toMatchObject({ duration_seconds: 3600 });
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

describe('isForgottenSession', () => {
  it('is forgotten only after 3 hours open', () => {
    expect(FORGOTTEN_SESSION_SECONDS).toBe(3 * 60 * 60);
    const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60 * 1000).toISOString();
    expect(isForgottenSession(at(179), NOW.getTime())).toBe(false);
    expect(isForgottenSession(at(181), NOW.getTime())).toBe(true);
    expect(isForgottenSession(at(24 * 60))).toBe(true); // defaults to now
  });
});
