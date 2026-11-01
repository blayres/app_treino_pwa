import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { useI18n } from '../i18n';
import {
  getWorkoutsByUser,
  createWorkoutForUser,
  invalidateWorkoutsByUserCache,
} from '../services/workoutService';
import type { Exercise } from '../services/types';
import { styles } from './AddTrainingDayScreen.styles';
import { showAlert } from '../store/useDialogStore';
import { LogoBar } from '../components/LogoBar';
import { ExercisePickerSheet } from '../components/ExercisePickerSheet';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'AddTrainingDay'>;

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function AddTrainingDayScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useAppStore((s) => s.currentUser);
  const { t } = useI18n();

  const [title, setTitle] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [usedDays, setUsedDays] = useState<number[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Exercise picker
  const [showPicker, setShowPicker] = useState(false);

  // Load already-used days so we can disable them
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const workouts = await getWorkoutsByUser(currentUser.id);
        setUsedDays(workouts.map((w) => w.day_of_week));
      } catch {
        // non-blocking
      }
    })();
  }, [currentUser]);

  const handleOpenPicker = () => {
    setShowPicker(true);
  };

  const handlePickExercise = (exercise: Exercise) => {
    const alreadyAdded = selectedExercises.some((e) => e.id === exercise.id);
    if (alreadyAdded) {
      showAlert('', t.exerciseAlreadyAdded);
      return;
    }
    setSelectedExercises((prev) => [...prev, exercise]);
    setShowPicker(false);
  };

  const handleRemoveExercise = (exercise: Exercise) => {
    setSelectedExercises((prev) => prev.filter((e) => e.id !== exercise.id));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showAlert('', t.titleRequired);
      return;
    }
    if (selectedDay === null) {
      showAlert('', t.dayRequired);
      return;
    }
    if (selectedExercises.length === 0) {
      showAlert('', t.atLeastOneExercise);
      return;
    }
    if (!currentUser) return;

    setIsSaving(true);
    try {
      await createWorkoutForUser({
        userId: currentUser.id,
        dayOfWeek: selectedDay,
        title: title.trim(),
        exerciseIds: selectedExercises.map((e) => e.id),
      });
      invalidateWorkoutsByUserCache(currentUser.id);
      navigation.goBack();
    } catch (err: any) {
      // 409 / unique violation means that day already has an active workout
      // (can happen if the DB migration hasn't been run yet)
      const isConflict =
        err?.code === '23505' ||
        err?.status === 409 ||
        String(err?.message ?? '').toLowerCase().includes('unique') ||
        String(err?.message ?? '').toLowerCase().includes('conflict');
      showAlert(
        t.saveError,
        isConflict ? t.dayAlreadyHasWorkout : (err?.message ?? t.errorSavingWorkout),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <LogoBar />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
          <Text style={styles.backLabel}>{t.back}</Text>
        </Pressable>
        <Text style={styles.screenTitle}>{t.addTrainingDayTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* ── Day selector ── */}
        <Text style={styles.sectionLabel}>{t.selectDay}</Text>
        <View style={styles.dayRow}>
          {ALL_DAYS.map((day) => {
            const isUsed = usedDays.includes(day);
            const isSelected = selectedDay === day;
            return (
              <Pressable
                key={day}
                style={[
                  styles.dayChip,
                  isSelected && styles.dayChipSelected,
                  isUsed && styles.dayChipDisabled,
                ]}
                onPress={() => !isUsed && setSelectedDay(day)}
                disabled={isUsed}
              >
                <Text
                  style={[
                    styles.dayChipLabel,
                    isSelected && styles.dayChipLabelSelected,
                    isUsed && styles.dayChipLabelDisabled,
                  ]}
                >
                  {/* Short day label e.g. "Seg" */}
                  {t.adminDayLabels[day]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Title ── */}
        <Text style={styles.sectionLabel}>{t.workoutTitleLabel}</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder={t.workoutTitlePlaceholder}
          returnKeyType="done"
        />

        {/* ── Exercises ── */}
        <Text style={styles.sectionLabel}>{t.exercises}</Text>

        {selectedExercises.length === 0 ? (
          <Text style={styles.emptyText}>{t.noExercisesYet}</Text>
        ) : (
          selectedExercises.map((e) => (
            <View key={e.id} style={styles.exerciseRow}>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{e.name}</Text>
                <Text style={styles.exerciseScheme}>{e.scheme}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed && styles.removeButtonPressed,
                ]}
                onPress={() => handleRemoveExercise(e)}
              >
                <Text style={styles.removeButtonLabel}>{t.removeExercise}</Text>
              </Pressable>
            </View>
          ))
        )}

        <Pressable
          style={({ pressed }) => [
            styles.addExerciseButton,
            pressed && styles.addExerciseButtonPressed,
          ]}
          onPress={handleOpenPicker}
        >
          <Text style={styles.addExerciseButtonLabel}>{t.addExercise}</Text>
        </Pressable>

        {/* ── Save ── */}
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            isSaving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonLabel}>{t.saveTitle}</Text>
          )}
        </Pressable>
      </ScrollView>

      {currentUser && (
        <ExercisePickerSheet
          visible={showPicker}
          userId={currentUser.id}
          selectedIds={selectedExercises.map((e) => e.id)}
          onPick={handlePickExercise}
          onClose={() => setShowPicker(false)}
        />
      )}
    </SafeAreaView>
  );
}
