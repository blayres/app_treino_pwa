import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import type { Exercise, ExerciseLoad, Workout, WorkoutExercise, WorkoutWithLastDone } from './types';
import { recordLoadHistory } from './progressService';

async function getLocalDb() {
  const { getDb } = await import('../db');
  return getDb();
}

const WORKOUTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — changes only when admin edits
const workoutsByUserCache = new Map<number, { expiresAt: number; data: WorkoutWithLastDone[] }>();

const WORKOUT_EXERCISES_CACHE_TTL_MS = 5 * 60 * 1000;
const workoutExercisesCache = new Map<number, { expiresAt: number; data: WorkoutExercise[] }>();

const EXERCISE_LOADS_CACHE_TTL_MS = 5 * 60 * 1000;
const exerciseLoadsCache = new Map<number, { expiresAt: number; data: ExerciseLoad[] }>();

export function getCachedWorkoutExercises(workoutId: number): WorkoutExercise[] | null {
  const cached = workoutExercisesCache.get(workoutId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  return null;
}

export function getCachedWorkoutsByUser(userId: number): WorkoutWithLastDone[] | null {
  const cached = workoutsByUserCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  return null;
}

export function getCachedExerciseLoads(userId: number): ExerciseLoad[] | null {
  const cached = exerciseLoadsCache.get(userId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  return null;
}

export async function getWorkoutTitle(workoutId: number): Promise<string> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase.from('workouts').select('title').eq('id', workoutId).single();
    if (error) throw error;
    return data.title as string;
  }

  const db = await getLocalDb();
  const row = await db.getFirstAsync<{ title: string }>(
    `SELECT title FROM workouts WHERE id = ?;`,
    workoutId,
  );

  return row?.title ?? '';
}

export async function getWorkoutsByUser(userId: number): Promise<WorkoutWithLastDone[]> {
  const cached = workoutsByUserCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();

    // Try with archived_at filter (post-migration). If the column doesn't
    // exist yet (pre-migration, error code 42703), fall back to fetching all
    // rows and filtering client-side on the returned field.
    let workoutsResult = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('day_of_week', { ascending: true });

    if (workoutsResult.error?.code === '42703') {
      // Column does not exist yet — migration hasn't been run.
      // Fall back to fetching without the filter; no rows will be archived.
      workoutsResult = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .order('day_of_week', { ascending: true });
    }

    if (workoutsResult.error) throw workoutsResult.error;

    const { data: sessions, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select('workout_id, ended_at')
      .eq('user_id', userId)
      .eq('completed', 1)
      .not('ended_at', 'is', null);

    if (sessionsError) throw sessionsError;

    const lastDoneMap: Record<number, string> = {};
    (sessions ?? []).forEach((session) => {
      const workoutId = Number(session.workout_id);
      const endedAt = String(session.ended_at);
      if (!lastDoneMap[workoutId] || endedAt > lastDoneMap[workoutId]) {
        lastDoneMap[workoutId] = endedAt;
      }
    });

    // Client-side filter: hide anything that was archived (post-migration rows
    // that have archived_at set will be excluded here even if the server-side
    // filter wasn't applied above).
    const activeWorkouts = (workoutsResult.data ?? []).filter((w: any) => !w.archived_at);

    const response = activeWorkouts.map((workout) => ({
      ...(workout as Workout),
      last_done: lastDoneMap[Number(workout.id)] ?? null,
    }));

    workoutsByUserCache.set(userId, {
      expiresAt: Date.now() + WORKOUTS_CACHE_TTL_MS,
      data: response,
    });

    return response;
  }

  const db = await getLocalDb();

  const rows = await db.getAllAsync<Workout>(
    `SELECT * FROM workouts
     WHERE user_id = ? AND archived_at IS NULL
     ORDER BY day_of_week ASC;`,
    userId,
  );

  const lastDoneRows = await db.getAllAsync<{ workout_id: number; last_done: string }>(
    `SELECT workout_id, MAX(ended_at) as last_done
     FROM workout_sessions
     WHERE user_id = ? AND completed = 1
     GROUP BY workout_id;`,
    userId,
  );

  const lastDoneMap: Record<number, string> = {};
  lastDoneRows.forEach((row) => {
    lastDoneMap[row.workout_id] = row.last_done;
  });

  const response = rows.map((workout) => ({
    ...workout,
    last_done: lastDoneMap[workout.id] ?? null,
  }));

  workoutsByUserCache.set(userId, {
    expiresAt: Date.now() + WORKOUTS_CACHE_TTL_MS,
    data: response,
  });

  return response;
}

