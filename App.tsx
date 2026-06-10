import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme, View, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import AdminScreen from './src/screens/AdminScreen';
import SignupScreen from './src/screens/SignupScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';

import { colors } from './src/theme/colors';import { initDatabase } from './src/db';
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
  // 'loading'         — waiting for the first auth event, show spinner
  // 'authenticated'   — session confirmed, show Home stack
  // 'unauthenticated' — no session, show Login stack
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    if (backendMode !== 'supabase') {
      (async () => {
        try {
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
            // Set status AFTER setCurrentUser so they land in the same render
            setAuthStatus('authenticated');
            return;
          }
        }

        if (event === 'SIGNED_OUT') {
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
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
    </NavigationContainer>
  );
}

