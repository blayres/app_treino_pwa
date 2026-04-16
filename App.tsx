import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme, View, ActivityIndicator, Alert } from 'react-native';
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
import { getSessionUser } from './src/services/authService';

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
  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        const user = await getSessionUser();
        if (user) {
          setCurrentUser(user);
          await closeStaleSessions(user.id);
          const session = await restoreActiveSessionByUser(user.id);
          if (session) {
            setActiveSession(session);
          }
        }
      } catch (error: any) {
        console.error('Erro ao iniciar app:', error);
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(error?.message ?? 'Falha ao inicializar sessão e dados.');
        }
      } finally {
        setIsReady(true);
      }
    })();
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
            Home: '',
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

      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={currentUser ? 'Home' : 'Login'}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Workout" component={WorkoutScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

