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

const dayLabels: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
  7: 'Domingo',
};

export function DayWorkouts({ userId }: Props) {
  const navigation = useNavigation<Navigation>();
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const rows = await db.getAllAsync<WorkoutRow>(
        `SELECT * FROM workouts
         WHERE user_id = ?
         ORDER BY day_of_week ASC;`,
        userId,
      );
      setWorkouts(rows);
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
        </Pressable>
      ))}
    </View>
  );
}

