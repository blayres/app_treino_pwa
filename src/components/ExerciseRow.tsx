import React, { memo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { styles } from '../screens/WorkoutScreen.styles';
import { CircularCheckbox } from './CircularCheckbox';
import { ExerciseLibraryCard } from './ExerciseLibraryCard';
import type { Exercise } from '../services/types';
import { useI18n } from '../i18n';
import { formatRest } from '../utils/date';

export type LoadField = 'normal' | 'progression';

type Props = {
  exercise: Exercise;
  index: number;
  /** A session of this workout is running: show the checkbox. */
  isSessionActive: boolean;
  isCompleted: boolean;
  loadNormal: string;
  loadProgression: string;
  /** Stable callbacks (useCallback in the screen) so memo can skip rows. */
  onToggle: (exerciseId: number) => void;
  onChangeLoad: (exerciseId: number, text: string, field: LoadField) => void;
  onLoadFocus: (index: number) => void;
  onLoadBlur: (exerciseId: number) => void;
};

/**
 * One exercise in the workout screen: name, scheme, rest, coach notes,
 * animation, and the load/progression inputs. Memoised: typing in one row
 * doesn't re-render the others.
 */
export const ExerciseRow = memo(function ExerciseRow({
  exercise,
  index,
  isSessionActive,
  isCompleted,
  loadNormal,
  loadProgression,
  onToggle,
  onChangeLoad,
  onLoadFocus,
  onLoadBlur,
}: Props) {
  const { t } = useI18n();
  const [focused, setFocused] = useState<LoadField | null>(null);
  const inputs = useRef<Record<LoadField, TextInput | null>>({ normal: null, progression: null });
  const values = useRef({ normal: loadNormal, progression: loadProgression });
  values.current = { normal: loadNormal, progression: loadProgression };

  const [mainScheme, progressionScheme] = exercise.scheme.split(' e ');
  const toggle = () => onToggle(exercise.id);

  const handleFocus = (field: LoadField) => {
    setFocused(field);
    onLoadFocus(index);
    // Safari puts the caret where the user tapped; editing short numbers from
    // the end is faster. Read the live value, only on focus (never while typing).
    requestAnimationFrame(() => {
      const position = values.current[field].length;
      inputs.current[field]?.setNativeProps({ selection: { start: position, end: position } });
    });
  };

  const handleBlur = () => {
    setFocused(null);
    onLoadBlur(exercise.id);
  };

  const loadInput = (field: LoadField, value: string) => (
    <TextInput
      ref={(input) => {
        inputs.current[field] = input;
      }}
      style={styles.loadInput}
      keyboardType="decimal-pad"
      value={value}
      onChangeText={(text) => onChangeLoad(exercise.id, text, field)}
      onFocus={() => handleFocus(field)}
      onBlur={handleBlur}
      placeholder={focused === field ? '' : t.loadPlaceholder}
      accessibilityLabel={`${exercise.name} · ${field === 'normal' ? t.loadKg : t.progression}`}
    />
  );

  return (
    <View style={[styles.exerciseRow, isCompleted && styles.exerciseRowActive]}>
      {isSessionActive ? (
        <CircularCheckbox checked={isCompleted} onToggle={toggle} />
      ) : (
        <View style={styles.checkboxPlaceholder} />
      )}

      <Pressable style={styles.exerciseInfo} onPress={isSessionActive ? toggle : undefined}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        {!isCompleted ? (
          <>
            <Text style={styles.scheme}>
              {mainScheme}
              {progressionScheme ? ` · ${progressionScheme}` : ''}
            </Text>
            <Text style={styles.rest}>
              {t.restInterval(formatRest(exercise.rest_seconds, t.minuteShort, t.secondShort))}
            </Text>
            {exercise.tip ? <Text style={styles.tip}>{exercise.tip}</Text> : null}
            {exercise.library ? <ExerciseLibraryCard library={exercise.library} /> : null}
          </>
        ) : null}
      </Pressable>

      {!isCompleted ? (
        <View style={styles.loadColumn}>
          <Text style={styles.loadLabel}>{t.loadKg}</Text>
          {loadInput('normal', loadNormal)}
          <Text style={styles.loadLabelProgression}>{t.progression}</Text>
          {loadInput('progression', loadProgression)}
        </View>
      ) : null}
    </View>
  );
});
