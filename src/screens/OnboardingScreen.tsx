import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { showAlert } from '../store/useDialogStore';
import { useI18n } from '../i18n';
import { colors } from '../theme';
import { LogoBar } from '../components/LogoBar';
import { invalidateExerciseCatalogue, loadExerciseCatalogue } from '../components/ExercisePickerSheet';
import { AddAnotherSheetButton, PasteWorkoutInput, ProgramEditor } from '../components/ProgramEditor';
import { applyDefaultProgram, DEFAULT_PROGRAM } from '../services/defaultWorkoutService';
import { invalidateWorkoutsByUserCache } from '../services/workoutService';
import { draftFromText, saveProgram, visibleDays, type DraftDay } from '../services/programService';
import { markOnboarded } from '../services/authService';
import { FEATURES } from '../config/features';
import { styles } from './OnboardingScreen.styles';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
type Step = 'choose' | 'default' | 'import' | 'editor';
type EditorMode = 'import' | 'manual';

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
  // Pasting a second sheet: append its days instead of replacing the draft.
  const [appending, setAppending] = useState(false);
  const [days, setDays] = useState<DraftDay[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Already-onboarded users are redirected Home by App.tsx; never let them
  // create a second program from here (it would clash with existing days).
  const isSavingRef = useRef(false);
  // Weekdays saved by an earlier failed attempt, so a retry doesn't duplicate them.
  const createdDaysRef = useRef<Set<number>>(new Set());

  // Warm the exercise catalogue so "Importar" and the picker feel instant.
  useEffect(() => {
    if (currentUser) loadExerciseCatalogue(currentUser.id).catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [step]);

  if (!currentUser || !needsOnboarding) return null;
  const userId = currentUser.id;
  const dayName = (day: number) => t.dayLabels[day];
  const shownDays = visibleDays(days);

  const finish = async () => {
    await markOnboarded(userId);
    invalidateWorkoutsByUserCache(userId);
    setNeedsOnboarding(false);
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const runSaving = async (work: () => Promise<void>) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsBusy(true);
    try {
      await work();
      await finish();
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.onboardingError);
      setIsBusy(false);
    } finally {
      isSavingRef.current = false;
    }
  };

  const handleUseDefault = () => runSaving(() => applyDefaultProgram(userId));

  const handleOrganise = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const used = appending ? visibleDays(days).map((d) => d.dayOfWeek) : [];
      const draft = draftFromText(pasted, await loadExerciseCatalogue(userId), used);
      if (draft.length === 0) {
        showAlert('', t.onboardingImportNothingFound);
        return;
      }
      setDays(appending ? [...days.filter((d) => !d.hidden), ...draft].sort((a, b) => a.dayOfWeek - b.dayOfWeek) : draft);
      if (appending) setPasted('');
      setAppending(false);
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

  const handleSave = () => {
    if (shownDays.length === 0) {
      showAlert('', t.onboardingNeedOneDay);
      return;
    }
    const emptyDay = shownDays.find((d) => d.items.length === 0);
    if (emptyDay) {
      showAlert('', t.onboardingEmptyDay(dayName(emptyDay.dayOfWeek)));
      return;
    }
    runSaving(async () => {
      await saveProgram({
        userId,
        draft: days,
        original: [],
        defaultTitle: (day) => t.onboardingDefaultDayTitle(dayName(day)),
        createdDays: createdDaysRef.current,
      });
      invalidateExerciseCatalogue();
    });
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
        { icon: ICON_ZAP, title: t.onboardingDefaultTitle, desc: t.onboardingDefaultDesc, onPress: () => setStep('default'), highlight: true, disabled: false },
        { icon: ICON_PENCIL, title: t.onboardingManualTitle, desc: t.onboardingManualDesc, onPress: startManual, highlight: false, disabled: false },
        // Import stays visible as "Em breve" until it is backed by AI.
        { icon: ICON_PASTE, title: t.onboardingImportTitle, desc: t.onboardingImportDesc, onPress: () => setStep('import'), highlight: false, disabled: !FEATURES.importWorkout },
      ].map((option) => (
        <Pressable
          key={option.title}
          onPress={option.onPress}
          disabled={option.disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: option.disabled }}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.option,
            option.highlight && styles.optionHighlighted,
            hovered && !option.highlight && !option.disabled && styles.optionHovered,
            pressed && styles.optionPressed,
            option.disabled && styles.optionDisabled,
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
              {option.disabled && (
                <View style={[styles.badge, styles.badgeMuted]}>
                  <Text style={[styles.badgeText, styles.badgeTextMuted]}>{t.comingSoon}</Text>
                </View>
              )}
            </View>
            <Text style={styles.optionDesc}>{option.desc}</Text>
          </View>
          {!option.disabled && <Text style={styles.chevron}>›</Text>}
        </Pressable>
      ))}
    </>
  );

  const renderDefault = () => (
    <>
      {goBackButton('choose')}
      <Text style={styles.title}>{t.onboardingDefaultPreviewTitle}</Text>
      <Text style={styles.subtitle}>{t.onboardingDefaultPreviewSubtitle}</Text>
      <DefaultProgramPreview />
    </>
  );

  const renderImport = () => (
    <>
      {goBackButton(appending ? 'editor' : 'choose')}
      <Text style={styles.title}>{t.onboardingImportPasteTitle}</Text>
      <Text style={styles.subtitle}>{t.onboardingImportPasteSubtitle}</Text>
      <PasteWorkoutInput value={pasted} onChangeText={setPasted} />
    </>
  );

  const renderEditor = () => (
    <>
      {goBackButton(mode === 'import' ? 'import' : 'choose')}
      <Text style={styles.title}>{mode === 'import' ? t.onboardingReviewTitle : t.onboardingManualEditorTitle}</Text>
      <Text style={styles.subtitle}>
        {mode === 'import' ? t.onboardingReviewSubtitle : t.onboardingManualEditorSubtitle}
      </Text>
      <ProgramEditor userId={userId} days={days} onChange={setDays} />
      {mode === 'import' && (
        <AddAnotherSheetButton
          onPress={() => {
            setAppending(true);
            setPasted('');
            setStep('import');
          }}
        />
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <LogoBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {step === 'choose' && renderChoose()}
          {step === 'default' && renderDefault()}
          {step === 'import' && renderImport()}
          {step === 'editor' && renderEditor()}
        </ScrollView>

        {step === 'default' && footerButton(t.onboardingStartWithThis, handleUseDefault)}
        {step === 'import' && footerButton(t.onboardingImportButton, handleOrganise, !pasted.trim())}
        {step === 'editor' && footerButton(t.onboardingSave(shownDays.length), handleSave, shownDays.length === 0)}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Read-only preview of the ready-made program (also used by "Meu treino"). */
export function DefaultProgramPreview() {
  const { t } = useI18n();
  return (
    <View style={styles.card}>
      {DEFAULT_PROGRAM.map((day, index) => (
        <View
          key={day.day_of_week}
          style={[styles.previewDay, index === DEFAULT_PROGRAM.length - 1 && styles.previewDayLast]}
        >
          <Text style={styles.dayLabel}>{t.dayLabels[day.day_of_week]}</Text>
          <Text style={styles.previewTitle}>{day.title}</Text>
          <Text style={styles.previewExercises}>{day.exercises.join(' · ')}</Text>
        </View>
      ))}
    </View>
  );
}
