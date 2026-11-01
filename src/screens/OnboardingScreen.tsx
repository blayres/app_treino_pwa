import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { showAlert } from '../store/useDialogStore';
import { useI18n } from '../i18n';
import { colors } from '../theme';
import { LogoBar } from '../components/LogoBar';
import {
  ExercisePickerSheet,
  invalidateExerciseCatalogue,
  loadExerciseCatalogue,
} from '../components/ExercisePickerSheet';
import type { Exercise } from '../services/types';
import { applyDefaultProgram, DEFAULT_PROGRAM } from '../services/defaultWorkoutService';
import {
  createCustomExercise,
  createWorkoutForUser,
  DEFAULT_CUSTOM_SCHEME,
  invalidateWorkoutsByUserCache,
} from '../services/workoutService';
import { assignWeekdays, matchExercise, parseWorkoutText } from '../services/workoutTextParser';
import { markOnboarded } from '../services/authService';
import { styles } from './OnboardingScreen.styles';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
type Step = 'choose' | 'default' | 'import' | 'editor';
type EditorMode = 'import' | 'manual';

type DraftItem = {
  key: string;
  /** Catalogue exercise; null = will be created as a private exercise on save. */
  exercise: Exercise | null;
  name: string;
  scheme: string;
  restSeconds: number | null;
  /** Original imported text when it was matched to a differently named exercise. */
  wrote: string | null;
};

type DraftDay = {
  key: string;
  dayOfWeek: number;
  title: string;
  items: DraftItem[];
};

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

// ── Small inline icons (same stroke style as the app's other SVG icons) ──────
function Icon({ path, color }: { path: string; color: string }) {
  return (
    // @ts-ignore — SVG JSX is valid in react-native-web / DOM environments
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }} aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
const ICON_ZAP = 'M13 2 3 14h9l-1 8 10-12h-9l1-8z';
const ICON_PASTE = 'M9 4h6M9 4a1 1 0 0 0-1 1v1h8V5a1 1 0 0 0-1-1M8 6H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2M8 12h8M8 16h5';
const ICON_PENCIL = 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z';

