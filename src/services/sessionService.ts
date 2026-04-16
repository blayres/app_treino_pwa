import { getDb } from '../db';
import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import type { ActiveSession } from './types';

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

  const db = await getDb();
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

export async function closeStaleSessions(userId?: number) {
  if (backendMode === 'supabase') {
    if (!userId) return;
    ensureSupabaseEnabled();
    const staleIso = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('workout_sessions')
      .update({
        ended_at: staleIso,
        duration_seconds: 0,
        completed: 0,
      })
      .eq('user_id', userId)
      .is('ended_at', null)
      .lt('started_at', staleIso);
    if (error) throw error;
    return;
  }

  const db = await getDb();
  await db.runAsync(`
    UPDATE workout_sessions
    SET ended_at = started_at, duration_seconds = 0, completed = 0
    WHERE ended_at IS NULL
    AND datetime(started_at) < datetime('now', '-4 hours');
  `);
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

  const db = await getDb();
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
  const endedAt = new Date();
  const durationSeconds = Math.floor((endedAt.getTime() - new Date(params.startedAt).getTime()) / 1000);
  const completed = params.cancelOnly ? 0 : 1;
  const endedAtIso = endedAt.toISOString();

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
        ended_at: endedAtIso,
        duration_seconds: 0,
        completed: 0,
      })
      .eq('user_id', params.userId)
      .is('ended_at', null)
      .neq('id', params.sessionId);
    if (closeOthers.error) throw closeOthers.error;

    return { completed, endedAt };
  }

  const db = await getDb();
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
    endedAtIso,
    params.userId,
    params.sessionId,
  );

  return { completed, endedAt };
}
