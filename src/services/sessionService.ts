import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import type { ActiveSession } from './types';

async function getLocalDb() {
  const { getDb } = await import('../db');
  return getDb();
}

export async function restoreActiveSessionByUser(userId: number): Promise<ActiveSession | null> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id, workout_id, started_at')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      sessionId: Number(data.id),
      workoutId: Number(data.workout_id),
      startedAt: String(data.started_at),
      isRunning: true,
    };
  }

  const db = await getLocalDb();
  const session = await db.getFirstAsync<{
    id: number;
    workout_id: number;
    started_at: string;
  }>(
    `SELECT * FROM workout_sessions
      WHERE ended_at IS NULL AND user_id = ?
      ORDER BY started_at DESC
      LIMIT 1;`,
    userId,
  );

  if (!session) return null;
  return {
    sessionId: session.id,
    workoutId: session.workout_id,
    startedAt: session.started_at,
    isRunning: true,
  };
}

/**
 * A session still open after this long was almost certainly forgotten: the app
 * asks the user to finish it, and the check goes to the day it started.
 */
export const FORGOTTEN_SESSION_SECONDS = 3 * 60 * 60;

export function isForgottenSession(startedAt: string, now: number = Date.now()): boolean {
  return (now - new Date(startedAt).getTime()) / 1000 > FORGOTTEN_SESSION_SECONDS;
}

export async function startWorkoutSession(userId: number, workoutId: number): Promise<ActiveSession> {
  const startedAt = new Date().toISOString();

  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        workout_id: workoutId,
        started_at: startedAt,
        completed: 0,
      })
      .select('id')
      .single();
    if (error) throw error;
    return {
      sessionId: Number(data.id),
      workoutId,
      startedAt,
      isRunning: true,
    };
  }

  const db = await getLocalDb();
  const result = await db.runAsync(
    `INSERT INTO workout_sessions (user_id, workout_id, started_at, completed)
     VALUES (?, ?, ?, 0);`,
    userId,
    workoutId,
    startedAt,
  );
  return {
    sessionId: result.lastInsertRowId!,
    workoutId,
    startedAt,
    isRunning: true,
  };
}

export async function stopWorkoutSession(params: {
  userId: number;
  sessionId: number;
  startedAt: string;
  cancelOnly: boolean;
}) {
  const now = new Date();
  const startedAt = new Date(params.startedAt);
  // A forgotten session's real end is unknown: record it on its start (so
  // "feito há" and the coach stats land on the right day), with no duration.
  const forgotten = isForgottenSession(params.startedAt, now.getTime());
  const endedAt = forgotten ? startedAt : now;
  const durationSeconds = forgotten ? null : Math.floor((now.getTime() - startedAt.getTime()) / 1000);
  const completed = params.cancelOnly ? 0 : 1;
  const endedAtIso = endedAt.toISOString();
  const nowIso = now.toISOString();

  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const updateCurrent = await supabase
      .from('workout_sessions')
      .update({
        ended_at: endedAtIso,
        duration_seconds: durationSeconds,
        completed,
      })
      .eq('id', params.sessionId);
    if (updateCurrent.error) throw updateCurrent.error;

    const closeOthers = await supabase
      .from('workout_sessions')
      .update({
        ended_at: nowIso,
        duration_seconds: 0,
        completed: 0,
      })
      .eq('user_id', params.userId)
      .is('ended_at', null)
      .neq('id', params.sessionId);
    if (closeOthers.error) throw closeOthers.error;

    // The check always goes to the day the workout started, even days later.
    return { completed, attendanceDate: startedAt };
  }

  const db = await getLocalDb();
  await db.runAsync(
    `UPDATE workout_sessions
      SET ended_at = ?, duration_seconds = ?, completed = ?
      WHERE id = ?;`,
    endedAtIso,
    durationSeconds,
    completed,
    params.sessionId,
  );

  await db.runAsync(
    `UPDATE workout_sessions
      SET ended_at = ?, duration_seconds = 0, completed = 0
      WHERE user_id = ? AND ended_at IS NULL AND id != ?;`,
    nowIso,
    params.userId,
    params.sessionId,
  );

  // The check always goes to the day the workout started, even days later.
  return { completed, attendanceDate: startedAt };
}
