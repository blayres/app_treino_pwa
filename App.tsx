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

import { colors } from './src/theme/colors';
import { getDb, initDatabase } from './src/db';
import { useAppStore } from './src/store/useAppStore';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Workout: { workoutId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const scheme = useColorScheme();

  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const setActiveSession = useAppStore((s) => s.setActiveSession);

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      await initDatabase();
      const db = await getDb();

      await db.runAsync(`
        UPDATE workout_sessions
        SET ended_at = started_at, duration_seconds = 0, completed = 0
        WHERE ended_at IS NULL
        AND datetime(started_at) < datetime('now', '-4 hours');
      `);

      // RESTORE USER
      const lastUserId = localStorage.getItem('lastUserId');

      const user = lastUserId
        ? await db.getFirstAsync<{ id: number; name: string }>(
          `SELECT * FROM users WHERE id = ?;`,
          Number(lastUserId)
        )
        : null;

      if (user) {
        setCurrentUser(user);
      }

      // RESTORE ACTIVE SESSION
      if (user) {
        const session = await db.getFirstAsync<{
          id: number;
          workout_id: number;
          started_at: string;
        }>(
          `SELECT * FROM workout_sessions
            WHERE ended_at IS NULL AND user_id = ?
            ORDER BY started_at DESC
            LIMIT 1;`,
          user.id
        );

        if (session) {
          setActiveSession({
            sessionId: session.id,
            workoutId: session.workout_id,
            startedAt: session.started_at,
            isRunning: true,
          });
        }
      }

      setIsReady(true);
    })();
  }, []);

  const currentUser = useAppStore((s) => s.currentUser);

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            scheme === 'dark'
              ? colors.backgroundDark
              : colors.backgroundLight,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer
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
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Workout" component={WorkoutScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
