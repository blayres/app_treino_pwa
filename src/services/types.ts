export type User = {
  id: number;
  name: string;
};

export type Exercise = {
  id: number;
  name: string;
  primary_muscle: string | null;
  secondary_muscle: string | null;
  rest_seconds: number;
  scheme: string;
};

export type Workout = {
  id: number;
  user_id: number;
  day_of_week: number;
  title: string;
};

export type WorkoutWithLastDone = Workout & {
  last_done: string | null;
};

export type WorkoutExercise = {
  id: number;
  workout_id: number;
  exercise_id: number;
  order_index: number;
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
