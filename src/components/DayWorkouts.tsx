import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { styles } from './DayWorkouts.styles';
import { getDb, WorkoutRow } from '../db';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = {
  userId: number;
};

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

type WorkoutWithLastDone = WorkoutRow & {
  last_done: string | null;
};

const dayLabels: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
  7: 'Domingo',
};

function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 60) return 'feito hoje';
  if (diffHours < 24) return 'feito hoje';
  if (diffDays === 1) return 'feitohá 1 dia';
  if (diffDays < 7) return `feito há ${diffDays} dias`;
  if (diffWeeks === 1) return 'feito há 1 semana';
  if (diffWeeks < 4) return `feito há ${diffWeeks} semanas`;
  if (diffMonths === 1) return 'feito há 1 mês';
  return `feito há ${diffMonths} meses`;
}

export function DayWorkouts({ userId }: Props) {
  const navigation = useNavigation<Navigation>();
  const [workouts, setWorkouts] = useState<WorkoutWithLastDone[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDb();

      const rows = await db.getAllAsync<WorkoutRow>(
        `SELECT * FROM workouts
         WHERE user_id = ?
         ORDER BY day_of_week ASC;`,
        userId,
      );

      const lastDoneRows = await db.getAllAsync<{ workout_id: number; last_done: string }>(
        `SELECT workout_id, MAX(ended_at) as last_done
         FROM workout_sessions
         WHERE user_id = ? AND completed = 1
         GROUP BY workout_id;`,
        userId,
      );

      const lastDoneMap: Record<number, string> = {};
      lastDoneRows.forEach(row => {
        lastDoneMap[row.workout_id] = row.last_done;
      });

      const workoutsWithLastDone: WorkoutWithLastDone[] = rows.map(w => ({
        ...w,
        last_done: lastDoneMap[w.id] ?? null,
      }));

      setWorkouts(workoutsWithLastDone);
    })();
  }, [userId]);

  return (
    <View>
      {workouts.map(item => (
        <Pressable
          key={item.id}
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          onPress={() => navigation.navigate('Workout', { workoutId: item.id })}
        >
          <View>
            <Text style={styles.dayLabel}>{dayLabels[item.day_of_week]}</Text>
            <Text style={styles.title}>{item.title}</Text>
          </View>
          {item.last_done ? (
            <Text style={styles.lastDone}>{formatRelativeDate(item.last_done)}</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

