import type { Exercise } from './types';
import {
  createCustomExercise,
  createWorkoutForUser,
  getWorkoutsByUser,
  invalidateWorkoutsByUserCache,
  listExercises,
} from './workoutService';

/**
 * Default full-body program offered in onboarding ("Usar treino pronto").
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

export const DEFAULT_PROGRAM: WorkoutSeed[] = [
  { day_of_week: 1, title: 'Treino A – Costas, Bíceps e Pernas',       exercises: ['Cadeira Extensora', 'Leg Press 45°', 'Puxada Alta na Máquina', 'Remada na Máquina', 'Rosca Bíceps na Polia'] },
  { day_of_week: 2, title: 'Treino B – Peito, Tríceps, Ombro e Pernas', exercises: ['Agachamento na Máquina', 'Cadeira Flexora', 'Supino na Máquina', 'Desenvolvimento na Máquina', 'Tríceps na Polia'] },
  { day_of_week: 3, title: 'Treino A – Costas, Bíceps e Pernas',       exercises: ['Cadeira Extensora', 'Leg Press 45°', 'Puxada Alta na Máquina', 'Remada na Máquina', 'Rosca Bíceps na Polia'] },
  { day_of_week: 4, title: 'Treino B – Peito, Tríceps, Ombro e Pernas', exercises: ['Agachamento na Máquina', 'Cadeira Flexora', 'Supino na Máquina', 'Desenvolvimento na Máquina', 'Tríceps na Polia'] },
  { day_of_week: 5, title: 'Treino A – Costas, Bíceps e Pernas',       exercises: ['Cadeira Extensora', 'Leg Press 45°', 'Puxada Alta na Máquina', 'Remada na Máquina', 'Rosca Bíceps na Polia'] },
];

export function normalizeExerciseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9°]+/g, ' ')
    .trim();
}

/**
 * Resolves each default exercise to an existing catalogue row (by name).
 * Exercises missing from the catalogue are created as the user's private
 * exercises — regular users can't write to the global catalogue (RLS).
 */
async function resolveDefaultExercises(userId: number): Promise<Record<string, Exercise>> {
  const catalogue = await listExercises(userId);
  const byName = new Map<string, Exercise>();
  // Prefer global rows over private ones with the same name.
  [...catalogue]
    .sort((a, b) => Number(a.owner_id != null) - Number(b.owner_id != null))
    .forEach((exercise) => {
      const key = normalizeExerciseName(exercise.name);
      if (!byName.has(key)) byName.set(key, exercise);
    });

  const resolved: Record<string, Exercise> = {};
  for (const seed of DEFAULT_EXERCISES) {
    const found = byName.get(normalizeExerciseName(seed.name));
    resolved[seed.name] =
      found ??
      (await createCustomExercise({
        userId,
        name: seed.name,
        scheme: seed.scheme,
        restSeconds: seed.rest_seconds,
      }));
  }
  return resolved;
}

/**
 * Creates the default A/B program for the user. Skips if the user already has
 * active workouts, so it is safe to call more than once.
 */
export async function applyDefaultProgram(userId: number): Promise<void> {
  const existing = await getWorkoutsByUser(userId);
  if (existing.length > 0) return;

  const exercises = await resolveDefaultExercises(userId);
  const seedByName = new Map(DEFAULT_EXERCISES.map((seed) => [seed.name, seed]));

  for (const workout of DEFAULT_PROGRAM) {
    await createWorkoutForUser({
      userId,
      dayOfWeek: workout.day_of_week,
      title: workout.title,
      items: workout.exercises
        .filter((name) => exercises[name])
        .map((name) => {
          const seed = seedByName.get(name)!;
          const exercise = exercises[name];
          // Keep the program's own scheme/rest even if the catalogue row differs.
          return {
            exerciseId: exercise.id,
            scheme: exercise.scheme !== seed.scheme ? seed.scheme : null,
            restSeconds: exercise.rest_seconds !== seed.rest_seconds ? seed.rest_seconds : null,
          };
        }),
    });
  }

  invalidateWorkoutsByUserCache(userId);
}

/** @deprecated kept for older callers — use applyDefaultProgram. */
export const seedDefaultWorkoutsForUser = applyDefaultProgram;
