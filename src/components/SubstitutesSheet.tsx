import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors, spacing, typography } from '../theme';
import type { Exercise } from '../services/types';
import { getExerciseSubstitutes } from '../services/substituteService';
import { ExerciseMedia } from './ExerciseMedia';
import { useExerciseVideos } from '../hooks/useExerciseVideos';
import { styles as sheet } from './ExercisePickerSheet.styles';

type Props = {
  /** Exercise to replace; null hides the sheet. */
  exercise: Exercise | null;
  userId: number;
  onClose: () => void;
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Bottom sheet with alternatives for a busy machine (same muscle, other equipment). */
export function SubstitutesSheet({ exercise, userId, onClose }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<Exercise[] | null>(null);
  const videos = useExerciseVideos(userId);

  useEffect(() => {
    if (!exercise) return;
    let cancelled = false;
    setItems(null);
    getExerciseSubstitutes(exercise, userId)
      .then((result) => !cancelled && setItems(result))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [exercise, userId]);

  return (
    <Modal visible={exercise !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sheet.overlay}>
        <Pressable style={sheet.backdrop} onPress={onClose} accessibilityLabel={t.cancel} />
        <View style={[sheet.sheet, styles.sheet]}>
          <View style={sheet.header}>
            <Text style={[sheet.title, styles.title]} numberOfLines={2}>
              {exercise ? t.substitutesTitle(exercise.name) : ''}
            </Text>
            <Pressable hitSlop={12} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.cancel}>
              <Text style={sheet.close}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>{t.substitutesSubtitle}</Text>

          {items === null ? (
            <View style={sheet.loadingWrap}>
              <ActivityIndicator color={colors.olive} />
            </View>
          ) : items.length === 0 ? (
            <Text style={sheet.emptyText}>{t.noSubstitutes}</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {items.map((item) => (
                <View key={item.id} style={styles.item}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {[item.primary_muscle && capitalize(item.primary_muscle), item.scheme].filter(Boolean).join(' · ')}
                  </Text>
                  <ExerciseMedia library={item.library} video={videos.get(item.id)} />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '85%' },
  title: { flex: 1, marginRight: spacing.md },
  subtitle: { ...typography.caption, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  item: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoftLight,
  },
  name: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  meta: { ...typography.caption, marginTop: 2 },
});
