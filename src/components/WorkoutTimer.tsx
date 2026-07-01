import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { styles } from './Timer.styles';

type Props = {
  startedAt: string; // ISO string
};

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Self-contained timer that owns its own interval.
 * Renders independently — changing its display never re-renders
 * the parent WorkoutScreen or the exercise FlatList.
 */
export const WorkoutTimer = React.memo(function WorkoutTimer({ startedAt }: Props) {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(() =>
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t.workoutDuration}</Text>
      <Text style={styles.time}>{formatDuration(seconds)}</Text>
    </View>
  );
});
