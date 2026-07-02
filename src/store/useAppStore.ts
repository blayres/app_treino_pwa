import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ActiveSession, User } from '../services/types';

type WorkoutLoadValue = {
  normal: string;
  progression: string;
};

type ActiveWorkoutState = {
  screen: 'Home' | 'Workout';
  userId: number;
  workoutId: number;
  workoutTitle: string | null;
  currentExerciseId: number | null;
  completedExerciseIds: number[];
  loads: Record<number, WorkoutLoadValue>;
};

type AppState = {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;

  activeSession: ActiveSession | null;
  setActiveSession: (session: ActiveSession | null) => void;

  activeWorkout: ActiveWorkoutState | null;
  beginActiveWorkout: (params: {
    userId: number;
    workoutId: number;
    workoutTitle?: string | null;
  }) => void;
  setActiveWorkoutScreen: (screen: 'Home' | 'Workout') => void;
  setActiveWorkoutTitle: (title: string | null) => void;
  setActiveWorkoutLoad: (exerciseId: number, value: WorkoutLoadValue) => void;
  setActiveWorkoutLoads: (loads: Record<number, WorkoutLoadValue>) => void;
  toggleCompletedExercise: (exerciseId: number) => void;
  clearActiveWorkout: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),

      activeSession: null,
      setActiveSession: (session) => set({ activeSession: session }),

      activeWorkout: null,
      beginActiveWorkout: ({ userId, workoutId, workoutTitle }) =>
        set((state) => {
          if (
            state.activeWorkout?.userId === userId
            && state.activeWorkout.workoutId === workoutId
          ) {
            const nextTitle = workoutTitle ?? state.activeWorkout.workoutTitle;

            if (
              state.activeWorkout.screen === 'Workout'
              && state.activeWorkout.workoutTitle === nextTitle
            ) {
              return state;
            }

            return {
              activeWorkout: {
                ...state.activeWorkout,
                screen: 'Workout',
                workoutTitle: nextTitle,
              },
            };
          }

          return {
            activeWorkout: {
              screen: 'Workout',
              userId,
              workoutId,
              workoutTitle: workoutTitle ?? null,
              currentExerciseId: null,
              completedExerciseIds: [],
              loads: {},
            },
          };
        }),
      setActiveWorkoutScreen: (screen) =>
        set((state) => {
          if (!state.activeWorkout || state.activeWorkout.screen === screen) {
            return state;
          }

          return {
            activeWorkout: { ...state.activeWorkout, screen },
          };
        }),
      setActiveWorkoutTitle: (title) =>
        set((state) => {
          if (!state.activeWorkout || state.activeWorkout.workoutTitle === title) {
            return state;
          }

          return {
            activeWorkout: { ...state.activeWorkout, workoutTitle: title },
          };
        }),
      setActiveWorkoutLoad: (exerciseId, value) =>
        set((state) => {
          if (!state.activeWorkout) return state;

          const currentValue = state.activeWorkout.loads[exerciseId];
          if (
            currentValue?.normal === value.normal
            && currentValue.progression === value.progression
          ) {
            return state;
          }

          return {
            activeWorkout: {
              ...state.activeWorkout,
              loads: {
                ...state.activeWorkout.loads,
                [exerciseId]: value,
              },
            },
          };
        }),
      setActiveWorkoutLoads: (loads) =>
        set((state) => {
          if (!state.activeWorkout || state.activeWorkout.loads === loads) {
            return state;
          }

          return {
            activeWorkout: { ...state.activeWorkout, loads },
          };
        }),
      toggleCompletedExercise: (exerciseId) =>
        set((state) => {
          if (!state.activeWorkout) return state;

          const completedExerciseIds = state.activeWorkout.completedExerciseIds.includes(exerciseId)
            ? state.activeWorkout.completedExerciseIds.filter((id) => id !== exerciseId)
            : [...state.activeWorkout.completedExerciseIds, exerciseId];

          return {
            activeWorkout: {
              ...state.activeWorkout,
              completedExerciseIds,
              currentExerciseId: exerciseId,
            },
          };
        }),
      clearActiveWorkout: () =>
        set((state) => state.activeWorkout ? { activeWorkout: null } : state),
    }),
    {
      name: 'app-treino-active-workout',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeWorkout: state.activeWorkout
          ? { ...state.activeWorkout, loads: {} }
          : null,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as {
          activeWorkout?: ActiveWorkoutState | null;
        };

        return {
          ...currentState,
          activeWorkout: persisted.activeWorkout ?? null,
        };
      },
    },
  ),
);