// ── Workout customization functions ──────────────────────────────────────────

export async function updateWorkoutTitle(workoutId: number, title: string): Promise<void> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase
      .from('workouts')
      .update({ title })
      .eq('id', workoutId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Treino não encontrado ou sem permissão para editá-lo.');
    return;
  }

  const db = await getLocalDb();
  await db.runAsync(
    `UPDATE workouts SET title = ? WHERE id = ?;`,
    title,
    workoutId,
  );
}

export async function createWorkoutForUser(params: {
  userId: number;
  dayOfWeek: number;
  title: string;
  exerciseIds: number[];
}): Promise<number> {
  const { userId, dayOfWeek, title, exerciseIds } = params;

  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data: workoutRow, error: workoutError } = await supabase
      .from('workouts')
      .insert({ user_id: userId, day_of_week: dayOfWeek, title })
      .select('id')
      .single();
    if (workoutError) throw workoutError;
    const workoutId = Number(workoutRow.id);

    if (exerciseIds.length > 0) {
      const rows = exerciseIds.map((exerciseId, index) => ({
        workout_id: workoutId,
        exercise_id: exerciseId,
        order_index: index,
      }));
      const { error: exError } = await supabase.from('workout_exercises').insert(rows);
      if (exError) throw exError;
    }

    return workoutId;
  }

  const db = await getLocalDb();
  const result = await db.runAsync(
    `INSERT INTO workouts (user_id, day_of_week, title) VALUES (?, ?, ?);`,
    userId,
    dayOfWeek,
    title,
  );
  const workoutId = result.lastInsertRowId!;

  for (let index = 0; index < exerciseIds.length; index++) {
    await db.runAsync(
      `INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, ?);`,
      workoutId,
      exerciseIds[index],
      index,
    );
  }

  return workoutId;
}

export async function addExerciseToWorkout(workoutId: number, exerciseId: number): Promise<void> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    // Get current max order_index
    const { data, error: fetchError } = await supabase
      .from('workout_exercises')
      .select('order_index')
      .eq('workout_id', workoutId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchError) throw fetchError;
    const nextIndex = data ? Number(data.order_index) + 1 : 0;

    const { error } = await supabase.from('workout_exercises').insert({
      workout_id: workoutId,
      exercise_id: exerciseId,
      order_index: nextIndex,
    });
    if (error) throw error;
    return;
  }

  const db = await getLocalDb();
  const row = await db.getFirstAsync<{ max_idx: number }>(
    `SELECT MAX(order_index) as max_idx FROM workout_exercises WHERE workout_id = ?;`,
    workoutId,
  );
  const nextIndex = row?.max_idx != null ? row.max_idx + 1 : 0;
  await db.runAsync(
    `INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, ?);`,
    workoutId,
    exerciseId,
    nextIndex,
  );
}

export async function removeExerciseFromWorkout(workoutExerciseId: number): Promise<void> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase
      .from('workout_exercises')
      .delete()
      .eq('id', workoutExerciseId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Exercício não encontrado ou sem permissão para removê-lo.');
    return;
  }

  const db = await getLocalDb();
  await db.runAsync(
    `DELETE FROM workout_exercises WHERE id = ?;`,
    workoutExerciseId,
  );
}

