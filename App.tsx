import 'react-native-gesture-handler';
import React, { useEffect, useState, Suspense } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme, View, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Critical screens — loaded eagerly (on the initial render path)
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import { lazyScreen } from './src/navigation/lazyScreen';
import type { RootStackParamList } from './src/navigation/types';

// Non-critical screens — lazy loaded after first paint
const WorkoutScreen = lazyScreen(() => import('./src/screens/WorkoutScreen'));
const AdminScreen = lazyScreen(() => import('./src/screens/AdminScreen'));
const SignupScreen = lazyScreen(() => import('./src/screens/SignupScreen'));
const ForgotPasswordScreen = lazyScreen(() => import('./src/screens/ForgotPasswordScreen'));
const MyWorkoutScreen = lazyScreen(() => import('./src/screens/MyWorkoutScreen'));
const SettingsScreen = lazyScreen(() => import('./src/screens/SettingsScreen'));
const EditWorkoutScreen = lazyScreen(() => import('./src/screens/EditWorkoutScreen'));
const AddTrainingDayScreen = lazyScreen(() => import('./src/screens/AddTrainingDayScreen'));

import { colors } from './src/theme/colors';
import { useAppStore } from './src/store/useAppStore';
import { closeStaleSessions, restoreActiveSessionByUser } from './src/services/sessionService';
import { getSessionUser, getOrCreateProfile } from './src/services/authService';
import { backendMode } from './src/services/backendMode';
import { supabase } from './src/services/supabaseClient';

export type { RootStackParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const scheme = useColorScheme();
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  // 'loading'         — waiting for the first auth event, show spinner
  // 'authenticated'   — session confirmed, show Home stack
  // 'unauthenticated' — no session, show Login stack
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const lastAuthUserIdRef = React.useRef<string | null>(null);

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
            await closeStaleSessions(user.id);
            const session = await restoreActiveSessionByUser(user.id);
            if (session) setActiveSession(session);
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
              Promise.all([
                closeStaleSessions(user.id),
                restoreActiveSessionByUser(user.id),
              ]).then(([, activeSession]) => {
                if (activeSession) setActiveSession(activeSession);
              }).catch(err => console.warn('Boot cleanup error:', err));
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

  if (authStatus === 'loading') {
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
            Admin: 'admin',
            MyWorkout: 'my-workout',
            EditWorkout: 'my-workout/edit/:workoutId',
            AddTrainingDay: 'my-workout/add',
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
              <Stack.Screen name="Workout" component={WorkoutScreen} />
              <Stack.Screen name="Admin" component={AdminScreen} />
              <Stack.Screen name="MyWorkout" component={MyWorkoutScreen} />
              <Stack.Screen name="EditWorkout" component={EditWorkoutScreen} />
              <Stack.Screen name="AddTrainingDay" component={AddTrainingDayScreen} />
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
