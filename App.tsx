import React, { useEffect, useState, Suspense } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme, View, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Critical screens — loaded eagerly (on the initial render path)
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import { lazyScreen, preloadWhenIdle } from './src/navigation/lazyScreen';
import {
  CoachFallback,
  GenericFallback,
  MyWorkoutFallback,
  ProgressFallback,
  SettingsFallback,
  WorkoutFallback,
} from './src/navigation/screenFallbacks';
import type { RootStackParamList } from './src/navigation/types';
import { colors } from './src/theme/colors';
import { useAppStore } from './src/store/useAppStore';
import { isForgottenSession, restoreActiveSessionByUser } from './src/services/sessionService';
import { getSessionUser, getOrCreateProfile, markOnboarded } from './src/services/authService';
import { captureInviteFromUrl } from './src/services/coachInvite';
import { forgetCachedProfiles, readCachedProfile, rememberProfile } from './src/services/profileCache';
import { prefetchHomeData, waitAtMost } from './src/services/homePrefetch';
import { PendingInviteHost } from './src/components/PendingInviteHost';
import { GuidedTour } from './src/components/GuidedTour';
import { useTourStore } from './src/store/useTourStore';
import { backendMode } from './src/services/backendMode';
import { supabase } from './src/services/supabaseClient';
import { AlertHost } from './src/components/AlertHost';
import { ForgottenWorkoutHost } from './src/components/ForgottenWorkoutHost';

// Non-critical screens — code-split, preloaded right after the first paint
// (see preloadWhenIdle below); each has a static fallback instead of a blank page.
const WorkoutScreen = lazyScreen(() => import('./src/screens/WorkoutScreen'), WorkoutFallback);
const CoachScreen = lazyScreen(() => import('./src/screens/CoachScreen'), CoachFallback);
const CoachStudentScreen = lazyScreen(() => import('./src/screens/CoachStudentScreen'), GenericFallback);
const SignupScreen = lazyScreen(() => import('./src/screens/SignupScreen'), GenericFallback);
const ForgotPasswordScreen = lazyScreen(() => import('./src/screens/ForgotPasswordScreen'), GenericFallback);
const MyWorkoutScreen = lazyScreen(() => import('./src/screens/MyWorkoutScreen'), MyWorkoutFallback);
const SettingsScreen = lazyScreen(() => import('./src/screens/SettingsScreen'), SettingsFallback);
const ProgressScreen = lazyScreen(() => import('./src/screens/ProgressScreen'), ProgressFallback);
const OnboardingScreen = lazyScreen(() => import('./src/screens/OnboardingScreen'), GenericFallback);

// Longest the logo waits for Home's data once the user is known (then skeletons).
const HOME_DATA_WAIT_MS = 300;

// Most likely next screens first.
const AUTHENTICATED_SCREENS = [WorkoutScreen, SettingsScreen, MyWorkoutScreen, ProgressScreen, CoachScreen, CoachStudentScreen, OnboardingScreen];
const GUEST_SCREENS = [SignupScreen, ForgotPasswordScreen];

