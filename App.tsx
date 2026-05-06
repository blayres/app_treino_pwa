import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import AdminScreen from './src/screens/AdminScreen';
import SignupScreen from './src/screens/SignupScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';

import { colors } from './src/theme/colors';
import { initDatabase } from './src/db';
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
  Workout: { workoutId: number };
  Admin: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const scheme = useColorScheme();
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const currentUser = useAppStore((s) => s.currentUser);
  const [isReady, setIsReady] = useState(false);

  // Single auth initializer — uses onAuthStateChange as the source of truth.
  // It fires immediately with INITIAL_SESSION on mount, so we wait for it
  // before rendering the navigator (ensures deep links like /admin resolve
  // with the correct auth state already set).
  useEffect(() => {
    if (backendMode !== 'supabase') {
      // Local/SQLite mode — init DB then check session the old way
      (async () => {
        try {
          await initDatabase();
          const user = await getSessionUser();
          if (user) {
            setCurrentUser(user);
            await closeStaleSessions(user.id);
            const session = await restoreActiveSessionByUser(user.id);
            if (session) setActiveSession(session);
          }
        } catch (error: any) {
          console.error('Erro ao iniciar app:', error);
        } finally {
          setIsReady(true);
        }
      })();
      return;
    }

    // Safety net: if onAuthStateChange never fires (network issue, cold start
    // timeout), unblock the UI after 5 seconds so the app doesn't hang forever.
    const timeout = setTimeout(() => setIsReady(true), 5000);

    let booted = false;

    const handleAuthEvent = async (
      event: string,
      session: { user: { id: string; email?: string; user_metadata: Record<string, any> } } | null,
    ) => {
      try {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          const user = await getOrCreateProfile(
            session.user.id,
            session.user.email,
            session.user.user_metadata ?? {},
          );
          if (user) {
            setCurrentUser(user);
            if (!booted) {
              await closeStaleSessions(user.id);
              const activeSession = await restoreActiveSessionByUser(user.id);
              if (activeSession) setActiveSession(activeSession);
            }
          }
        }

        if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setActiveSession(null);
        }
      } catch (err) {
        console.error('Erro ao processar sessão:', err);
      } finally {
        if (!booted) {
          booted = true;
          clearTimeout(timeout);
          setIsReady(true);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Kick off async work but don't block — onAuthStateChange doesn't await callbacks.
      // isReady is set inside handleAuthEvent's finally block after the async work completes.
      handleAuthEvent(event, session?.user ? session : null);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [setCurrentUser, setActiveSession]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: scheme === 'dark' ? colors.backgroundDark : colors.backgroundLight }}>
        <ActivityIndicator size="large" color={colors.accent} />
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
            Workout: 'workout/:workoutId',
            Admin: 'admin',
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

      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {currentUser ? (
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
    </NavigationContainer>
  );
}

