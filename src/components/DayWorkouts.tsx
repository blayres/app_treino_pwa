import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { styles } from './DayWorkouts.styles';
import { useAppStore } from '../store/useAppStore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { WorkoutWithLastDone } from '../services/types';
import { Skeleton } from './Skeleton';
import {
  getWorkoutsByUser,
  getWorkoutExercises,
  getExerciseLoadsByUser,
  getCachedWorkoutsByUser,
} from '../services/workoutService';
import { prefetchWhenIdle } from '../utils/idle';
import { useI18n } from '../i18n';
import { relativeDay } from '../utils/date';

type Props = {
  userId: number;
  refreshKey?: number;
};

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

function InProgressBadge({ label }: { label: string }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.inProgressBadge}>
      <Animated.View style={[styles.inProgressDot, { opacity: pulse }]} />
      <Text style={styles.inProgressText}>{label}</Text>
    </View>
  );
}

export function DayWorkouts({ userId, refreshKey }: Props) {
  const navigation = useNavigation<Navigation>();
  const { t } = useI18n();
  const activeSession = useAppStore(state => state.activeSession);
  const runningWorkoutId = activeSession?.isRunning ? activeSession.workoutId : null;
  // Last known week (usually fetched during boot): drawn on the first frame.
  const [workouts, setWorkouts] = useState<WorkoutWithLastDone[]>(() => getCachedWorkoutsByUser(userId) ?? []);
  const [isLoading, setIsLoading] = useState(() => getCachedWorkoutsByUser(userId) === null);

  const formatRelativeDate = (dateStr: string): string => {
    const ago = relativeDay(new Date(dateStr), new Date());
    if (ago.unit === 'today') return t.doneToday;
    if (ago.unit === 'days') return ago.value === 1 ? t.done1Day : t.doneDays(ago.value);
    if (ago.unit === 'weeks') return ago.value === 1 ? t.done1Week : t.doneWeeks(ago.value);
    return ago.value === 1 ? t.done1Month : t.doneMonths(ago.value);
  };

  // Keep previous content visible while refreshing (no skeleton → content
  // layout shift); only the very first load shows the skeleton.
  const hasDataRef = useRef(!isLoading);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasDataRef.current) setIsLoading(true);
      try {
        const workoutsWithLastDone = await getWorkoutsByUser(userId);
        if (cancelled) return;
        setWorkouts(workoutsWithLastDone);
        hasDataRef.current = true;
      } catch (err) {
        console.warn('Falha ao carregar treinos:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  // Warm each workout's exercises and the loads in the background, so opening
  // a workout shows its list at once instead of a skeleton.
  const workoutIdsKey = workouts.map((w) => w.id).join(',');
  useEffect(() => {
    if (!workoutIdsKey) return;
    return prefetchWhenIdle(async (isCancelled) => {
      await getExerciseLoadsByUser(userId).catch(() => {});
      for (const id of workoutIdsKey.split(',').map(Number)) {
        if (isCancelled()) return;
        await getWorkoutExercises(id).catch(() => {});
      }
    });
  }, [userId, workoutIdsKey]);

  if (isLoading) {
    return <DayWorkoutsSkeleton />;
  }

  const handleOpenWorkout = (workoutId: number, workoutTitle: string) => {
    // Navigate at once: the workout screen shows cached data or its skeleton.
    navigation.navigate('Workout', { workoutId, workoutTitle });
  };

  return (
    <View>
      {workouts.map(item => {
        const isRest = item.title.toLowerCase().includes('repouso');
        const isInProgress = !isRest && item.id === runningWorkoutId;

        return (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.item,
              isInProgress && styles.itemInProgress,
              isRest ? styles.itemRest : (pressed && styles.itemPressed),
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              isInProgress
                ? `${t.dayLabels[item.day_of_week]}, ${item.title}, ${t.workoutInProgress}`
                : undefined
            }
            onPress={() =>
              !isRest &&
              handleOpenWorkout(
                item.id,
                item.title,
              )
            }
            disabled={isRest}
          >
            <View>
              <View style={styles.dayLabelRow}>
                <Text style={styles.dayLabel}>{t.dayLabels[item.day_of_week]}</Text>
                {isInProgress && <InProgressBadge label={t.workoutInProgress} />}
              </View>
              <Text style={[styles.title, isRest && styles.titleRest]}>{item.title}</Text>
            </View>
            <Text style={styles.lastDone}>
              {!isRest && item.last_done ? formatRelativeDate(item.last_done) : ' '}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}


/** Same cards as the real list (weekday + title), with skeleton text. */
function DayWorkoutsSkeleton() {
  return (
    <View accessibilityLabel="…">
      {[...Array(5)].map((_, i) => (
        <View key={i} style={styles.item}>
          <Skeleton width={70} height={12} style={{ marginVertical: 2 }} />
          <Skeleton width="65%" height={16} style={{ marginTop: 8 }} />
          <Skeleton width={90} height={12} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}
