import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { styles } from './DayWorkouts.styles';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { WorkoutWithLastDone } from '../services/types';
import { Skeleton } from './Skeleton';
import {
  getWorkoutsByUser,
  getWorkoutExercises,
  getExerciseLoadsByUser,
} from '../services/workoutService';
import { useI18n } from '../i18n';

type Props = {
  userId: number;
  refreshKey?: number;
};

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

function getParisDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateKeyToUTC(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function diffCalendarDaysInParis(from: Date, to: Date): number {
  const fromKey = getParisDateKey(from);
  const toKey = getParisDateKey(to);

  const fromUtc = dateKeyToUTC(fromKey);
  const toUtc = dateKeyToUTC(toKey);

  return Math.floor((toUtc.getTime() - fromUtc.getTime()) / (1000 * 60 * 60 * 24));
}

export function DayWorkouts({ userId, refreshKey }: Props) {
  const navigation = useNavigation<Navigation>();
  const { t } = useI18n();
  const [workouts, setWorkouts] = useState<WorkoutWithLastDone[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const formatRelativeDate = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);

    const diffDays = diffCalendarDaysInParis(date, now);
    const diffWeeks = Math.floor(diffDays / 7);

    const nowKey = getParisDateKey(now);
    const dateKey = getParisDateKey(date);

    const [nowYear, nowMonth] = nowKey.split('-').map(Number);
    const [dateYear, dateMonth] = dateKey.split('-').map(Number);

    const diffMonths = (nowYear - dateYear) * 12 + (nowMonth - dateMonth);

    if (diffDays <= 0) return t.doneToday;
    if (diffDays === 1) return t.done1Day;
    if (diffDays < 7) return t.doneDays(diffDays);
    if (diffWeeks === 1) return t.done1Week;
    if (diffMonths < 1) return t.doneWeeks(diffWeeks);
    if (diffMonths === 1) return t.done1Month;

    return t.doneMonths(diffMonths);
  };

  useEffect(() => {
    (async () => {
      // Don't set isLoading=true if we already have data — keep previous content
      // visible during refresh to eliminate the skeleton→content layout shift (CLS)
      if (workouts.length === 0) setIsLoading(true);
      try {
        const workoutsWithLastDone = await getWorkoutsByUser(userId);
        setWorkouts(workoutsWithLastDone);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [userId, refreshKey]);

  if (isLoading) {
    return (
      <View>
        {[...Array(5)].map((_, i) => (
          <View key={i} style={{ marginBottom: 8 }}>
            <Skeleton width="100%" height={80} />
          </View>
        ))}
      </View>
    );
  }

  const handleOpenWorkout = async (
    workoutId: number,
    workoutTitle: string,
  ) => {
    try {
      await Promise.all([
        getWorkoutExercises(workoutId),
        getExerciseLoadsByUser(userId),
      ]);
    } catch {
      // ignora erros, a tela busca novamente se necessário
    }

    navigation.navigate('Workout', {
      workoutId,
      workoutTitle,
    });
  };

  return (
    <View>
      {workouts.map(item => {
        const isRest = item.title.toLowerCase().includes('repouso');

        return (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.item,
              isRest ? styles.itemRest : (pressed && styles.itemPressed),
            ]}
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
              <Text style={styles.dayLabel}>{t.dayLabels[item.day_of_week]}</Text>
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

