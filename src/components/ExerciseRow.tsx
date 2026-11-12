import React, { memo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { styles } from '../screens/WorkoutScreen.styles';
import { CircularCheckbox } from './CircularCheckbox';
import { ExerciseMedia } from './ExerciseMedia';
import { SwapIcon } from './SwapIcon';
import type { ExerciseVideo } from '../services/videoService';
import { PillButton } from './PillButton';
import { useTourTarget } from '../store/useTourStore';
import type { Exercise } from '../services/types';
import { useI18n } from '../i18n';
import { formatRest } from '../utils/date';
import { parseDecimal } from '../utils/decimal';
import { schemeMeasure, targetSeconds } from '../utils/measure';
import { HoldTimer } from './HoldTimer';

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
  onShowSubstitutes: (exercise: Exercise) => void;
  /** First row: the guided tour points at its load inputs and "Ver substitutos". */
  isTourAnchor?: boolean;
  /** The coach's video for this exercise (shown instead of the animation). */
  video?: ExerciseVideo | null;
};

/**
 * One exercise in the workout screen: name, scheme, rest, coach notes,
 * animation, "Ver substitutos", and the load/progression inputs. Memoised: typing in one row
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
  onShowSubstitutes,
  isTourAnchor = false,
  video = null,
}: Props) {
  const { t } = useI18n();
  const loadTourRef = useTourTarget(isTourAnchor ? 'workout.load' : null);
  const substitutesTourRef = useTourTarget(isTourAnchor ? 'workout.substitutes' : null);
  const [focused, setFocused] = useState<LoadField | null>(null);
  const inputs = useRef<Record<LoadField, TextInput | null>>({ normal: null, progression: null });
  const values = useRef({ normal: loadNormal, progression: loadProgression });
  values.current = { normal: loadNormal, progression: loadProgression };

  const [mainScheme, progressionScheme] = exercise.scheme.split(' e ');
  // Timed exercises (plank…): no load to log, a countdown of the target instead.
  const isTimed = schemeMeasure(exercise.scheme) === 'time';
  const targetTime = isTimed ? targetSeconds(exercise.scheme) ?? 30 : 0;
  // The hold time the user typed (they can go longer than the target), else the target.
  const holdSeconds = isTimed ? Math.round(parseDecimal(loadNormal) || 0) || targetTime : 0;
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
      keyboardType={isTimed ? 'number-pad' : 'decimal-pad'}
      value={value}
      onChangeText={(text) => onChangeLoad(exercise.id, text, field)}
      onFocus={() => handleFocus(field)}
      onBlur={handleBlur}
      placeholder={focused === field ? '' : isTimed ? String(targetTime) : t.loadPlaceholder}
      accessibilityLabel={`${exercise.name} · ${field === 'normal' ? (isTimed ? t.timeSeconds : t.loadKg) : t.progression}`}
    />
  );

  return (
    <View style={[styles.exerciseRow, isCompleted && styles.exerciseRowActive]}>
      {isSessionActive ? (
        <CircularCheckbox checked={isCompleted} onToggle={toggle} accessibilityLabel={exercise.name} />
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
            <ExerciseMedia library={exercise.library} video={video}>
              <View ref={substitutesTourRef} collapsable={false} style={styles.tourAnchor}>
                <PillButton
                  label={t.alternatives}
                  icon={SwapIcon}
                  onPress={() => onShowSubstitutes(exercise)}
                  accessibilityLabel={t.substitutesTitle(exercise.name)}
                />
              </View>
            </ExerciseMedia>
          </>
        ) : null}
      </Pressable>

      {!isCompleted && isTimed ? (
        <View style={styles.loadColumn}>
          <Text style={styles.loadLabel}>{t.timeSeconds}</Text>
          {loadInput('normal', loadNormal)}
          <HoldTimer seconds={holdSeconds} exerciseName={exercise.name} />
        </View>
      ) : null}

      {!isCompleted && !isTimed ? (
        <View ref={loadTourRef} collapsable={false} style={styles.loadColumn}>
          <Text style={styles.loadLabel}>{t.loadKg}</Text>
          {loadInput('normal', loadNormal)}
          <Text style={styles.loadLabelProgression}>{t.progression}</Text>
          {loadInput('progression', loadProgression)}
        </View>
      ) : null}
    </View>
  );
});
