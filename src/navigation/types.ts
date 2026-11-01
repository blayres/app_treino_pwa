export type RootStackParamList = {
  Login: { email?: string } | undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  Home: undefined;
  Settings: undefined;
  Workout: { workoutId: number; workoutTitle?: string };
  Admin: undefined;
  MyWorkout: undefined;
  Progress: undefined;
  Onboarding: undefined;
};
