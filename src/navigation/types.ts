export type RootStackParamList = {
  Login: { email?: string } | undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  Home: undefined;
  Settings: undefined;
  Workout: { workoutId: number; workoutTitle?: string };
  /** Personal trainer area: invite + students list. */
  Coach: undefined;
  CoachStudent: { studentId: number };
  /** "Meu treino" editor opened by the coach for a student. */
  CoachProgram: { studentId: number; studentName?: string };
  StudentProgress: { studentId: number; studentName?: string };
  MyWorkout: undefined;
  Progress: undefined;
  Onboarding: undefined;
};
