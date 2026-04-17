import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { styles } from './DayWorkouts.styles';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { getWorkoutsByUser } from '../services/workoutService';
import type { WorkoutWithLastDone } from '../services/types';
import { Skeleton } from './Skeleton';

type Props = {
  userId: number;
  refreshKey?: number;
};

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

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
  if (diffDays === 1) return 'feito há 1 dia';
  if (diffDays < 7) return `feito há ${diffDays} dias`;
  if (diffWeeks === 1) return 'feito há 1 semana';
  if (diffWeeks < 4) return `feito há ${diffWeeks} semanas`;
  if (diffMonths === 1) return 'feito há 1 mês';
  return `feito há ${diffMonths} meses`;
}

export function DayWorkouts({ userId, refreshKey }: Props) {
  const navigation = useNavigation<Navigation>();
  const [workouts, setWorkouts] = useState<WorkoutWithLastDone[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
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
          <View
            key={i}
            style={{
              paddingVertical: 5,
              paddingHorizontal: 0,
              borderRadius: 15,
              marginBottom: 0,
            }}
          >
            <Skeleton width={350} height={60} />
          </View>
        ))}
      </View>
    );
  }

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

