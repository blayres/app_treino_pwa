import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useI18n } from '../i18n';
import { colors } from '../theme';
import type { Exercise } from '../services/types';
import {
  createCustomExercise,
  deleteCustomExercise,
  ExerciseInUseError,
  listExercises,
} from '../services/workoutService';
import { BottomSheet } from './BottomSheet';
import { ConfirmModal } from './ConfirmModal';
import { normalizeForMatch } from '../services/workoutTextParser';
import { showAlert } from '../store/useDialogStore';
import { styles } from './ExercisePickerSheet.styles';
import { MeasureToggle } from './MeasureToggle';
import { DEFAULT_TIME_REPS, type Measure } from '../utils/measure';
import { exerciseName, exerciseNames, muscleLabel } from '../utils/exerciseText';

// Catalogue shared by every picker instance; refreshed after creating an exercise.
let catalogueCache: { userId: number; data: Exercise[] } | null = null;

export function invalidateExerciseCatalogue() {
  catalogueCache = null;
}

export async function loadExerciseCatalogue(userId: number): Promise<Exercise[]> {
  if (catalogueCache?.userId === userId) return catalogueCache.data;
  const data = await listExercises(userId);
  catalogueCache = { userId, data };
  return data;
}

function searchKey(text: string): string {
  return normalizeForMatch(text).join(' ');
}

