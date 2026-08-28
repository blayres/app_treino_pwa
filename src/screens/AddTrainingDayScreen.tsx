import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  FlatList,
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
  listExercises,
  invalidateWorkoutsByUserCache,
} from '../services/workoutService';
import type { Exercise } from '../services/types';
import { styles, pickerStyles } from './AddTrainingDayScreen.styles';

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
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [isLoadingPicker, setIsLoadingPicker] = useState(false);
  const [pickerLayout, setPickerLayout] = useState(() => ({
    bottom: 0,
    height: Dimensions.get('window').height * 0.8,
  }));

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

  // Mobile Safari keeps the layout viewport at full height when its keyboard
  // opens. Use the visual viewport so the bottom sheet stays above it.
  useEffect(() => {
    if (!showPicker || typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const viewport = window.visualViewport;
    const updatePickerLayout = () => {
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      setPickerLayout({
        bottom: keyboardHeight,
        height: Math.max(220, viewport.height * 0.8),
      });
    };

    updatePickerLayout();
    viewport.addEventListener('resize', updatePickerLayout);
    viewport.addEventListener('scroll', updatePickerLayout);
    return () => {
      viewport.removeEventListener('resize', updatePickerLayout);
      viewport.removeEventListener('scroll', updatePickerLayout);
    };
  }, [showPicker]);

  const handleOpenPicker = async () => {
    setShowPicker(true);
    setSearch('');
    if (allExercises.length === 0) {
      setIsLoadingPicker(true);
      try {
        const data = await listExercises();
        setAllExercises(data);
      } catch (err: any) {
        Alert.alert(t.saveError, err?.message ?? t.genericError);
      } finally {
        setIsLoadingPicker(false);
      }
    }
  };

  const handlePickExercise = (exercise: Exercise) => {
    const alreadyAdded = selectedExercises.some((e) => e.id === exercise.id);
    if (alreadyAdded) {
      Alert.alert('', t.exerciseAlreadyAdded);
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
      Alert.alert('', t.titleRequired);
      return;
    }
    if (selectedDay === null) {
      Alert.alert('', t.dayRequired);
      return;
    }
    if (selectedExercises.length === 0) {
      Alert.alert('', t.atLeastOneExercise);
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
      Alert.alert(
        t.saveError,
        isConflict ? t.dayAlreadyHasWorkout : (err?.message ?? t.errorSavingWorkout),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const filteredExercises = search.trim()
    ? allExercises.filter((e) =>
        e.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : allExercises;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
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

      {/* ── Exercise picker modal ── */}
      <Modal
        visible={showPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={pickerStyles.overlay}>
          <Pressable
            style={pickerStyles.backdrop}
            onPress={() => setShowPicker(false)}
            accessibilityLabel={t.cancel}
          />
          <View
            style={[
              pickerStyles.sheet,
              { marginBottom: pickerLayout.bottom, height: pickerLayout.height },
            ]}
          >
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>{t.pickExerciseTitle}</Text>
              <Pressable hitSlop={12} onPress={() => setShowPicker(false)}>
                <Text style={pickerStyles.close}>✕</Text>
              </Pressable>
            </View>

            <TextInput
              style={pickerStyles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t.searchExercises}
              clearButtonMode="while-editing"
            />

            {isLoadingPicker ? (
              <View style={pickerStyles.loadingWrap}>
                <ActivityIndicator color={styles.spinner.color} />
              </View>
            ) : filteredExercises.length === 0 ? (
              <Text style={pickerStyles.emptyText}>{t.noExercisesFound}</Text>
            ) : (
              <FlatList
                style={pickerStyles.exerciseList}
                data={filteredExercises}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const alreadyAdded = selectedExercises.some((e) => e.id === item.id);
                  return (
                    <Pressable
                      style={({ pressed }) => [
                        pickerStyles.exerciseItem,
                        alreadyAdded && pickerStyles.exerciseItemDisabled,
                        pressed && !alreadyAdded && pickerStyles.exerciseItemPressed,
                      ]}
                      onPress={() => handlePickExercise(item)}
                      disabled={alreadyAdded}
                    >
                      <View style={pickerStyles.exerciseItemInfo}>
                        <Text
                          style={[
                            pickerStyles.exerciseItemName,
                            alreadyAdded && pickerStyles.exerciseItemNameDisabled,
                          ]}
                        >
                          {item.name}
                        </Text>
                        {item.primary_muscle ? (
                          <Text style={pickerStyles.exerciseItemMuscle}>
                            {item.primary_muscle}
                          </Text>
                        ) : null}
                      </View>
                      {alreadyAdded && (
                        <Text style={pickerStyles.addedTag}>✓</Text>
                      )}
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