export default function OnboardingScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useAppStore((s) => s.currentUser);
  const needsOnboarding = useAppStore((s) => s.needsOnboarding);
  const setNeedsOnboarding = useAppStore((s) => s.setNeedsOnboarding);
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('choose');
  const [mode, setMode] = useState<EditorMode>('manual');
  const [pasted, setPasted] = useState('');
  const [days, setDays] = useState<DraftDay[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [pickerDayKey, setPickerDayKey] = useState<string | null>(null);
  const [changeDayKey, setChangeDayKey] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Days already saved, so a retry after a partial failure doesn't duplicate them.
  const savedDaysRef = useRef<Set<number>>(new Set());

  // Already-onboarded users are redirected Home by App.tsx; never let them
  // create a second program from here (it would clash with existing days).
  const isSavingRef = useRef(false);

  // Warm the exercise catalogue so "Importar" and the picker feel instant.
  useEffect(() => {
    if (currentUser) loadExerciseCatalogue(currentUser.id).catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
    setPickerDayKey(null);
    setChangeDayKey(null);
  }, [step]);

  if (!currentUser || !needsOnboarding) return null;
  const userId = currentUser.id;
  const dayName = (day: number) => t.dayLabels[day];
  const shortDay = (day: number) => t.dayLabels[day].slice(0, 3);

  const finish = async () => {
    await markOnboarded(userId);
    invalidateWorkoutsByUserCache(userId);
    setNeedsOnboarding(false);
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleUseDefault = async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsBusy(true);
    try {
      await applyDefaultProgram(userId);
      await finish();
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.onboardingError);
      setIsBusy(false);
    } finally {
      isSavingRef.current = false;
    }
  };

  const handleOrganise = async () => {
    if (isBusy) return;
    const parsed = parseWorkoutText(pasted);
    if (parsed.length === 0) {
      showAlert('', t.onboardingImportNothingFound);
      return;
    }
    setIsBusy(true);
    try {
      const catalogue = await loadExerciseCatalogue(userId);
      const assigned = assignWeekdays(parsed, () => '');
      setDays(
        assigned
          .map((day) => ({
            key: nextKey(),
            dayOfWeek: day.dayOfWeek!,
            title: day.title,
            items: day.exercises.map((parsedItem) => {
              const match = matchExercise(parsedItem.name, catalogue);
              const exercise = match?.item ?? null;
              return {
                key: nextKey(),
                exercise,
                name: exercise?.name ?? parsedItem.name,
                scheme: parsedItem.scheme ?? exercise?.scheme ?? DEFAULT_CUSTOM_SCHEME,
                restSeconds: parsedItem.restSeconds,
                wrote: match && !match.exact ? parsedItem.name : null,
              };
            }),
          }))
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
      );
      setMode('import');
      setStep('editor');
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.genericError);
    } finally {
      setIsBusy(false);
    }
  };

  const startManual = () => {
    setDays([]);
    setMode('manual');
    setStep('editor');
  };

  const toggleDay = (day: number) => {
    setDays((prev) => {
      if (prev.some((d) => d.dayOfWeek === day)) return prev.filter((d) => d.dayOfWeek !== day);
      return [...prev, { key: nextKey(), dayOfWeek: day, title: '', items: [] }].sort(
        (a, b) => a.dayOfWeek - b.dayOfWeek,
      );
    });
  };

  const updateDay = (key: string, patch: Partial<DraftDay>) =>
    setDays((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...patch } : d)).sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    );

  const updateItem = (dayKey: string, itemKey: string, patch: Partial<DraftItem>) =>
    setDays((prev) =>
      prev.map((d) =>
        d.key === dayKey
          ? { ...d, items: d.items.map((i) => (i.key === itemKey ? { ...i, ...patch } : i)) }
          : d,
      ),
    );

  const removeItem = (dayKey: string, itemKey: string) =>
    setDays((prev) =>
      prev.map((d) => (d.key === dayKey ? { ...d, items: d.items.filter((i) => i.key !== itemKey) } : d)),
    );

  const handlePick = (exercise: Exercise) => {
    if (!pickerDayKey) return;
    const dayKey = pickerDayKey;
    setPickerDayKey(null);
    setDays((prev) =>
      prev.map((d) =>
        d.key === dayKey
          ? {
              ...d,
              items: [
                ...d.items,
                {
                  key: nextKey(),
                  exercise,
                  name: exercise.name,
                  scheme: exercise.scheme,
                  restSeconds: null,
                  wrote: null,
                },
              ],
            }
          : d,
      ),
    );
  };

  const handleSave = async () => {
    if (isSavingRef.current) return;
    if (days.length === 0) {
      showAlert('', t.onboardingNeedOneDay);
      return;
    }
    const emptyDay = days.find((d) => d.items.length === 0);
    if (emptyDay) {
      showAlert('', t.onboardingEmptyDay(dayName(emptyDay.dayOfWeek)));
      return;
    }

    isSavingRef.current = true;
    setIsBusy(true);
    try {
      // Create each new (unmatched) exercise once, even if used on several days.
      const createdByName = new Map<string, Exercise>();
      for (const day of days) {
        for (const item of day.items) {
          if (item.exercise) continue;
          const key = item.name.trim().toLowerCase();
          if (!createdByName.has(key)) {
            createdByName.set(
              key,
              await createCustomExercise({
                userId,
                name: item.name,
                scheme: item.scheme,
                restSeconds: item.restSeconds ?? undefined,
              }),
            );
          }
        }
      }
      if (createdByName.size > 0) invalidateExerciseCatalogue();

      for (const day of days) {
        if (savedDaysRef.current.has(day.dayOfWeek)) continue;
        await createWorkoutForUser({
          userId,
          dayOfWeek: day.dayOfWeek,
          title: day.title.trim() || t.onboardingDefaultDayTitle(dayName(day.dayOfWeek)),
          items: day.items.map((item) => {
            const exercise = item.exercise ?? createdByName.get(item.name.trim().toLowerCase())!;
            const scheme = item.scheme.trim();
            return {
              exerciseId: exercise.id,
              scheme: scheme && scheme !== exercise.scheme ? scheme : null,
              restSeconds:
                item.restSeconds != null && item.restSeconds !== exercise.rest_seconds ? item.restSeconds : null,
            };
          }),
        });
        savedDaysRef.current.add(day.dayOfWeek);
      }

      await finish();
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.onboardingError);
      setIsBusy(false);
    } finally {
      isSavingRef.current = false;
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const goBackButton = (to: Step) => (
    <Pressable onPress={() => setStep(to)} hitSlop={16} accessibilityRole="button">
      <Text style={styles.backLabel}>{t.back}</Text>
    </Pressable>
  );

  const footerButton = (label: string, onPress: () => void, disabled = false) => (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || isBusy}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.primaryButtonPressed,
          (disabled || isBusy) && styles.primaryButtonDisabled,
        ]}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.textPrimaryDark} />
        ) : (
          <Text style={styles.primaryButtonLabel}>{label}</Text>
        )}
      </Pressable>
    </View>
  );

  const renderChoose = () => (
    <>
      <Text style={styles.title}>{t.onboardingTitle(currentUser.name)}</Text>
      <Text style={styles.subtitle}>{t.onboardingSubtitle}</Text>
      {[
        { icon: ICON_ZAP, title: t.onboardingDefaultTitle, desc: t.onboardingDefaultDesc, onPress: () => setStep('default'), highlight: true },
        { icon: ICON_PASTE, title: t.onboardingImportTitle, desc: t.onboardingImportDesc, onPress: () => setStep('import'), highlight: false },
        { icon: ICON_PENCIL, title: t.onboardingManualTitle, desc: t.onboardingManualDesc, onPress: startManual, highlight: false },
      ].map((option) => (
        <Pressable
          key={option.title}
          onPress={option.onPress}
          accessibilityRole="button"
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.option,
            option.highlight && styles.optionHighlighted,
            hovered && !option.highlight && styles.optionHovered,
            pressed && styles.optionPressed,
          ]}
        >
          <View style={[styles.optionIcon, option.highlight && styles.optionIconHighlighted]}>
            <Icon path={option.icon} color={option.highlight ? colors.textPrimaryDark : colors.olive} />
          </View>
          <View style={styles.optionBody}>
            <View style={styles.optionTitleRow}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              {option.highlight && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t.onboardingFastest}</Text>
                </View>
              )}
            </View>
            <Text style={styles.optionDesc}>{option.desc}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </>
  );

  const renderDefault = () => (
    <>
      {goBackButton('choose')}
      <Text style={styles.title}>{t.onboardingDefaultPreviewTitle}</Text>
      <Text style={styles.subtitle}>{t.onboardingDefaultPreviewSubtitle}</Text>
      <View style={styles.card}>
        {DEFAULT_PROGRAM.map((day, index) => (
          <View
            key={day.day_of_week}
            style={[styles.previewDay, index === DEFAULT_PROGRAM.length - 1 && styles.previewDayLast]}
          >
            <Text style={styles.dayLabel}>{dayName(day.day_of_week)}</Text>
            <Text style={styles.previewTitle}>{day.title}</Text>
            <Text style={styles.previewExercises}>{day.exercises.join(' · ')}</Text>
          </View>
        ))}
      </View>
    </>
  );

  const renderImport = () => (
    <>
      {goBackButton('choose')}
      <Text style={styles.title}>{t.onboardingImportPasteTitle}</Text>
      <Text style={styles.subtitle}>{t.onboardingImportPasteSubtitle}</Text>
      <TextInput
        style={styles.pasteInput}
        value={pasted}
        onChangeText={setPasted}
        placeholder={t.onboardingImportPlaceholder}
        placeholderTextColor={colors.textSecondary + '99'}
        multiline
        autoFocus
        autoCorrect={false}
        autoCapitalize="sentences"
        accessibilityLabel={t.onboardingImportPasteTitle}
      />
    </>
  );

  const renderEditor = () => {
    const usedDays = new Set(days.map((d) => d.dayOfWeek));
    return (
      <>
        {goBackButton(mode === 'import' ? 'import' : 'choose')}
        <Text style={styles.title}>
          {mode === 'import' ? t.onboardingReviewTitle : t.onboardingManualEditorTitle}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'import' ? t.onboardingReviewSubtitle : t.onboardingManualEditorSubtitle}
        </Text>

        <Text style={styles.sectionLabel}>{t.onboardingTrainingDays}</Text>
        <View style={styles.dayChips}>
          {ALL_DAYS.map((day) => {
            const selected = usedDays.has(day);
            return (
              <Pressable
                key={day}
                onPress={() => toggleDay(day)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={dayName(day)}
                style={[styles.dayChip, selected && styles.dayChipSelected]}
              >
                <Text style={[styles.dayChipLabel, selected && styles.dayChipLabelSelected]}>
                  {shortDay(day)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {days.map((day) => (
          <View key={day.key} style={styles.card}>
            <View style={styles.dayCardHeader}>
              <Text style={styles.dayLabel}>{dayName(day.dayOfWeek)}</Text>
              <Pressable onPress={() => setChangeDayKey(day.key)} hitSlop={10} accessibilityRole="button">
                <Text style={styles.changeDay}>{t.onboardingChangeDay}</Text>
              </Pressable>
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
                  {item.wrote && (
                    <Pressable
                      onPress={() =>
                        updateItem(day.key, item.key, { exercise: null, name: item.wrote!, wrote: null })
                      }
                      accessibilityRole="button"
                    >
                      <Text style={styles.youWrote}>{t.onboardingYouWrote(item.wrote)}</Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  style={styles.schemeInput}
                  value={item.scheme}
                  onChangeText={(scheme) => updateItem(day.key, item.key, { scheme })}
                  placeholder={DEFAULT_CUSTOM_SCHEME}
                  placeholderTextColor={colors.textSecondary + '99'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  accessibilityLabel={`${item.name} ${item.scheme}`}
                />
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
      </>
    );
  };

  const changeDay = days.find((d) => d.key === changeDayKey) ?? null;
  const pickerDay = days.find((d) => d.key === pickerDayKey) ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <LogoBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'choose' && renderChoose()}
          {step === 'default' && renderDefault()}
          {step === 'import' && renderImport()}
          {step === 'editor' && renderEditor()}
        </ScrollView>

        {step === 'default' && footerButton(t.onboardingStartWithThis, handleUseDefault)}
        {step === 'import' && footerButton(t.onboardingImportButton, handleOrganise, !pasted.trim())}
        {step === 'editor' &&
          footerButton(t.onboardingSave(days.length), handleSave, days.length === 0)}
      </KeyboardAvoidingView>

      <ExercisePickerSheet
        visible={pickerDay !== null}
        userId={userId}
        selectedIds={pickerDay?.items.flatMap((i) => (i.exercise ? [i.exercise.id] : [])) ?? []}
        onPick={handlePick}
        onClose={() => setPickerDayKey(null)}
      />

      <Modal visible={changeDay !== null} transparent animationType="fade" onRequestClose={() => setChangeDayKey(null)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setChangeDayKey(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t.onboardingChangeDay}</Text>
            {ALL_DAYS.map((day) => {
              const isCurrent = changeDay?.dayOfWeek === day;
              const taken = !isCurrent && days.some((d) => d.dayOfWeek === day);
              return (
                <Pressable
                  key={day}
                  disabled={taken}
                  onPress={() => {
                    if (changeDay) updateDay(changeDay.key, { dayOfWeek: day });
                    setChangeDayKey(null);
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
    </SafeAreaView>
  );
}
