import React, { useRef, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors } from '../theme';
import type { Exercise } from '../services/types';
import { DEFAULT_CUSTOM_SCHEME } from '../services/workoutService';
import {
  copyDayTo,
  newDraftItem,
  nextDraftKey,
  visibleDays,
  type DraftDay,
  type DraftItem,
} from '../services/programService';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import { styles } from './ProgramEditor.styles';

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

type Props = {
  userId: number;
  days: DraftDay[];
  onChange: (days: DraftDay[]) => void;
};

const byWeekday = (a: DraftDay, b: DraftDay) => a.dayOfWeek - b.dayOfWeek;

/**
 * Weekly program editor used by onboarding and "Meu treino": weekday chips,
 * one card per day (title, exercises with editable scheme, add/remove), and
 * "Trocar dia". Purely a view over `days`; saving is up to the screen.
 */
export function ProgramEditor({ userId, days, onChange }: Props) {
  const { t } = useI18n();
  const [pickerDayKey, setPickerDayKey] = useState<string | null>(null);
  // Weekday sheet: move this card ("Trocar dia") or copy it ("Repetir em outro dia").
  const [daySheet, setDaySheet] = useState<{ key: string; mode: 'move' | 'copy' } | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  // Long-scheme layout is decided once per item, so the field never jumps
  // (and loses focus) while the user is typing.
  const longLayout = useRef(new Map<string, boolean>());
  const isLong = (item: DraftItem) => {
    if (!longLayout.current.has(item.key)) longLayout.current.set(item.key, item.scheme.length > 9);
    return longLayout.current.get(item.key)!;
  };

  const shown = visibleDays(days);
  const dayName = (day: number) => t.dayLabels[day];
  const shortDay = (day: number) => t.dayLabels[day].slice(0, 3);
  const selectedDays = new Set(shown.map((d) => d.dayOfWeek));

  const toggleDay = (day: number) => {
    const visible = shown.find((d) => d.dayOfWeek === day);
    if (visible) {
      // Hide instead of delete so re-selecting the day restores its exercises.
      onChange(days.map((d) => (d.key === visible.key ? { ...d, hidden: true } : d)));
      return;
    }
    const hidden = days.find((d) => d.dayOfWeek === day && d.hidden);
    if (hidden) {
      onChange(days.map((d) => (d.key === hidden.key ? { ...d, hidden: false } : d)));
      return;
    }
    onChange([...days, { key: nextDraftKey(), dayOfWeek: day, title: '', items: [] }].sort(byWeekday));
  };

  const updateDay = (key: string, patch: Partial<DraftDay>) =>
    onChange(days.map((d) => (d.key === key ? { ...d, ...patch } : d)).sort(byWeekday));

  const moveDay = (key: string, dayOfWeek: number) =>
    // A hidden card on the target weekday is discarded so it can't resurface.
    onChange(
      days
        .filter((d) => !(d.hidden && d.dayOfWeek === dayOfWeek))
        .map((d) => (d.key === key ? { ...d, dayOfWeek } : d))
        .sort(byWeekday),
    );

  const updateItem = (dayKey: string, itemKey: string, patch: Partial<DraftItem>) =>
    onChange(
      days.map((d) =>
        d.key === dayKey ? { ...d, items: d.items.map((i) => (i.key === itemKey ? { ...i, ...patch } : i)) } : d,
      ),
    );

  const removeItem = (dayKey: string, itemKey: string) =>
    onChange(days.map((d) => (d.key === dayKey ? { ...d, items: d.items.filter((i) => i.key !== itemKey) } : d)));

  const handlePick = (exercise: Exercise) => {
    const dayKey = pickerDayKey;
    setPickerDayKey(null);
    if (!dayKey) return;
    onChange(days.map((d) => (d.key === dayKey ? { ...d, items: [...d.items, newDraftItem(exercise)] } : d)));
  };

  // Coach sheets produce long schemes ("4x14-16/10-12/10-12/6-8"): those go on
  // their own line under the name so the name isn't squeezed on phones.
  const renderScheme = (dayKey: string, item: DraftItem, long = false) => (
    <TextInput
      style={[styles.schemeInput, long && styles.schemeInputLong]}
                value={item.scheme}
                onChangeText={(scheme) => updateItem(dayKey, item.key, { scheme })}
                placeholder={DEFAULT_CUSTOM_SCHEME}
                placeholderTextColor={colors.textSecondary + '99'}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={60}
                accessibilityLabel={`${item.name} ${item.scheme}`}
              />
  );

  const pickerDay = shown.find((d) => d.key === pickerDayKey) ?? null;
  const sheetDay = daySheet ? shown.find((d) => d.key === daySheet.key) ?? null : null;
  const toggleNotes = (itemKey: string) =>
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });

  return (
    <>
      <Text style={styles.sectionLabel}>{t.onboardingTrainingDays}</Text>
      <View style={styles.dayChips}>
        {ALL_DAYS.map((day) => {
          const selected = selectedDays.has(day);
          return (
            <Pressable
              key={day}
              onPress={() => toggleDay(day)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={dayName(day)}
              style={[styles.dayChip, selected && styles.dayChipSelected]}
            >
              <Text style={[styles.dayChipLabel, selected && styles.dayChipLabelSelected]}>{shortDay(day)}</Text>
            </Pressable>
          );
        })}
      </View>

      {shown.map((day) => (
        <View key={day.key} style={styles.card}>
          <View style={styles.dayCardHeader}>
            <Text style={styles.dayLabel}>{dayName(day.dayOfWeek)}</Text>
            <View style={styles.dayActions}>
              {shown.length < 7 && (
                <Pressable onPress={() => setDaySheet({ key: day.key, mode: 'copy' })} hitSlop={10} accessibilityRole="button">
                  <Text style={styles.changeDay}>{t.repeatOnDay}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setDaySheet({ key: day.key, mode: 'move' })} hitSlop={10} accessibilityRole="button">
                <Text style={styles.changeDay}>{t.onboardingChangeDay}</Text>
              </Pressable>
            </View>
          </View>
          <TextInput
            style={styles.dayTitleInput}
            value={day.title}
            onChangeText={(title) => updateDay(day.key, { title })}
            placeholder={t.onboardingDayTitlePlaceholder}
            placeholderTextColor={colors.textSecondary + '99'}
            maxLength={80}
          />

          {day.items.map((item) => (
            <View key={item.key} style={styles.itemRow}>
              <View style={styles.itemBody}>
                <View style={styles.itemNameRow}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  {!item.exercise && <Text style={styles.newTag}>{t.onboardingNewTag}</Text>}
                </View>
                {isLong(item) && renderScheme(day.key, item, true)}
                {item.notes ? (
                  <Pressable onPress={() => toggleNotes(item.key)} accessibilityRole="button">
                    <Text style={styles.itemNotes} numberOfLines={expandedNotes.has(item.key) ? undefined : 2}>
                      {item.notes}
                    </Text>
                    {item.notes.length > 80 || item.notes.includes('\n') ? (
                      <Text style={styles.notesToggle}>
                        {expandedNotes.has(item.key) ? t.hideInstructions : t.showInstructions}
                      </Text>
                    ) : null}
                  </Pressable>
                ) : null}
                {item.wrote && (
                  <Pressable
                    onPress={() => updateItem(day.key, item.key, { exercise: null, name: item.wrote!, wrote: null })}
                    accessibilityRole="button"
                  >
                    <Text style={styles.youWrote}>{t.onboardingYouWrote(item.wrote)}</Text>
                  </Pressable>
                )}
              </View>
              {!isLong(item) && renderScheme(day.key, item)}
              <Pressable
                onPress={() => removeItem(day.key, item.key)}
                accessibilityRole="button"
                accessibilityLabel={`${t.removeExercise} ${item.name}`}
                style={({ pressed }) => [styles.removeItem, pressed && styles.removeItemPressed]}
              >
                <Text style={styles.removeItemLabel}>✕</Text>
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={() => setPickerDayKey(day.key)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addItem, pressed && styles.addItemPressed]}
          >
            <Text style={styles.addItemLabel}>{t.addExercise}</Text>
          </Pressable>
        </View>
      ))}

      <ExercisePickerSheet
        visible={pickerDay !== null}
        userId={userId}
        selectedIds={pickerDay?.items.flatMap((i) => (i.exercise ? [i.exercise.id] : [])) ?? []}
        onPick={handlePick}
        onClose={() => setPickerDayKey(null)}
      />

      <Modal visible={sheetDay !== null} transparent animationType="fade" onRequestClose={() => setDaySheet(null)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setDaySheet(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {daySheet?.mode === 'copy' ? t.repeatOnDayTitle : t.onboardingChangeDay}
            </Text>
            {ALL_DAYS.map((day) => {
              const isCurrent = sheetDay?.dayOfWeek === day;
              const taken = daySheet?.mode === 'copy' ? selectedDays.has(day) : !isCurrent && selectedDays.has(day);
              return (
                <Pressable
                  key={day}
                  disabled={taken}
                  onPress={() => {
                    if (sheetDay && daySheet?.mode === 'copy') onChange(copyDayTo(days, sheetDay.key, day));
                    else if (sheetDay && !isCurrent) moveDay(sheetDay.key, day);
                    setDaySheet(null);
                  }}
                  style={({ pressed }) => [
                    styles.sheetOption,
                    isCurrent && styles.sheetOptionActive,
                    pressed && styles.sheetOptionPressed,
                    taken && styles.sheetOptionDisabled,
                  ]}
                >
                  <Text style={[styles.sheetOptionLabel, isCurrent && styles.sheetOptionLabelActive]}>
                    {dayName(day)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** Big text area for pasting a workout (onboarding + "Trocar meu treino"). */
export function PasteWorkoutInput({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  const { t } = useI18n();
  return (
    <TextInput
      style={styles.pasteInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={t.onboardingImportPlaceholder}
      placeholderTextColor={colors.textSecondary + '99'}
      multiline
      autoFocus
      autoCorrect={false}
      autoCapitalize="sentences"
      accessibilityLabel={t.onboardingImportPasteTitle}
    />
  );
}

/** "+ Adicionar outra ficha" shown under an imported program in review. */
export function AddAnotherSheetButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.anotherSheet, pressed && styles.anotherSheetPressed]}
    >
      <Text style={styles.anotherSheetLabel}>{t.addAnotherSheet}</Text>
      <Text style={styles.anotherSheetHint}>{t.addAnotherSheetHint}</Text>
    </Pressable>
  );
}
