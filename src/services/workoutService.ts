import { getDb } from '../db';
import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import type { Exercise, ExerciseLoad, Workout, WorkoutExercise, WorkoutWithLastDone } from './types';

const WORKOUTS_CACHE_TTL_MS = 20_000;
const workoutsByUserCache = new Map<number, { expiresAt: number; data: WorkoutWithLastDone[] }>();

export async function getWorkoutTitle(workoutId: number): Promise<string> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase.from('workouts').select('title').eq('id', workoutId).single();
    if (error) throw error;
    return data.title as string;
  }

  const db = await getDb();
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
    const [{ data: workouts, error: workoutsError }, { data: sessions, error: sessionsError }] =
      await Promise.all([
        supabase.from('workouts').select('*').eq('user_id', userId).order('day_of_week', { ascending: true }),
        supabase
          .from('workout_sessions')
          .select('workout_id, ended_at')
          .eq('user_id', userId)
          .eq('completed', 1)
          .not('ended_at', 'is', null),
      ]);

    if (workoutsError) throw workoutsError;
    if (sessionsError) throw sessionsError;

    const lastDoneMap: Record<number, string> = {};
    (sessions ?? []).forEach((session) => {
      const workoutId = Number(session.workout_id);
      const endedAt = String(session.ended_at);
      if (!lastDoneMap[workoutId] || endedAt > lastDoneMap[workoutId]) {
        lastDoneMap[workoutId] = endedAt;
      }
    });

    const response = (workouts ?? []).map((workout) => ({
      ...(workout as Workout),
      last_done: lastDoneMap[Number(workout.id)] ?? null,
    }));
    workoutsByUserCache.set(userId, {
      expiresAt: Date.now() + WORKOUTS_CACHE_TTL_MS,
      data: response,
    });
    return response;
  }

  const db = await getDb();
  const rows = await db.getAllAsync<Workout>(
    `SELECT * FROM workouts
     WHERE user_id = ?
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

export function invalidateWorkoutsByUserCache(userId?: number) {
  if (typeof userId === 'number') {
    workoutsByUserCache.delete(userId);
    return;
  }
  workoutsByUserCache.clear();
}

export async function getWorkoutExercises(workoutId: number): Promise<WorkoutExercise[]> {
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
          scheme
        )
      `,
      )
      .eq('workout_id', workoutId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: Number(row.id),
      workout_id: Number(row.workout_id),
      exercise_id: Number(row.exercise_id),
      order_index: Number(row.order_index),
      exercise: row.exercises as Exercise,
    }));
  }

  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT we.id as we_id, we.workout_id, we.exercise_id, we.order_index, e.*
     FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ?
     ORDER BY we.order_index ASC;`,
    workoutId,
  );

  return rows.map((row) => ({
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
      hint: row.hint ?? null,
    },
  }));
}

export async function getExerciseLoadsByUser(userId: number): Promise<ExerciseLoad[]> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase
      .from('exercise_loads')
      .select('exercise_id, load_kg, progression_kg')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []) as ExerciseLoad[];
  }

  const db = await getDb();
  return db.getAllAsync<ExerciseLoad>(
    `SELECT exercise_id, load_kg, progression_kg FROM exercise_loads
     WHERE user_id = ?;`,
    userId,
  );
}

export async function upsertExerciseLoad(params: {
  userId: number;
  exerciseId: number;
  loadKg: number | null;
  progressionKg: number | null;
}) {
  const now = new Date().toISOString();

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
    return;
  }

  const db = await getDb();
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
}

export async function listExercises(): Promise<Exercise[]> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase.from('exercises').select('*').order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Exercise[];
  }

  const db = await getDb();
  return db.getAllAsync<Exercise>(`SELECT * FROM exercises ORDER BY name ASC;`);
}
