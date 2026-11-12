import type { Exercise } from './types';
import {
  createCustomExercise,
  createWorkoutForUser,
  getWorkoutsByUser,
  invalidateWorkoutsByUserCache,
  listExercises,
} from './workoutService';
import { targetSeconds } from '../utils/measure';

/**
 * Default program offered in onboarding ("Usar treino pronto"): an upper/lower
 * split for beginners and intermediates, 5 days a week. Every muscle is trained
 * twice a week with ~10 hard sets, mostly machines, cables and dumbbells (easy to
 * learn, safe without a spotter), compound lifts first, isolation after.
 *
 * Day 1 (Monday)    – Superior A: Peito, Costas e Ombros
 * Day 2 (Tuesday)   – Inferior A: Quadríceps e Panturrilha
 * Day 3 (Wednesday) – Core: Abdômen, Lombar e Glúteos (lighter day between splits)
 * Day 4 (Thursday)  – Superior B: Costas, Peito e Braços
 * Day 5 (Friday)    – Inferior B: Posterior e Glúteos
 *
 * 5–6 exercises a day, 3 sets each: about 45–50 min with warm-up (see
 * estimateWorkoutMinutes). Every exercise exists in the global catalogue with an
 * animated GIF.
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
  // ── Superior A ────────────────────────────────────────────────────────────
  { name: 'Supino reto com halteres',        primary_muscle: 'peito',           secondary_muscle: 'triceps',    rest_seconds: 90,  scheme: '3x8-12' },
  { name: 'Puxada frente na polia',          primary_muscle: 'costas',          secondary_muscle: 'biceps',     rest_seconds: 90,  scheme: '3x8-12' },
  { name: 'Desenvolvimento na Máquina',      primary_muscle: 'ombros',          secondary_muscle: 'triceps',    rest_seconds: 90,  scheme: '3x8-12' },
  { name: 'Remada baixa na polia',           primary_muscle: 'costas',          secondary_muscle: 'biceps',     rest_seconds: 90,  scheme: '3x10-12' },
  { name: 'Elevação lateral',                primary_muscle: 'ombros',          secondary_muscle: null,         rest_seconds: 60,  scheme: '3x12-15' },
  { name: 'Tríceps na Polia',                primary_muscle: 'triceps',         secondary_muscle: null,         rest_seconds: 60,  scheme: '3x10-12' },
  // ── Inferior A ────────────────────────────────────────────────────────────
  { name: 'Agachamento na Máquina',          primary_muscle: 'quadriceps',      secondary_muscle: 'gluteos',    rest_seconds: 120, scheme: '3x8-12' },
  { name: 'Leg Press 45°',                   primary_muscle: 'quadriceps',      secondary_muscle: 'gluteos',    rest_seconds: 90,  scheme: '3x10-12' },
  { name: 'Cadeira Extensora',               primary_muscle: 'quadriceps',      secondary_muscle: null,         rest_seconds: 90,  scheme: '3x12-15' },
  { name: 'Cadeira Flexora',                 primary_muscle: 'posterior',       secondary_muscle: null,         rest_seconds: 90,  scheme: '3x10-12' },
  { name: 'Cadeira Adutora',                 primary_muscle: 'adutor',          secondary_muscle: null,         rest_seconds: 60,  scheme: '3x12-15' },
  { name: 'Panturrilha em pé',               primary_muscle: 'panturrilha',     secondary_muscle: null,         rest_seconds: 60,  scheme: '3x10-15' },
  // ── Core ──────────────────────────────────────────────────────────────────
  { name: 'Prancha',                         primary_muscle: 'core',            secondary_muscle: null,         rest_seconds: 45,  scheme: '3x30-45s' },
  { name: 'Abdominal Crunch',                primary_muscle: 'core',            secondary_muscle: null,         rest_seconds: 60,  scheme: '3x12-15' },
  { name: 'Elevação de Pernas',              primary_muscle: 'core',            secondary_muscle: null,         rest_seconds: 60,  scheme: '3x10-12' },
  { name: 'Hiperextensão no banco',          primary_muscle: 'lombar',          secondary_muscle: 'gluteos',    rest_seconds: 60,  scheme: '3x12-15' },
  { name: 'Elevação Pélvica chão',           primary_muscle: 'gluteos',         secondary_muscle: 'posterior',  rest_seconds: 60,  scheme: '3x12-15' },
  // ── Superior B ────────────────────────────────────────────────────────────
  { name: 'Remada unilateral com halter',    primary_muscle: 'costas',          secondary_muscle: 'biceps',     rest_seconds: 90,  scheme: '3x8-12' },
  { name: 'Supino na Máquina',               primary_muscle: 'peito',           secondary_muscle: 'triceps',    rest_seconds: 90,  scheme: '3x8-12' },
  { name: 'Puxada Alta na Máquina',          primary_muscle: 'costas',          secondary_muscle: 'biceps',     rest_seconds: 90,  scheme: '3x10-12' },
  { name: 'Desenvolvimento com halteres',    primary_muscle: 'ombros',          secondary_muscle: 'triceps',    rest_seconds: 90,  scheme: '3x10-12' },
  { name: 'Fly Inverso',                     primary_muscle: 'ombro posterior', secondary_muscle: null,         rest_seconds: 60,  scheme: '3x12-15' },
  { name: 'Rosca alternada com halteres',    primary_muscle: 'biceps',          secondary_muscle: null,         rest_seconds: 60,  scheme: '3x10-12' },
  // ── Inferior B ────────────────────────────────────────────────────────────
  { name: 'Stiff com halteres',              primary_muscle: 'posterior',       secondary_muscle: 'gluteos',    rest_seconds: 120, scheme: '3x8-12' },
  { name: 'Hip thrust com barra',            primary_muscle: 'gluteos',         secondary_muscle: 'posterior',  rest_seconds: 90,  scheme: '3x8-12' },
  { name: 'Passada com halteres',            primary_muscle: 'gluteos',         secondary_muscle: 'quadriceps', rest_seconds: 90,  scheme: '3x10-12' },
  { name: 'Mesa Flexora',                    primary_muscle: 'posterior',       secondary_muscle: null,         rest_seconds: 90,  scheme: '3x10-12' },
  { name: 'Cadeira Abdutora',                primary_muscle: 'gluteo medio',    secondary_muscle: null,         rest_seconds: 60,  scheme: '3x12-15' },
  { name: 'Panturrilha sentado',             primary_muscle: 'panturrilha',     secondary_muscle: null,         rest_seconds: 60,  scheme: '3x12-15' },
];

export const DEFAULT_PROGRAM: WorkoutSeed[] = [
  {
    day_of_week: 1,
    title: 'Superior A – Peito, Costas e Ombros',
    exercises: ['Supino reto com halteres', 'Puxada frente na polia', 'Desenvolvimento na Máquina', 'Remada baixa na polia', 'Elevação lateral', 'Tríceps na Polia'],
  },
  {
    day_of_week: 2,
    title: 'Inferior A – Quadríceps e Panturrilha',
    exercises: ['Agachamento na Máquina', 'Leg Press 45°', 'Cadeira Extensora', 'Cadeira Flexora', 'Cadeira Adutora', 'Panturrilha em pé'],
  },
  {
    day_of_week: 3,
    title: 'Core – Abdômen, Lombar e Glúteos',
    exercises: ['Prancha', 'Abdominal Crunch', 'Elevação de Pernas', 'Hiperextensão no banco', 'Elevação Pélvica chão'],
  },
  {
    day_of_week: 4,
    title: 'Superior B – Costas, Peito e Braços',
    exercises: ['Remada unilateral com halter', 'Supino na Máquina', 'Puxada Alta na Máquina', 'Desenvolvimento com halteres', 'Fly Inverso', 'Rosca alternada com halteres'],
  },
  {
    day_of_week: 5,
    title: 'Inferior B – Posterior e Glúteos',
    exercises: ['Stiff com halteres', 'Hip thrust com barra', 'Passada com halteres', 'Mesa Flexora', 'Cadeira Abdutora', 'Panturrilha sentado'],
  },
];

/** Seconds per set of a load exercise (10–12 reps at ~3 s each). */
const LOAD_SET_SECONDS = 40;
/** Setting up the machine, adjusting the load, walking to the next one. */
const SETUP_SECONDS = 90;
const WARM_UP_MINUTES = 5;

/**
 * Rough length of a day of the program, warm-up included: sets × (work + rest),
 * without the rest after the last set, plus set-up time per exercise.
 */
export function estimateWorkoutMinutes(exerciseNames: string[]): number {
  const seedByName = new Map(DEFAULT_EXERCISES.map((seed) => [seed.name, seed]));
  let seconds = WARM_UP_MINUTES * 60;
  for (const name of exerciseNames) {
    const seed = seedByName.get(name);
    if (!seed) continue;
    const sets = Number(seed.scheme.match(/^(\d+)x/)?.[1] ?? 3);
    const work = targetSeconds(seed.scheme) ?? LOAD_SET_SECONDS;
    seconds += sets * (work + seed.rest_seconds) - seed.rest_seconds + SETUP_SECONDS;
  }
  return Math.round(seconds / 60);
}

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
 * Creates the default upper/lower program for the user. Skips if the user already has
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

