import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { useI18n } from '../i18n';
import {
  getWorkoutsByUser,
  getWorkoutExercises,
  getCachedWorkoutsByUser,
  getCachedWorkoutExercises,
} from '../services/workoutService';
import type { WorkoutWithLastDone } from '../services/types';
import { Skeleton } from '../components/Skeleton';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { styles } from './MyWorkoutScreen.styles';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'MyWorkout'>;

export default function MyWorkoutScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useAppStore((s) => s.currentUser);
  const { t } = useI18n();

  const [workouts, setWorkouts] = useState<WorkoutWithLastDone[]>(() => {
    // Seed from cache so the screen is never blank on mount
    if (currentUser) {
      return getCachedWorkoutsByUser(currentUser.id) ?? [];
    }
    return [];
  });
  const [exerciseCounts, setExerciseCounts] = useState<Record<number, number>>(() => {
    // Seed exercise counts from cache too
    if (currentUser) {
      const cached = getCachedWorkoutsByUser(currentUser.id) ?? [];
      const counts: Record<number, number> = {};
      cached.forEach((w) => {
        const exs = getCachedWorkoutExercises(w.id);
        if (exs !== null) counts[w.id] = exs.length;
      });
      return counts;
    }
    return {};
  });
  // Only show the skeleton on the very first load — when we have no data at all
  const [isFirstLoad, setIsFirstLoad] = useState(workouts.length === 0);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await getWorkoutsByUser(currentUser.id);
      setWorkouts(data);

      const counts: Record<number, number> = {};
      await Promise.all(
        data.map(async (w) => {
          try {
            const exs = await getWorkoutExercises(w.id);
            counts[w.id] = exs.length;
          } catch {
            counts[w.id] = 0;
          }
        }),
      );
      setExerciseCounts(counts);
    } catch (err: any) {
      Alert.alert(t.saveError, err?.message ?? t.genericError);
    } finally {
      setIsFirstLoad(false);
    }
  }, [currentUser, t]);

  useFocusEffect(
    useCallback(() => {
      // Stale-while-revalidate: show cached data immediately, refresh in background.
      // EditWorkout / AddTrainingDay already invalidate the cache on save.
      loadData();
    }, [loadData]),
  );

  const isLoading = isFirstLoad;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerActions}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
            <Text style={styles.backLabel}>{t.back}</Text>
          </Pressable>
          <LanguageSwitcher />
        </View>
        <Text style={styles.screenTitle}>{t.myWorkoutOverviewTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ── Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.workoutsThisWeek}</Text>

          <View style={styles.cardContent}>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <View key={i} style={styles.skeletonRow}>
                  <View style={styles.skeletonInfo}>
                    <Skeleton width={60} height={10} style={{ marginBottom: 6 }} />
                    <Skeleton width="75%" height={14} style={{ marginBottom: 4 }} />
                    <Skeleton width={80} height={10} />
                  </View>
                </View>
              ))
            ) : (
              workouts.map((w) => (
                <Pressable
                  key={w.id}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => navigation.navigate('EditWorkout', { workoutId: w.id })}
                >
                  <View style={styles.rowInfo}>
                    <Text style={styles.dayLabel}>{t.dayLabels[w.day_of_week]}</Text>
                    <Text style={styles.workoutTitle}>{w.title}</Text>
                    <Text style={styles.exerciseCount}>
                      {t.exerciseCount(exerciseCounts[w.id] ?? 0)}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))
            )}
          </View>
        </View>

        {/* ── Add training day ── */}
        {!isLoading && (
          <Pressable
            style={({ pressed }) => [styles.addDayButton, pressed && styles.addDayButtonPressed]}
            onPress={() => navigation.navigate('AddTrainingDay')}
          >
            <Text style={styles.addDayButtonLabel}>{t.addTrainingDay}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
