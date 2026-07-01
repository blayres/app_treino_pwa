import React from 'react';
import { Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { styles } from './Timer.styles';

type TimerProps = {
  seconds: number;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function Timer({ seconds }: TimerProps) {
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t.workoutDuration}</Text>
      <Text style={styles.time}>{formatDuration(seconds)}</Text>
    </View>
  );
}