export type { RootStackParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Invite link (/convite/CODE): keep the code until the user is signed in.
captureInviteFromUrl();

export default function App() {
  const scheme = useColorScheme();
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const activeSession = useAppStore((s) => s.activeSession);
  const needsOnboarding = useAppStore((s) => s.needsOnboarding);
  const currentUserId = useAppStore((s) => s.currentUser?.id ?? null);
  const setNeedsOnboarding = useAppStore((s) => s.setNeedsOnboarding);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  // 'loading'         — waiting for the first auth event, show spinner
  // 'authenticated'   — session confirmed, show Home stack
  // 'unauthenticated' — no session, show Login stack
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [restoredWorkoutId, setRestoredWorkoutId] = useState<number | null>(null);
  const [navigationReady, setNavigationReady] = useState(false);
  const lastAuthUserIdRef = React.useRef<string | null>(null);
  const didRestoreWorkoutRouteRef = React.useRef(false);
  const didOnboardingRedirectRef = React.useRef(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.getElementById('initial-splash')?.remove();
    }
  }, []);

  useEffect(() => {
    if (backendMode !== 'supabase') {
      (async () => {
        try {
          const { initDatabase } = await import('./src/db');
          await initDatabase();

          const user = await getSessionUser();
          if (user) {
            setCurrentUser(user);
            const session = await restoreActiveSessionByUser(user.id);
            if (session) {
              setActiveSession(session);
              // A forgotten workout is handled by ForgottenWorkoutHost instead.
              if (!isForgottenSession(session.startedAt)) setRestoredWorkoutId(session.workoutId);
            }
            setAuthStatus('authenticated');
          } else {
            setAuthStatus('unauthenticated');
          }
        } catch (error: any) {
          console.error('Erro ao iniciar app:', error);
          setAuthStatus('unauthenticated');
        }
      })();
      return;
    }

    // Safety net — unblock after 5s if onAuthStateChange never fires
    const timeout = setTimeout(() => setAuthStatus('unauthenticated'), 5000);

    let booted = false;

    const handleAuthEvent = async (
      event: string,
      session: { user: { id: string; email?: string; user_metadata: Record<string, any> } } | null,
    ) => {
      try {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          if (lastAuthUserIdRef.current === session.user.id) {
            return;
          }

          lastAuthUserIdRef.current = session.user.id;

          // Returning user: with the profile id from last time, look for an
          // in-progress workout and warm Home's data while the profile loads
          // (one round trip of waiting on the logo instead of two).
          const cached = readCachedProfile(session.user.id);
          const earlyRestore = cached ? restoreActiveSessionByUser(cached.id).catch(() => undefined) : null;
          let homeData = cached ? prefetchHomeData(cached.id) : null;

          const user = await getOrCreateProfile(
            session.user.id,
            session.user.email,
            session.user.user_metadata ?? {},
          );
          if (user) {
            rememberProfile(session.user.id, user);
            if (!cached || cached.id !== user.id) homeData = prefetchHomeData(user.id);
            setCurrentUser({ id: user.id, name: user.name });
            setNeedsOnboarding(user.needsOnboarding);
            // Restore an in-progress workout before mounting the authenticated
            // navigator, so a PWA restart returns the user to that workout.
            const early = earlyRestore && cached?.id === user.id ? await earlyRestore : undefined;
            const activeSession = early !== undefined ? early : await restoreActiveSessionByUser(user.id);
            if (activeSession) {
              setActiveSession(activeSession);
              // A forgotten workout is handled by ForgottenWorkoutHost instead.
              if (!isForgottenSession(activeSession.startedAt)) setRestoredWorkoutId(activeSession.workoutId);
            }
            // A few more ms on the logo beats Home flashing skeletons for two frames.
            if (homeData && !user.needsOnboarding) await waitAtMost(homeData, HOME_DATA_WAIT_MS);
            setAuthStatus('authenticated');
            return;
          }
        }

        if (event === 'SIGNED_OUT') {
          lastAuthUserIdRef.current = null;
          forgetCachedProfiles();
          setCurrentUser(null);
          setNeedsOnboarding(false);
          didOnboardingRedirectRef.current = false;
          setActiveSession(null);
          setRestoredWorkoutId(null);
          didRestoreWorkoutRouteRef.current = false;
          setAuthStatus('unauthenticated');
        }

        // INITIAL_SESSION with no user means logged out
        if (event === 'INITIAL_SESSION' && !session?.user) {
          setAuthStatus('unauthenticated');
        }
      } catch (err) {
        console.error('Erro ao processar sessão:', err);
        if (!booted) setAuthStatus('unauthenticated');
      } finally {
        if (!booted) {
          booted = true;
          clearTimeout(timeout);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthEvent(event, session?.user ? session : null);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [setCurrentUser, setActiveSession, setNeedsOnboarding]);

  useEffect(() => {
    if (
      authStatus !== 'authenticated'
      || !navigationReady
      || restoredWorkoutId == null
      || didRestoreWorkoutRouteRef.current
    ) {
      return;
    }

    // iOS launches the installed PWA at /home. Linking can therefore override
    // the default stack route; reset the route once after recovery.
    // Keep Home underneath so "Voltar" works from the restored workout.
    navigationRef.resetRoot({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'Workout', params: { workoutId: restoredWorkoutId } },
      ],
    });
    didRestoreWorkoutRouteRef.current = true;
  }, [authStatus, navigationReady, restoredWorkoutId, navigationRef]);

  // Onboarding is only for new accounts: if an onboarded user lands on it
  // (e.g. typing /onboarding), send them Home. Checked on every navigation.
  const redirectIfOnboardingNotNeeded = React.useCallback(() => {
    if (useAppStore.getState().needsOnboarding) return;
    if (navigationRef.getCurrentRoute()?.name === 'Onboarding') {
      navigationRef.resetRoot({ index: 0, routes: [{ name: 'Home' }] });
    }
  }, [navigationRef]);

  useEffect(() => {
    if (authStatus === 'authenticated' && navigationReady) redirectIfOnboardingNotNeeded();
  }, [authStatus, navigationReady, needsOnboarding, redirectIfOnboardingNotNeeded]);

  // New accounts start at /onboarding. Like the workout restore above, reset the
  // root once navigation is ready so the iOS PWA /home launch can't skip it.
  useEffect(() => {
    if (
      authStatus !== 'authenticated'
      || !navigationReady
      || !needsOnboarding
      || didOnboardingRedirectRef.current
    ) {
      return;
    }
    navigationRef.resetRoot({ index: 0, routes: [{ name: 'Onboarding' }] });
    didOnboardingRedirectRef.current = true;
  }, [authStatus, navigationReady, needsOnboarding, navigationRef]);

  // Download the other screens' code while the user looks at the first one,
  // so opening them is instant.
  useEffect(() => {
    if (authStatus === 'loading') return;
    return preloadWhenIdle(authStatus === 'authenticated' ? AUTHENTICATED_SCREENS : GUEST_SCREENS);
  }, [authStatus]);

  // Which guided tours the signed-in user has already seen.
  useEffect(() => {
    if (authStatus === 'authenticated' && currentUserId) void useTourStore.getState().load(currentUserId);
  }, [authStatus, currentUserId]);

  // A new student who joined a coach skips onboarding: the coach builds the program.
  const handleJoinedCoach = React.useCallback(() => {
    const { currentUser, needsOnboarding: onboarding } = useAppStore.getState();
    if (!onboarding || !currentUser) return;
    markOnboarded(currentUser.id).catch(() => {});
    setNeedsOnboarding(false);
    navigationRef.resetRoot({ index: 0, routes: [{ name: 'Home' }] });
  }, [navigationRef, setNeedsOnboarding]);

  if (authStatus === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F8F2' }}>
        <Image
          source={require('./assets/icons/icon-192.png')}
          style={{ width: 96, height: 96 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => setNavigationReady(true)}
      onStateChange={redirectIfOnboardingNotNeeded}
      linking={{
        prefixes: [],
        config: {
          screens: {
            Login: 'login',
            Signup: 'signup',
            ForgotPassword: 'forgot-password',
            Home: 'home',
            Settings: 'settings',
            Workout: 'workout/:workoutId',
            Coach: { path: 'personal', alias: ['admin'] },
            CoachStudent: 'personal/aluno/:studentId',
            CoachProgram: 'personal/aluno/:studentId/treino',
            StudentProgress: 'personal/aluno/:studentId/progresso',
            MyWorkout: 'my-workout',
            Progress: 'progress',
            Onboarding: 'onboarding',
          },
        },
      }}
      theme={
        scheme === 'dark'
          ? {
            ...DarkTheme,
            colors: {
              ...DarkTheme.colors,
              background: colors.backgroundDark,
              primary: colors.accent,
              card: colors.surfaceDark,
              text: colors.textPrimaryDark,
            },
          }
          : {
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              background: colors.backgroundLight,
              primary: colors.accent,
              card: colors.surfaceLight,
              text: colors.textPrimary,
            },
          }
      }
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      <Suspense fallback={null}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {authStatus === 'authenticated' ? (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen
                name="Workout"
                component={WorkoutScreen}
                initialParams={activeSession ? { workoutId: activeSession.workoutId } : undefined}
              />
              <Stack.Screen name="Coach" component={CoachScreen} />
              <Stack.Screen name="CoachStudent" component={CoachStudentScreen} />
              <Stack.Screen name="CoachProgram" component={MyWorkoutScreen} />
              <Stack.Screen name="StudentProgress" component={ProgressScreen} />
              <Stack.Screen name="MyWorkout" component={MyWorkoutScreen} />
              <Stack.Screen name="Progress" component={ProgressScreen} />
              <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ gestureEnabled: false }} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Signup" component={SignupScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            </>
          )}
        </Stack.Navigator>
      </Suspense>
      <PendingInviteHost
        enabled={authStatus === 'authenticated' && navigationReady}
        onJoined={handleJoinedCoach}
      />
      <ForgottenWorkoutHost enabled={authStatus === 'authenticated' && navigationReady && !needsOnboarding} />
      {authStatus === 'authenticated' && <GuidedTour />}
      <AlertHost />
    </NavigationContainer>
  );
}
