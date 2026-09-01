import React, { memo, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { styles } from '../screens/WorkoutScreen.styles';
import { CircularCheckbox } from './CircularCheckbox';
import { ExerciseLibraryCard } from './ExerciseLibraryCard';
import type { Exercise } from '../services/types';
import { useI18n } from '../i18n';

type Props = {
  exerciseRowId: number;
  exercise: Exercise;
  isSessionActive: boolean;
  isCompleted: boolean;
  loadNormal: string;
  loadProgression: string;
  onToggle: () => void;
  onChangeNormal: (text: string) => void;
  onChangeProgression: (text: string) => void;
  onFocus: () => void;
};

function restLabel(restSecs: number, minuteShort: string, secondShort: string): string {
  const restMin = Math.floor(restSecs / 60);
  const restRemSec = restSecs % 60;
  if (restMin > 0 && restRemSec > 0) return `${restMin}${minuteShort} ${restRemSec}${secondShort}`;
  if (restMin > 0) return `${restMin}${minuteShort}`;
  return `${restRemSec}${secondShort}`;
}

export const ExerciseRow = memo(function ExerciseRow({
  exerciseRowId,
  exercise,
  isSessionActive,
  isCompleted,
  loadNormal,
  loadProgression,
  onToggle,
  onChangeNormal,
  onChangeProgression,
  onFocus,
}: Props) {
  const scheme = exercise.scheme;
  const [mainScheme, progression] = scheme.split(' e ');
  const { t } = useI18n();

  const [normalSelection, setNormalSelection] = useState<{ start: number; end: number } | undefined>();
  const [progressionSelection, setProgressionSelection] = useState<{ start: number; end: number } | undefined>();

  return (
    <Pressable
      style={[
        styles.exerciseRow,
        isCompleted && styles.exerciseRowActive,
      ]}
    >
      {isSessionActive ? (
        <View style={{ marginTop: 2 }}>
          <CircularCheckbox checked={isCompleted} onToggle={onToggle} />
        </View>
      ) : (
        <View style={styles.checkboxPlaceholder} />
      )}

      <Pressable
        style={styles.exerciseInfo}
        onPress={isSessionActive ? onToggle : undefined}
      >
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.scheme}>
          {mainScheme}
          {progression ? ` · ${progression}` : ''}
        </Text>
        <Text style={styles.rest}>{t.restInterval(restLabel(exercise.rest_seconds, t.minuteShort, t.secondShort))}</Text>
        {exercise.tip ? (
          <Text style={styles.tip}>{exercise.tip}</Text>
        ) : null}
        {exercise.library ? (
          <ExerciseLibraryCard library={exercise.library} />
        ) : null}
      </Pressable>

      <View style={styles.loadColumn}>
        <Text style={styles.loadLabel}>{t.loadKg}</Text>
        <TextInput
          style={styles.loadInput}
          keyboardType="decimal-pad"
          value={loadNormal}
          onChangeText={onChangeNormal}
          onFocus={() => {
            const end = loadNormal.length;
            setNormalSelection({ start: end, end });
            onFocus();
          }}
          onSelectionChange={({ nativeEvent }) => {
            setNormalSelection(nativeEvent.selection);
          }}
          selection={normalSelection}
          placeholder={t.loadPlaceholder}
        />
        <Text style={styles.loadLabelProgression}>{t.progression}</Text>
        <TextInput
          style={styles.loadInput}
          keyboardType="decimal-pad"
          value={loadProgression}
          onChangeText={onChangeProgression}
          onFocus={() => {
            const end = loadProgression.length;
            setProgressionSelection({ start: end, end });
            onFocus();
          }}
          onSelectionChange={({ nativeEvent }) => {
            setProgressionSelection(nativeEvent.selection);
          }}
          selection={progressionSelection}
          placeholder={t.loadPlaceholder}
        />
      </View>
    </Pressable>
  );
});