export async function archiveWorkout(workoutId: number): Promise<void> {
  const archivedAt = new Date().toISOString();

  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase
      .from('workouts')
      .update({ archived_at: archivedAt })
      .eq('id', workoutId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Treino não encontrado ou sem permissão para editá-lo.');
    return;
  }

  const db = await getLocalDb();
  await db.runAsync(
    `UPDATE workouts SET archived_at = ? WHERE id = ?;`,
    archivedAt,
    workoutId,
  );
}

export async function getWorkoutExerciseCount(workoutId: number): Promise<number> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { count, error } = await supabase
      .from('workout_exercises')
      .select('id', { count: 'exact', head: true })
      .eq('workout_id', workoutId);
    if (error) throw error;
    return count ?? 0;
  }

  const db = await getLocalDb();
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM workout_exercises WHERE workout_id = ?;`,
    workoutId,
  );
  return row?.cnt ?? 0;
}

export function invalidateWorkoutsByUserCache(userId?: number) {
  if (typeof userId === 'number') {
    workoutsByUserCache.delete(userId);
    return;
  }

  workoutsByUserCache.clear();
}

export function invalidateWorkoutExercisesCache(workoutId?: number) {
  if (typeof workoutId === 'number') {
    workoutExercisesCache.delete(workoutId);
    return;
  }

  workoutExercisesCache.clear();
}

export function invalidateExerciseLoadsCache(userId?: number) {
  if (typeof userId === 'number') {
    exerciseLoadsCache.delete(userId);
    return;
  }

  exerciseLoadsCache.clear();
}

export async function getWorkoutExercises(workoutId: number): Promise<WorkoutExercise[]> {
  const cached = workoutExercisesCache.get(workoutId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();

    const { data, error } = await supabase
      .from('workout_exercises')
      .select(
        `
        id,
        workout_id,
        exercise_id,
        order_index,
        exercises (
          id,
          name,
          primary_muscle,
          secondary_muscle,
          rest_seconds,
          scheme,
          tip,
          exercise_library_id,
          exercise_library:exercise_library_id (
            id,
            gif_url
          )
        )
      `,
      )
      .eq('workout_id', workoutId)
      .order('order_index', { ascending: true });

    if (error) {
      console.warn('[getWorkoutExercises] full query failed, using base fallback:', error.message);

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('workout_exercises')
        .select(
          `
          id,
          workout_id,
          exercise_id,
          order_index,
          exercises (
            id,
            name,
            primary_muscle,
            secondary_muscle,
            rest_seconds,
            scheme
          )
        `,
        )
        .eq('workout_id', workoutId)
        .order('order_index', { ascending: true });

      if (fallbackError) throw fallbackError;

      const response = (fallbackData ?? []).map((row: any) => {
        const ex = row.exercises;

        return {
          id: Number(row.id),
          workout_id: Number(row.workout_id),
          exercise_id: Number(row.exercise_id),
          order_index: Number(row.order_index),
          exercise: {
            id: Number(ex.id),
            name: String(ex.name),
            primary_muscle: ex.primary_muscle ?? null,
            secondary_muscle: ex.secondary_muscle ?? null,
            rest_seconds: Number(ex.rest_seconds),
            scheme: String(ex.scheme),
            tip: null,
            exercise_library_id: null,
            library: null,
          },
        };
      });

      workoutExercisesCache.set(workoutId, {
        expiresAt: Date.now() + WORKOUT_EXERCISES_CACHE_TTL_MS,
        data: response,
      });

      return response;
    }

    const response = (data ?? []).map((row: any) => {
      const ex = row.exercises;

      return {
        id: Number(row.id),
        workout_id: Number(row.workout_id),
        exercise_id: Number(row.exercise_id),
        order_index: Number(row.order_index),
        exercise: {
          id: Number(ex.id),
          name: String(ex.name),
          primary_muscle: ex.primary_muscle ?? null,
          secondary_muscle: ex.secondary_muscle ?? null,
          rest_seconds: Number(ex.rest_seconds),
          scheme: String(ex.scheme),
          tip: ex.tip ?? null,
          exercise_library_id: ex.exercise_library_id ?? null,
          library: ex.exercise_library ?? null,
        },
      };
    });

    workoutExercisesCache.set(workoutId, {
      expiresAt: Date.now() + WORKOUT_EXERCISES_CACHE_TTL_MS,
      data: response,
    });

    return response;
  }

  const db = await getLocalDb();

  const rows = await db.getAllAsync<any>(
    `SELECT we.id as we_id, we.workout_id, we.exercise_id, we.order_index, e.*
     FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ?
     ORDER BY we.order_index ASC;`,
    workoutId,
  );

  const response = rows.map((row) => ({
    id: row.we_id,
    workout_id: row.workout_id,
    exercise_id: row.exercise_id,
    order_index: row.order_index,
    exercise: {
      id: row.id,
      name: row.name,
      primary_muscle: row.primary_muscle,
      secondary_muscle: row.secondary_muscle,
      rest_seconds: row.rest_seconds,
      scheme: row.scheme,
      tip: row.tip ?? null,
      exercise_library_id: null,
      library: null,
    },
  }));

  workoutExercisesCache.set(workoutId, {
    expiresAt: Date.now() + WORKOUT_EXERCISES_CACHE_TTL_MS,
    data: response,
  });

  return response;
}

export async function getExerciseLoadsByUser(userId: number): Promise<ExerciseLoad[]> {
  const cached = exerciseLoadsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();

    const { data, error } = await supabase
      .from('exercise_loads')
      .select('exercise_id, load_kg, progression_kg')
      .eq('user_id', userId);

    if (error) throw error;

    const response = (data ?? []) as ExerciseLoad[];

    exerciseLoadsCache.set(userId, {
      expiresAt: Date.now() + EXERCISE_LOADS_CACHE_TTL_MS,
      data: response,
    });

    return response;
  }

  const db = await getLocalDb();

  const response = await db.getAllAsync<ExerciseLoad>(
    `SELECT exercise_id, load_kg, progression_kg FROM exercise_loads
     WHERE user_id = ?;`,
    userId,
  );

  exerciseLoadsCache.set(userId, {
    expiresAt: Date.now() + EXERCISE_LOADS_CACHE_TTL_MS,
    data: response,
  });

  return response;
}

export async function upsertExerciseLoad(params: {
  userId: number;
  exerciseId: number;
  loadKg: number | null;
  progressionKg: number | null;
}) {
  const now = new Date().toISOString();

  exerciseLoadsCache.delete(params.userId);

  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();

    const { error } = await supabase.from('exercise_loads').upsert(
      {
        user_id: params.userId,
        exercise_id: params.exerciseId,
        load_kg: params.loadKg,
        progression_kg: params.progressionKg,
        updated_at: now,
      },
      { onConflict: 'user_id,exercise_id' },
    );

    if (error) throw error;

    // Record history snapshot for progress tracking (non-blocking)
    if (params.loadKg != null && params.loadKg > 0) {
      void recordLoadHistory({ userId: params.userId, exerciseId: params.exerciseId, loadKg: params.loadKg });
    }
    return;
  }

  const db = await getLocalDb();

  await db.runAsync(
    `INSERT INTO exercise_loads (user_id, exercise_id, load_kg, progression_kg, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, exercise_id)
     DO UPDATE SET load_kg = excluded.load_kg, progression_kg = excluded.progression_kg, updated_at = excluded.updated_at;`,
    params.userId,
    params.exerciseId,
    params.loadKg,
    params.progressionKg,
    now,
  );

  // Record history snapshot for progress tracking (non-blocking)
  if (params.loadKg != null && params.loadKg > 0) {
    void recordLoadHistory({ userId: params.userId, exerciseId: params.exerciseId, loadKg: params.loadKg });
  }
}

export async function listExercises(): Promise<Exercise[]> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();

    const { data, error } = await supabase.from('exercises').select('*').order('name', { ascending: true });

    if (error) throw error;

    return (data ?? []) as Exercise[];
  }

  const db = await getLocalDb();

  return db.getAllAsync<Exercise>(`SELECT * FROM exercises ORDER BY name ASC;`);
}
