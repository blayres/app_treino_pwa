/**
 * progressService.ts
 *
 * Handles persistence for exercise_load_history and reads progress data.
 *
 * Table schema (Supabase):
 *   exercise_load_history (
 *     id          bigserial PRIMARY KEY,
 *     user_id     bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 *     exercise_id bigint NOT NULL REFERENCES exercises(id),
 *     load_kg     real   NOT NULL,
 *     recorded_at timestamptz NOT NULL DEFAULT now(),
 *
 *     -- Index for fast per-user queries
 *     -- CREATE INDEX ON exercise_load_history(user_id, recorded_at DESC);
 *   );
 *   RLS: users can only read/insert their own rows.
 *
 * Local SQLite mirror added via initDatabase() migration below.
 */

import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import type { LoadHistoryRow } from './progressUtils';

async function getLocalDb() {
  const { getDb } = await import('../db');
  return getDb();
}

// ── History write ─────────────────────────────────────────────────────────────

/**
 * Records a load snapshot in exercise_load_history.
 * Called by workoutService.upsertExerciseLoad after a successful upsert.
 * Fails silently so it never blocks the load-save flow.
 */
export async function recordLoadHistory(params: {
  userId: number;
  exerciseId: number;
  loadKg: number;
}): Promise<void> {
  if (params.loadKg <= 0) return; // skip zero/empty loads

  const now = new Date().toISOString();

  try {
    if (backendMode === 'supabase') {
      ensureSupabaseEnabled();
      // Supabase returns errors (e.g. refused by RLS) instead of throwing.
      const { error } = await supabase.from('exercise_load_history').insert({
        user_id: params.userId,
        exercise_id: params.exerciseId,
        load_kg: params.loadKg,
        recorded_at: now,
      });
      if (error) throw error;
      return;
    }

    const db = await getLocalDb();
    await db.runAsync(
      `INSERT INTO exercise_load_history (user_id, exercise_id, load_kg, recorded_at)
       VALUES (?, ?, ?, ?);`,
      params.userId,
      params.exerciseId,
      params.loadKg,
      now,
    );
  } catch (err) {
    // Non-blocking — progress history is best-effort
    console.warn('[progressService] recordLoadHistory failed:', err);
  }
}

// ── History read ──────────────────────────────────────────────────────────────

/**
 * Returns all load history rows for a user, joined with exercise name and
 * the exercise's scheme (for volume calculation).
 * Ordered chronologically (oldest first).
 */
export async function getLoadHistoryByUser(userId: number): Promise<
  (LoadHistoryRow & { scheme: string })[]
> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase
      .from('exercise_load_history')
      .select(
        `
        id,
        exercise_id,
        load_kg,
        recorded_at,
        exercises (
          name,
          scheme
        )
        `,
      )
      .eq('user_id', userId)
      .order('recorded_at', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: Number(row.id),
      exercise_id: Number(row.exercise_id),
      exercise_name: String(row.exercises?.name ?? '—'),
      load_kg: Number(row.load_kg),
      recorded_at: String(row.recorded_at),
      scheme: String(row.exercises?.scheme ?? ''),
    }));
  }

  const db = await getLocalDb();
  const rows = await db.getAllAsync<{
    id: number;
    exercise_id: number;
    exercise_name: string;
    load_kg: number;
    recorded_at: string;
    scheme: string;
  }>(
    `SELECT
       h.id,
       h.exercise_id,
       e.name AS exercise_name,
       h.load_kg,
       h.recorded_at,
       e.scheme
     FROM exercise_load_history h
     JOIN exercises e ON e.id = h.exercise_id
     WHERE h.user_id = ?
     ORDER BY h.recorded_at ASC;`,
    userId,
  );
  return rows;
}

/** Deletes history entries (e.g. a typo like 435 kg instead of 43,5). */
export async function deleteLoadHistoryEntries(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { error } = await supabase.from('exercise_load_history').delete().in('id', ids);
    if (error) throw error;
    return;
  }
  const db = await getLocalDb();
  for (const id of ids) await db.runAsync(`DELETE FROM exercise_load_history WHERE id = ?;`, id);
}

/** Start times (ISO) of the user's completed workout sessions. */
export async function getCompletedSessionDates(userId: number): Promise<string[]> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('started_at')
      .eq('user_id', userId)
      .eq('completed', 1)
      .order('started_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row: any) => String(row.started_at));
  }
  const db = await getLocalDb();
  const rows = await db.getAllAsync<{ started_at: string }>(
    `SELECT started_at FROM workout_sessions WHERE user_id = ? AND completed = 1 ORDER BY started_at ASC;`,
    userId,
  );
  return rows.map((row) => row.started_at);
}
