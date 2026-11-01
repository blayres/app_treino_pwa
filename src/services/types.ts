export type User = {
  id: number;
  name: string;
};

export type ExerciseLibrary = {
  id: string;
  gif_url: string | null;
};

export type Exercise = {
  id: number;
  name: string;
  primary_muscle: string | null;
  secondary_muscle: string | null;
  rest_seconds: number;
  scheme: string;
  tip: string | null;
  exercise_library_id: string | null;
  library?: ExerciseLibrary | null;
  /** null/undefined = global catalogue; otherwise private to that profile. */
  owner_id?: number | null;
};

export type Workout = {
  id: number;
  user_id: number;
  day_of_week: number;
  title: string;
  archived_at?: string | null;
};

export type WorkoutWithLastDone = Workout & {
  last_done: string | null;
};

export type WorkoutExercise = {
  id: number;
  workout_id: number;
  exercise_id: number;
  order_index: number;
  /** `exercise.scheme`/`rest_seconds` are the effective values (per-workout
   * override if set); these are the catalogue defaults underneath. */
  base_scheme?: string;
  base_rest_seconds?: number;
  scheme_override?: string | null;
  rest_seconds_override?: number | null;
  /** Coach instructions for this exercise in this workout. */
  notes?: string | null;
  exercise: Exercise;
};

export type ExerciseLoad = {
  exercise_id: number;
  load_kg: number | null;
  progression_kg: number | null;
};

export type ActiveSession = {
  sessionId: number;
  workoutId: number;
  startedAt: string;
  isRunning: boolean;
};
