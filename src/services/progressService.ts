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
      await supabase.from('exercise_load_history').insert({
        user_id: params.userId,
        exercise_id: params.exerciseId,
        load_kg: params.loadKg,
        recorded_at: now,
      });
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
      exercise_id: Number(row.exercise_id),
      exercise_name: String(row.exercises?.name ?? '—'),
      load_kg: Number(row.load_kg),
      recorded_at: String(row.recorded_at),
      scheme: String(row.exercises?.scheme ?? ''),
    }));
  }

  const db = await getLocalDb();
  const rows = await db.getAllAsync<{
    exercise_id: number;
    exercise_name: string;
    load_kg: number;
    recorded_at: string;
    scheme: string;
  }>(
    `SELECT
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

/**
 * Returns all exercises the user has recorded at least one load for.
 * Used to populate the exercise selector on the Progress screen.
 */
export async function getTrackedExercises(userId: number): Promise<
  { exercise_id: number; exercise_name: string }[]
> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase
      .from('exercise_load_history')
      .select('exercise_id, exercises(name)')
      .eq('user_id', userId);

    if (error) throw error;

    const seen = new Map<number, string>();
    for (const row of data ?? []) {
      const id = Number((row as any).exercise_id);
      if (!seen.has(id)) {
        seen.set(id, String((row as any).exercises?.name ?? '—'));
      }
    }

    return Array.from(seen.entries())
      .map(([exercise_id, exercise_name]) => ({ exercise_id, exercise_name }))
      .sort((a, b) => a.exercise_name.localeCompare(b.exercise_name));
  }

  const db = await getLocalDb();
  const rows = await db.getAllAsync<{ exercise_id: number; exercise_name: string }>(
    `SELECT DISTINCT h.exercise_id, e.name AS exercise_name
     FROM exercise_load_history h
     JOIN exercises e ON e.id = h.exercise_id
     WHERE h.user_id = ?
     ORDER BY e.name ASC;`,
    userId,
  );
  return rows;
}
