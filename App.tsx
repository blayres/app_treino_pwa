import 'react-native-gesture-handler';
import React, { useEffect, useState, lazy, Suspense } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  type NavigationContainerRef,
  type LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme, View, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Critical screens — loaded eagerly (on the initial render path)
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

// Non-critical screens — lazy loaded after first paint
const WorkoutScreen = lazy(() => import('./src/screens/WorkoutScreen'));
const AdminScreen = lazy(() => import('./src/screens/AdminScreen'));
const SignupScreen = lazy(() => import('./src/screens/SignupScreen'));
const ForgotPasswordScreen = lazy(() => import('./src/screens/ForgotPasswordScreen'));

import { colors } from './src/theme/colors';
import { useAppStore } from './src/store/useAppStore';
import { closeStaleSessions, restoreActiveSessionByUser } from './src/services/sessionService';
import { getSessionUser, getOrCreateProfile } from './src/services/authService';
import { backendMode } from './src/services/backendMode';
import { supabase } from './src/services/supabaseClient';

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  Home: undefined;
  Workout: { workoutId: number; workoutTitle?: string };
  Admin: undefined;
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      Login: 'login',
      Signup: 'signup',
      ForgotPassword: 'forgot-password',
      Home: 'home',
      Workout: 'workout/:workoutId',
      Admin: 'admin',
    },
  },
};

const lightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.backgroundLight,
    primary: colors.accent,
    card: colors.surfaceLight,
    text: colors.textPrimary,
  },
};

const darkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.backgroundDark,
    primary: colors.accent,
    card: colors.surfaceDark,
    text: colors.textPrimaryDark,
  },
};

const stackScreenOptions = { headerShown: false };

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const scheme = useColorScheme();
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const activeSession = useAppStore((s) => s.activeSession);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const navigationRef = React.useRef<NavigationContainerRef<RootStackParamList>>(null);
  // 'loading'         — waiting for the first auth event, show spinner
  // 'authenticated'   — session confirmed, show Home stack
  // 'unauthenticated' — no session, show Login stack
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [hasHydrated, setHasHydrated] = useState(
    () => useAppStore.persist.hasHydrated(),
  );
  const lastAuthUserIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.getElementById('initial-splash')?.remove();
    }
  }, []);

  useEffect(() => {
    if (useAppStore.persist.hasHydrated()) {
      setHasHydrated(true);
      return;
    }

    return useAppStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !hasHydrated) return;

    const { currentUser, activeWorkout, activeSession } = useAppStore.getState();
    const isWorkoutForCurrentUser =
      currentUser != null && activeWorkout?.userId === currentUser.id;
    const workoutId = isWorkoutForCurrentUser
      ? activeWorkout.workoutId
      : activeSession?.workoutId;
    const shouldRestoreWorkout = Boolean(
      (isWorkoutForCurrentUser && activeWorkout?.screen === 'Workout')
      || activeSession?.isRunning,
    );

    if (!shouldRestoreWorkout || typeof workoutId !== 'number') return;

    const currentRoute = navigationRef.current?.getCurrentRoute();
    if (currentRoute?.name === 'Workout' && currentRoute.params?.workoutId === workoutId) return;

    navigationRef.current?.navigate('Workout', {
      workoutId,
      workoutTitle: isWorkoutForCurrentUser
        ? activeWorkout?.workoutTitle ?? undefined
        : undefined,
    });
  }, [activeSession, authStatus, hasHydrated]);

  useEffect(() => {
    if (backendMode !== 'supabase') {
      (async () => {
        try {
          const { initDatabase } = await import('./src/db');
          await initDatabase();

          const user = await getSessionUser();
          if (user) {
            setCurrentUser(user);
            await closeStaleSessions(user.id);
            const session = await restoreActiveSessionByUser(user.id);
            if (session) setActiveSession(session);
            setAuthStatus('authenticated');
          } else {
            setAuthStatus('unauthenticated');
          }
        } catch (error: unknown) {
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
      session: {
        user: {
          id: string;
          email?: string;
          user_metadata: Record<string, unknown>;
        };
      } | null,
    ) => {
      try {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          if (lastAuthUserIdRef.current === session.user.id) {
            return;
          }

          lastAuthUserIdRef.current = session.user.id;

          const user = await getOrCreateProfile(
            session.user.id,
            session.user.email,
            session.user.user_metadata ?? {},
          );
          if (user) {
            setCurrentUser(user);
            // Render home immediately — don't block on session cleanup
            setAuthStatus('authenticated');

            if (!booted) {
              // Run non-critical boot work after first paint
              (async () => {
                try {
                  await closeStaleSessions(user.id);
                  const activeSession = await restoreActiveSessionByUser(user.id);
                  setActiveSession(activeSession);
                } catch (err) {
                  console.warn('Boot cleanup error:', err);
                }
              })();
            }
            return;
          }
        }

        if (event === 'SIGNED_OUT') {
          lastAuthUserIdRef.current = null;
          setCurrentUser(null);
          setActiveSession(null);
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
  }, [setCurrentUser, setActiveSession]);

  if (authStatus === 'loading' || !hasHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F8F2' }}>
        <Image
          source={require('./assets/favicon.png')}
          style={{ width: 96, height: 96 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={scheme === 'dark' ? darkTheme : lightTheme}
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      <Suspense fallback={null}>
        <Stack.Navigator screenOptions={stackScreenOptions}>
          {authStatus === 'authenticated' ? (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Workout" component={WorkoutScreen} />
              <Stack.Screen name="Admin" component={AdminScreen} />
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
    </NavigationContainer>
  );
}
