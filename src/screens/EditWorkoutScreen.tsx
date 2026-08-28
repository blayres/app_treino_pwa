import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { useI18n } from '../i18n';
import {
  getWorkoutExercises,
  getWorkoutTitle,
  updateWorkoutTitle,
  addExerciseToWorkout,
  removeExerciseFromWorkout,
  archiveWorkout,
  listExercises,
  invalidateWorkoutsByUserCache,
  invalidateWorkoutExercisesCache,
} from '../services/workoutService';
import { ConfirmModal } from '../components/ConfirmModal';
import type { Exercise, WorkoutExercise } from '../services/types';
import { styles, pickerStyles } from './EditWorkoutScreen.styles';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'EditWorkout'>;
type Route = RouteProp<RootStackParamList, 'EditWorkout'>;

export default function EditWorkoutScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { workoutId } = route.params;
  const currentUser = useAppStore((s) => s.currentUser);
  const { t } = useI18n();

  const [title, setTitle] = useState('');
  const [savedTitle, setSavedTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const titleSaveRef = useRef<Promise<boolean> | null>(null);

  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);

  // Exercise picker modal
  const [showPicker, setShowPicker] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [isLoadingPicker, setIsLoadingPicker] = useState(false);
  const [pickerLayout, setPickerLayout] = useState(() => ({
    bottom: 0,
    height: Dimensions.get('window').height * 0.8,
  }));

  // Confirm modals
  const [confirmRemoveExercise, setConfirmRemoveExercise] = useState<WorkoutExercise | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Load workout exercises
  const loadExercises = useCallback(async () => {
    setIsLoadingExercises(true);
    try {
      const data = await getWorkoutExercises(workoutId);
      setExercises(data);
    } catch (err: any) {
      Alert.alert(t.saveError, err?.message ?? t.genericError);
    } finally {
      setIsLoadingExercises(false);
    }
  }, [workoutId, t]);

  // Load workout title fresh from the server
  useEffect(() => {
    (async () => {
      try {
        const fetchedTitle = await getWorkoutTitle(workoutId);
        setTitle(fetchedTitle);
        setSavedTitle(fetchedTitle);
      } catch {
        // ignore — user can still edit
      }
    })();
  }, [workoutId]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

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

  const saveTitle = async (): Promise<boolean> => {
    // A title input blurs before the header button receives its press on some
    // platforms. Reuse that in-flight save instead of issuing a second request.
    if (titleSaveRef.current) return titleSaveRef.current;

    const trimmed = title.trim();
    if (!trimmed || trimmed === savedTitle) return true;

    const save = (async () => {
      setIsSavingTitle(true);
      try {
        await updateWorkoutTitle(workoutId, trimmed);
        setSavedTitle(trimmed);
        invalidateWorkoutsByUserCache(currentUser?.id);
        return true;
      } catch (err: any) {
        Alert.alert(t.saveError, err?.message ?? t.errorSavingWorkout);
        setTitle(savedTitle);
        return false;
      } finally {
        setIsSavingTitle(false);
      }
    })();

    titleSaveRef.current = save;
    void save.finally(() => {
      if (titleSaveRef.current === save) titleSaveRef.current = null;
    });
    return save;
  };

  // "Done" — saves title if changed, then navigates back
  const handleDone = async () => {
    const saved = await saveTitle();
    if (!saved) return;
    navigation.goBack();
  };

  // Open exercise picker
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

  // Add exercise to workout
  const handlePickExercise = async (exercise: Exercise) => {
    const alreadyAdded = exercises.some((we) => we.exercise_id === exercise.id);
    if (alreadyAdded) {
      Alert.alert('', t.exerciseAlreadyAdded);
      return;
    }
    setShowPicker(false);
    try {
      await addExerciseToWorkout(workoutId, exercise.id);
      invalidateWorkoutExercisesCache(workoutId);
      invalidateWorkoutsByUserCache(currentUser?.id);
      await loadExercises();
    } catch (err: any) {
      Alert.alert(t.saveError, err?.message ?? t.errorAddingExercise);
    }
  };

  // Initiate remove — show correct confirm dialog
  const handleRemovePress = (we: WorkoutExercise) => {
    setConfirmRemoveExercise(we);
  };

  const handleConfirmRemove = async () => {
    const we = confirmRemoveExercise;
    setConfirmRemoveExercise(null);
    if (!we) return;

    const isLast = exercises.length === 1;

    try {
      if (isLast) {
        // Archive the whole workout
        await archiveWorkout(workoutId);
        invalidateWorkoutExercisesCache(workoutId);
        invalidateWorkoutsByUserCache(currentUser?.id);
        navigation.goBack();
      } else {
        await removeExerciseFromWorkout(we.id);
        invalidateWorkoutExercisesCache(workoutId);
        invalidateWorkoutsByUserCache(currentUser?.id);
        await loadExercises();
      }
    } catch (err: any) {
      Alert.alert(
        t.saveError,
        err?.message ?? (isLast ? t.errorArchivingWorkout : t.errorRemovingExercise),
      );
    }
  };

  // Archive entire training day
  const handleArchiveWorkout = async () => {
    setShowArchiveConfirm(false);
    try {
      await archiveWorkout(workoutId);
      invalidateWorkoutExercisesCache(workoutId);
      invalidateWorkoutsByUserCache(currentUser?.id);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert(t.saveError, err?.message ?? t.errorArchivingWorkout);
    }
  };

  // Filtered exercises for picker
  const filteredExercises = search.trim()
    ? allExercises.filter((e) =>
        e.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : allExercises;

  const isLast = exercises.length === 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
          <Text style={styles.backLabel}>{t.back}</Text>
        </Pressable>
        <Text style={styles.screenTitle}>{t.editWorkoutTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t.workoutTitleLabel}</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            returnKeyType="done"
            onSubmitEditing={handleDone}
            placeholder={t.workoutTitlePlaceholder}
          />

          <Text style={styles.sectionLabel}>{t.exercises}</Text>

          {isLoadingExercises ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={styles.spinner.color} />
            </View>
          ) : exercises.length === 0 ? (
            <Text style={styles.emptyText}>{t.noExercisesYet}</Text>
          ) : (
            exercises.map((we) => (
              <View key={we.id} style={styles.exerciseRow}>
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{we.exercise.name}</Text>
                  <Text style={styles.exerciseScheme}>{we.exercise.scheme}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.removeButton,
                    pressed && styles.removeButtonPressed,
                  ]}
                  onPress={() => handleRemovePress(we)}
                >
                  <Text style={styles.removeButtonLabel}>{t.removeExercise}</Text>
                </Pressable>
              </View>
            ))
          )}

          <Pressable
            style={({ pressed }) => [styles.addExerciseButton, pressed && styles.addExerciseButtonPressed]}
            onPress={handleOpenPicker}
          >
            <Text style={styles.addExerciseButtonLabel}>{t.addExercise}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.archiveButton, pressed && styles.archiveButtonPressed]}
            onPress={() => setShowArchiveConfirm(true)}
          >
            <Text style={styles.archiveButtonLabel}>{t.removeTrainingDay}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
            onPress={handleDone}
            disabled={isSavingTitle}
          >
            {isSavingTitle ? (
              <ActivityIndicator color={styles.saveButtonLabel.color} />
            ) : (
              <Text style={styles.saveButtonLabel}>{t.saveTitle}</Text>
            )}
          </Pressable>
        </View>
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
                  const alreadyAdded = exercises.some((we) => we.exercise_id === item.id);
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

      {/* ── Confirm remove exercise ── */}
      <ConfirmModal
        visible={confirmRemoveExercise !== null}
        title={isLast ? t.removeLastExerciseTitle : t.removeExercise}
        message={
          isLast
            ? t.removeLastExerciseMsg
            : `${t.removeExercise}: ${confirmRemoveExercise?.exercise.name ?? ''}`
        }
        confirmLabel={isLast ? t.archive : t.remove}
        cancelLabel={t.cancel}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemoveExercise(null)}
        confirmDanger
      />

      {/* ── Confirm archive training day ── */}
      <ConfirmModal
        visible={showArchiveConfirm}
        title={t.removeTrainingDayConfirmTitle}
        message={t.removeTrainingDayConfirmMsg}
        confirmLabel={t.archive}
        cancelLabel={t.cancel}
        onConfirm={handleArchiveWorkout}
        onCancel={() => setShowArchiveConfirm(false)}
        confirmDanger
      />
    </SafeAreaView>
  );
}