type Props = {
  visible: boolean;
  userId: number;
  /** Exercises already in the workout: shown with ✓ and not selectable. */
  selectedIds: number[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
};

/**
 * Bottom sheet to search the catalogue and pick an exercise. When the typed
 * name doesn't exist, offers "Criar “…”" which creates a private exercise
 * (visible only to this user) in one tap.
 */
export function ExercisePickerSheet({ visible, userId, selectedIds, onPick, onClose }: Props) {
  const { t, locale } = useI18n();
  const [exercises, setExercises] = useState<Exercise[]>(
    catalogueCache?.userId === userId ? catalogueCache.data : [],
  );
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  // A new exercise is logged by load (kg) or done for time (plank…).
  const [createMeasure, setCreateMeasure] = useState<Measure>('load');
  const [toDelete, setToDelete] = useState<Exercise | null>(null);
  const [layout, setLayout] = useState(() => ({
    bottom: 0,
    height: Dimensions.get('window').height * 0.8,
  }));

  useEffect(() => {
    if (!visible) return;
    setSearch('');
    setCreateMeasure('load');
    let cancelled = false;
    if (catalogueCache?.userId !== userId) setIsLoading(true);
    loadExerciseCatalogue(userId)
      .then((data) => !cancelled && setExercises(data))
      .catch((err: any) => showAlert(t.saveError, err?.message ?? t.genericError))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible, userId, t]);

  // Mobile Safari keeps the layout viewport at full height when its keyboard
  // opens. Use the visual viewport so the bottom sheet stays above it.
  useEffect(() => {
    if (!visible || typeof window === 'undefined' || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const update = () => {
      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setLayout({ bottom: keyboardHeight, height: Math.max(220, viewport.height * 0.8) });
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [visible]);

  const query = search.trim();
  const queryKey = searchKey(query);

  // Shown in the user's language, sorted by that name; the search matches the
  // name in any language (a French user typing "squat" or "agachamento").
  const listed = useMemo(
    () =>
      exercises
        .map((exercise) => ({
          exercise,
          label: exerciseName(exercise, locale),
          keys: exerciseNames(exercise).map(searchKey),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [exercises, locale],
  );

  const filtered = useMemo(
    () => (queryKey ? listed.filter((item) => item.keys.some((key) => key.includes(queryKey))) : listed),
    [listed, queryKey],
  );

  const hasExactMatch = useMemo(
    () => !!queryKey && listed.some((item) => item.keys.includes(queryKey)),
    [listed, queryKey],
  );
  const canCreate = !!queryKey && !hasExactMatch && !isLoading;

  const handleCreate = async () => {
    if (!canCreate || isCreating) return;
    setIsCreating(true);
    try {
      const created = await createCustomExercise({
        userId,
        name: query,
        scheme: createMeasure === 'time' ? `3x${DEFAULT_TIME_REPS}` : undefined,
      });
      const next = [...exercises.filter((e) => e.id !== created.id), created].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      catalogueCache = { userId, data: next };
      setExercises(next);
      onPick(created);
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.errorCreatingExercise);
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    const exercise = toDelete;
    setToDelete(null);
    if (!exercise) return;
    try {
      await deleteCustomExercise(userId, exercise.id);
      const next = exercises.filter((e) => e.id !== exercise.id);
      catalogueCache = { userId, data: next };
      setExercises(next);
    } catch (err: any) {
      if (err instanceof ExerciseInUseError) showAlert(t.exerciseInUseTitle, t.exerciseInUseMsg);
      else showAlert(t.saveError, err?.message ?? t.errorDeletingExercise);
    }
  };

  const createRow = canCreate ? (
    <View style={styles.createItem}>
      <Pressable
        style={({ pressed }) => [styles.createMain, pressed && styles.exerciseItemPressed]}
        onPress={handleCreate}
        disabled={isCreating}
        accessibilityRole="button"
      >
        <Text style={styles.createPlus}>+</Text>
        <View style={styles.exerciseItemInfo}>
          <Text style={styles.createLabel} numberOfLines={2}>
            {t.createExerciseNamed(query)}
          </Text>
          <Text style={styles.createHint}>{t.createExerciseHint}</Text>
        </View>
      </Pressable>
      {isCreating ? (
        <ActivityIndicator color={colors.olive} />
      ) : (
        <MeasureToggle
          value={createMeasure}
          onChange={setCreateMeasure}
          accessibilityPrefix={query}
          style={styles.createMeasure}
        />
      )}
    </View>
  ) : null;

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        sheetStyle={{ marginBottom: layout.bottom, height: layout.height }}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t.pickExerciseTitle}</Text>
          <Pressable hitSlop={12} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.cancel}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t.searchOrCreateExercise}
          clearButtonMode="while-editing"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => {
            if (filtered.length === 0 && canCreate) handleCreate();
          }}
        />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.olive} />
          </View>
        ) : (
          <FlatList
            style={styles.exerciseList}
            data={filtered}
            keyExtractor={(item) => String(item.exercise.id)}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={createRow}
            ListEmptyComponent={
              canCreate ? null : <Text style={styles.emptyText}>{t.noExercisesFound}</Text>
            }
            renderItem={({ item: { exercise: item, label } }) => {
              const alreadyAdded = selectedIds.includes(item.id);
              return (
                // Pick and delete are sibling buttons (a button can't contain another one).
                <View style={[styles.exerciseRow, alreadyAdded && styles.exerciseItemDisabled]}>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.exerciseItem,
                      item.owner_id != null && styles.exerciseItemWithDelete,
                      pressed && !alreadyAdded && styles.exerciseItemPressed,
                    ]}
                    onPress={() => onPick(item)}
                    disabled={alreadyAdded}
                  >
                    <View style={styles.exerciseItemInfo}>
                      <Text style={[styles.exerciseItemName, alreadyAdded && styles.exerciseItemNameDisabled]}>
                        {label}
                      </Text>
                      {item.primary_muscle ? (
                        <Text style={styles.exerciseItemMuscle}>{muscleLabel(item.primary_muscle, t.muscles)}</Text>
                      ) : null}
                  </View>
                  {item.owner_id != null && !alreadyAdded && (
                    <Text style={styles.customTag}>{t.customExerciseTag}</Text>
                  )}
                  {alreadyAdded && <Text style={styles.addedTag}>✓</Text>}
                </Pressable>
                {item.owner_id != null && (
                  <Pressable
                    onPress={() => setToDelete(item)}
                    accessibilityRole="button"
                    accessibilityLabel={t.deleteCustomExercise(item.name)}
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
                  >
                    <TrashIcon />
                  </Pressable>
                )}
                </View>
              );
            }}
          />
        )}
      </BottomSheet>

      <ConfirmModal
        visible={toDelete !== null}
        title={t.deleteCustomExerciseTitle}
        message={toDelete ? t.deleteCustomExerciseMsg(toDelete.name) : ''}
        confirmLabel={t.deleteCustomExerciseConfirm}
        cancelLabel={t.cancel}
        onConfirm={handleConfirmDelete}
        onCancel={() => setToDelete(null)}
        confirmDanger
      />
    </>
  );
}

function TrashIcon() {
  return (
    // @ts-ignore — SVG JSX is valid in react-native-web / DOM environments
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }} aria-hidden="true">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
    </svg>
  );
}
