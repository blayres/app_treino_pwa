import { getDb } from '../db';
import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import type { Exercise, User, Workout } from './types';

export async function listUsers(): Promise<User[]> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase.from('profiles').select('id, name').order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({ id: Number(row.id), name: String(row.name) }));
  }

  const db = await getDb();
  return db.getAllAsync<User>(`SELECT * FROM users ORDER BY name ASC;`);
}

export async function saveExercise(exercise: Omit<Exercise, 'id'> & { id?: number }) {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const payload = {
      id: exercise.id,
      name: exercise.name,
      primary_muscle: exercise.primary_muscle,
      secondary_muscle: exercise.secondary_muscle,
      rest_seconds: exercise.rest_seconds,
      scheme: exercise.scheme,
    };
    const query = exercise.id
      ? supabase.from('exercises').update(payload).eq('id', exercise.id)
      : supabase.from('exercises').insert(payload);
    const { error } = await query;
    if (error) throw error;
    return;
  }

  const db = await getDb();
  if (exercise.id) {
    await db.runAsync(
      `UPDATE exercises
       SET name = ?, primary_muscle = ?, secondary_muscle = ?, rest_seconds = ?, scheme = ?
       WHERE id = ?;`,
      exercise.name,
      exercise.primary_muscle,
      exercise.secondary_muscle,
      exercise.rest_seconds,
      exercise.scheme,
      exercise.id,
    );
    return;
  }

  await db.runAsync(
    `INSERT INTO exercises (name, primary_muscle, secondary_muscle, rest_seconds, scheme)
     VALUES (?, ?, ?, ?, ?);`,
    exercise.name,
    exercise.primary_muscle,
    exercise.secondary_muscle,
    exercise.rest_seconds,
    exercise.scheme,
  );
}

export async function saveWorkout(workout: Omit<Workout, 'id'> & { id?: number }): Promise<number> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const payload = {
      id: workout.id,
      user_id: workout.user_id,
      day_of_week: workout.day_of_week,
      title: workout.title,
    };
    const query = workout.id
      ? supabase.from('workouts').update(payload).eq('id', workout.id).select('id').single()
      : supabase.from('workouts').insert(payload).select('id').single();
    const { data, error } = await query;
    if (error) throw error;
    return Number(data.id);
  }

  const db = await getDb();
  if (workout.id) {
    await db.runAsync(
      `UPDATE workouts
       SET user_id = ?, day_of_week = ?, title = ?
       WHERE id = ?;`,
      workout.user_id,
      workout.day_of_week,
      workout.title,
      workout.id,
    );
    return workout.id;
  }

  const result = await db.runAsync(
    `INSERT INTO workouts (user_id, day_of_week, title)
     VALUES (?, ?, ?);`,
    workout.user_id,
    workout.day_of_week,
    workout.title,
  );
  return result.lastInsertRowId ?? 0;
}

export async function replaceWorkoutExerciseOrder(workoutId: number, exerciseIds: number[]) {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const del = await supabase.from('workout_exercises').delete().eq('workout_id', workoutId);
    if (del.error) throw del.error;

    if (exerciseIds.length === 0) return;
    const payload = exerciseIds.map((exerciseId, index) => ({
      workout_id: workoutId,
      exercise_id: exerciseId,
      order_index: index,
    }));
    const ins = await supabase.from('workout_exercises').insert(payload);
    if (ins.error) throw ins.error;
    return;
  }

  const db = await getDb();
  await db.runAsync(`DELETE FROM workout_exercises WHERE workout_id = ?;`, workoutId);
  for (let index = 0; index < exerciseIds.length; index += 1) {
    await db.runAsync(
      `INSERT INTO workout_exercises (workout_id, exercise_id, order_index)
       VALUES (?, ?, ?);`,
      workoutId,
      exerciseIds[index],
      index,
    );
  }
}
