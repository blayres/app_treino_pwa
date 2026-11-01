import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useI18n } from '../i18n';
import { colors } from '../theme';
import type { Exercise } from '../services/types';
import { createCustomExercise, listExercises } from '../services/workoutService';
import { normalizeForMatch } from '../services/workoutTextParser';
import { showAlert } from '../store/useDialogStore';
import { styles } from './ExercisePickerSheet.styles';

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
  const { t } = useI18n();
  const [exercises, setExercises] = useState<Exercise[]>(
    catalogueCache?.userId === userId ? catalogueCache.data : [],
  );
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [layout, setLayout] = useState(() => ({
    bottom: 0,
    height: Dimensions.get('window').height * 0.8,
  }));

  useEffect(() => {
    if (!visible) return;
    setSearch('');
    let cancelled = false;
    if (catalogueCache?.userId !== userId) setIsLoading(true);
    loadExerciseCatalogue(userId)
      .then((data) => !cancelled && setExercises(data))
      .catch((err: any) => showAlert(t.saveError, err?.message ?? t.genericError))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible, userId]);

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

  const filtered = useMemo(() => {
    if (!queryKey) return exercises;
    return exercises.filter((exercise) => searchKey(exercise.name).includes(queryKey));
  }, [exercises, queryKey]);

  const hasExactMatch = useMemo(
    () => !!queryKey && exercises.some((exercise) => searchKey(exercise.name) === queryKey),
    [exercises, queryKey],
  );
  const canCreate = !!queryKey && !hasExactMatch && !isLoading;

  const handleCreate = async () => {
    if (!canCreate || isCreating) return;
    setIsCreating(true);
    try {
      const created = await createCustomExercise({ userId, name: query });
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

  const createRow = canCreate ? (
    <Pressable
      style={({ pressed }) => [styles.createItem, pressed && styles.exerciseItemPressed]}
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
      {isCreating && <ActivityIndicator color={colors.olive} />}
    </Pressable>
  ) : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.cancel} />
        <View style={[styles.sheet, { marginBottom: layout.bottom, height: layout.height }]}>
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
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={createRow}
              ListEmptyComponent={
                canCreate ? null : <Text style={styles.emptyText}>{t.noExercisesFound}</Text>
              }
              renderItem={({ item }) => {
                const alreadyAdded = selectedIds.includes(item.id);
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.exerciseItem,
                      alreadyAdded && styles.exerciseItemDisabled,
                      pressed && !alreadyAdded && styles.exerciseItemPressed,
                    ]}
                    onPress={() => onPick(item)}
                    disabled={alreadyAdded}
                  >
                    <View style={styles.exerciseItemInfo}>
                      <Text style={[styles.exerciseItemName, alreadyAdded && styles.exerciseItemNameDisabled]}>
                        {item.name}
                      </Text>
                      {item.primary_muscle ? (
                        <Text style={styles.exerciseItemMuscle}>{item.primary_muscle}</Text>
                      ) : null}
                    </View>
                    {item.owner_id != null && !alreadyAdded && (
                      <Text style={styles.customTag}>{t.customExerciseTag}</Text>
                    )}
                    {alreadyAdded && <Text style={styles.addedTag}>✓</Text>}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
