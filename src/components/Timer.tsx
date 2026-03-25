import React from 'react';
import { Text, View } from 'react-native';
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
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Duração do treino</Text>
      <Text style={styles.time}>{formatDuration(seconds)}</Text>
    </View>
  );
}

