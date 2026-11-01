import React, { useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { useI18n } from '../i18n';
import { colors } from '../theme';
import type { Exercise } from '../services/types';
import { DEFAULT_CUSTOM_SCHEME } from '../services/workoutService';
import {
  copyDayTo,
  newDraftItem,
  swapDays,
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

type DragHandlers = {
  onStart: () => void;
  onMove: (dy: number) => void;
  onEnd: (dy: number) => void;
  onCancel: () => void;
};

/** "≡" grip: press and drag a day card onto another one to swap their weekdays. */
function DragHandle({ label, handlers }: { label: string; handlers: DragHandlers }) {
  // Latest handlers without re-creating the responder mid-gesture.
  const latest = useRef(handlers);
  latest.current = handlers;
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => latest.current.onStart(),
      onPanResponderMove: (_, gesture) => latest.current.onMove(gesture.dy),
      onPanResponderRelease: (_, gesture) => latest.current.onEnd(gesture.dy),
      onPanResponderTerminate: () => latest.current.onCancel(),
    }),
  ).current;

  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityLabel={label}
      // Web: no page scroll / text selection while dragging, grab cursor.
      style={[styles.dragHandle, { touchAction: 'none', cursor: 'grab', userSelect: 'none' } as object]}
    >
      <Text style={styles.dragHandleIcon}>≡</Text>
    </View>
  );
}

/**
 * Weekly program editor used by onboarding and "Meu treino": weekday chips,
 * one card per day (title, exercises with editable scheme, add/remove),
 * drag & drop by the "≡" grip to swap two days, "Trocar dia" (onto a taken
 * day = swap) and "Repetir em outro dia". Purely a view over `days`.
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

  // Drag & drop: card being dragged, its offset, and every card's position.
  const [drag, setDrag] = useState<{ key: string; dy: number } | null>(null);
  const cardLayouts = useRef(new Map<string, { y: number; height: number }>());

  const shown = visibleDays(days);
  const dayName = (day: number) => t.dayLabels[day];
  const shortDay = (day: number) => t.dayLabels[day].slice(0, 3);
  const selectedDays = new Set(shown.map((d) => d.dayOfWeek));

  /** Card under the dragged card's centre (other than itself), if any. */
  const dropTarget = (key: string, dy: number): string | null => {
    const from = cardLayouts.current.get(key);
    if (!from) return null;
    const centre = from.y + from.height / 2 + dy;
    for (const day of shown) {
      if (day.key === key) continue;
      const box = cardLayouts.current.get(day.key);
      if (box && centre >= box.y && centre <= box.y + box.height) return day.key;
    }
    return null;
  };

  const dragHandlers = (key: string): DragHandlers => ({
    onStart: () => setDrag({ key, dy: 0 }),
    onMove: (dy) => setDrag({ key, dy }),
    onEnd: (dy) => {
      const target = dropTarget(key, dy);
      setDrag(null);
      if (target) onChange(swapDays(days, key, target));
    },
    onCancel: () => setDrag(null),
  });

  const hoverKey = drag ? dropTarget(drag.key, drag.dy) : null;

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

      {shown.length > 1 && <Text style={styles.reorderHint}>{t.reorderHint}</Text>}

      {shown.map((day) => (
        <View
          key={day.key}
          onLayout={(e: LayoutChangeEvent) =>
            cardLayouts.current.set(day.key, { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height })
          }
          style={[
            styles.card,
            drag?.key === day.key && [styles.cardDragging, { transform: [{ translateY: drag.dy }] }],
            hoverKey === day.key && styles.cardDropTarget,
          ]}
        >
          <View style={styles.dayCardHeader}>
            <View style={styles.dayLabelRow}>
              {shown.length > 1 && (
                <DragHandle label={t.dragToSwapDay(dayName(day.dayOfWeek))} handlers={dragHandlers(day.key)} />
              )}
              <Text style={styles.dayLabel}>{dayName(day.dayOfWeek)}</Text>
            </View>
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
              const occupant = isCurrent ? undefined : shown.find((d) => d.dayOfWeek === day);
              // Copy needs a free day; move onto a taken day swaps the two.
              const taken = daySheet?.mode === 'copy' && selectedDays.has(day);
              return (
                <Pressable
                  key={day}
                  disabled={taken}
                  onPress={() => {
                    if (sheetDay && daySheet?.mode === 'copy') onChange(copyDayTo(days, sheetDay.key, day));
                    else if (sheetDay && occupant) onChange(swapDays(days, sheetDay.key, occupant.key));
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
                  {daySheet?.mode === 'move' && occupant ? (
                    <Text style={styles.sheetOptionHint} numberOfLines={1}>
                      {t.swapWith(occupant.title.trim() || dayName(day))}
                    </Text>
                  ) : null}
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
