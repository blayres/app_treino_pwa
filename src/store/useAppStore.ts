import { create } from 'zustand';
import type { ActiveSession, User } from '../services/types';

type AppState = {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;

  activeSession: ActiveSession | null;
  setActiveSession: (session: ActiveSession | null) => void;

  /** New account that still has to pick how to start (see OnboardingScreen). */
  needsOnboarding: boolean;
  setNeedsOnboarding: (value: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  activeSession: null,
  setActiveSession: (session) => set({ activeSession: session }),

  needsOnboarding: false,
  setNeedsOnboarding: (value) => set({ needsOnboarding: value }),
}));
