import { ensureSupabaseEnabled, supabase } from './supabaseClient';

/**
 * Default full-body program seeded for every new user.
 *
 * Day 1 (Monday)   – Treino A: Costas, Bíceps e Pernas
 * Day 2 (Tuesday)  – Treino B: Peito, Tríceps, Ombro e Pernas
 * Day 3 (Wednesday)– Treino A: Costas, Bíceps e Pernas
 * Day 4 (Thursday) – Treino B: Peito, Tríceps, Ombro e Pernas
 * Day 5 (Friday)   – Treino A: Costas, Bíceps e Pernas
 */

type ExerciseSeed = {
  name: string;
  primary_muscle: string;
  secondary_muscle: string | null;
  rest_seconds: number;
  scheme: string;
};

type WorkoutSeed = {
  day_of_week: number; // 1=Mon … 7=Sun
  title: string;
  exercises: string[]; // exercise names in order
};

const DEFAULT_EXERCISES: ExerciseSeed[] = [
  // ── Treino A ──────────────────────────────────────────────────────────────
  { name: 'Cadeira Extensora',        primary_muscle: 'quadriceps',      secondary_muscle: null,         rest_seconds: 90,  scheme: '4x10-12' },
  { name: 'Leg Press 45°',            primary_muscle: 'quadriceps',      secondary_muscle: 'gluteos',    rest_seconds: 120, scheme: '4x10-12' },
  { name: 'Puxada Alta na Máquina',   primary_muscle: 'costas',          secondary_muscle: 'biceps',     rest_seconds: 90,  scheme: '4x10-12' },
  { name: 'Remada na Máquina',        primary_muscle: 'costas',          secondary_muscle: 'biceps',     rest_seconds: 90,  scheme: '3x10-12' },
  { name: 'Rosca Bíceps na Polia',    primary_muscle: 'biceps',          secondary_muscle: null,         rest_seconds: 60,  scheme: '3x12-15' },
  // ── Treino B ──────────────────────────────────────────────────────────────
  { name: 'Agachamento na Máquina',   primary_muscle: 'quadriceps',      secondary_muscle: 'gluteos',    rest_seconds: 120, scheme: '4x10-12' },
  { name: 'Cadeira Flexora',          primary_muscle: 'posterior',       secondary_muscle: null,         rest_seconds: 90,  scheme: '3x10-12' },
  { name: 'Supino na Máquina',        primary_muscle: 'peito',           secondary_muscle: 'triceps',    rest_seconds: 90,  scheme: '4x10-12' },
  { name: 'Desenvolvimento na Máquina', primary_muscle: 'ombros',        secondary_muscle: 'triceps',    rest_seconds: 90,  scheme: '3x10-12' },
  { name: 'Tríceps na Polia',         primary_muscle: 'triceps',         secondary_muscle: null,         rest_seconds: 60,  scheme: '3x12-15' },
];

const DEFAULT_PROGRAM: WorkoutSeed[] = [
  { day_of_week: 1, title: 'Treino A – Costas, Bíceps e Pernas',       exercises: ['Cadeira Extensora', 'Leg Press 45°', 'Puxada Alta na Máquina', 'Remada na Máquina', 'Rosca Bíceps na Polia'] },
  { day_of_week: 2, title: 'Treino B – Peito, Tríceps, Ombro e Pernas', exercises: ['Agachamento na Máquina', 'Cadeira Flexora', 'Supino na Máquina', 'Desenvolvimento na Máquina', 'Tríceps na Polia'] },
  { day_of_week: 3, title: 'Treino A – Costas, Bíceps e Pernas',       exercises: ['Cadeira Extensora', 'Leg Press 45°', 'Puxada Alta na Máquina', 'Remada na Máquina', 'Rosca Bíceps na Polia'] },
  { day_of_week: 4, title: 'Treino B – Peito, Tríceps, Ombro e Pernas', exercises: ['Agachamento na Máquina', 'Cadeira Flexora', 'Supino na Máquina', 'Desenvolvimento na Máquina', 'Tríceps na Polia'] },
  { day_of_week: 5, title: 'Treino A – Costas, Bíceps e Pernas',       exercises: ['Cadeira Extensora', 'Leg Press 45°', 'Puxada Alta na Máquina', 'Remada na Máquina', 'Rosca Bíceps na Polia'] },
];

/**
 * Ensures all default exercises exist in the exercises table and returns
 * a map of name → id.
 */
async function upsertDefaultExercises(): Promise<Record<string, number>> {
  ensureSupabaseEnabled();

  const { data, error } = await supabase
    .from('exercises')
    .upsert(DEFAULT_EXERCISES, { onConflict: 'name', ignoreDuplicates: false })
    .select('id, name');

  if (error) throw error;

  const map: Record<string, number> = {};
  (data ?? []).forEach((row: any) => {
    map[String(row.name)] = Number(row.id);
  });
  return map;
}

/**
 * Seeds the default A/B full-body program for a newly created profile.
 * Safe to call multiple times — skips if workouts already exist for the user.
 */
export async function seedDefaultWorkoutsForUser(profileId: number): Promise<void> {
  ensureSupabaseEnabled();

  // Skip if user already has workouts
  const { count } = await supabase
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profileId);

  if ((count ?? 0) > 0) return;

  const exerciseIdByName = await upsertDefaultExercises();

  for (const workout of DEFAULT_PROGRAM) {
    const { data: workoutRow, error: workoutError } = await supabase
      .from('workouts')
      .insert({ user_id: profileId, day_of_week: workout.day_of_week, title: workout.title })
      .select('id')
      .single();

    if (workoutError) throw workoutError;

    const workoutId = Number(workoutRow.id);
    const exerciseRows = workout.exercises
      .map((name, index) => ({
        workout_id: workoutId,
        exercise_id: exerciseIdByName[name],
        order_index: index,
      }))
      .filter((row) => row.exercise_id != null);

    if (exerciseRows.length > 0) {
      const { error: exError } = await supabase
        .from('workout_exercises')
        .insert(exerciseRows);
      if (exError) throw exError;
    }
  }
}
