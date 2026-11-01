import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { showAlert } from '../store/useDialogStore';
import { useI18n } from '../i18n';
import { colors, layout } from '../theme';
import { LogoBar } from '../components/LogoBar';
import { ScreenHeader } from '../components/ScreenHeader';
import { FooterButton } from '../components/FooterButton';
import { OptionCard } from '../components/OptionCard';
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
  const renderChoose = () => (
    <>
      <ScreenHeader title={t.onboardingTitle(currentUser.name)} subtitle={t.onboardingSubtitle} />
      <OptionCard
        title={t.onboardingDefaultTitle}
        description={t.onboardingDefaultDesc}
        onPress={() => setStep('default')}
        icon={<Icon path={ICON_ZAP} color={colors.textPrimaryDark} />}
        badge={t.onboardingFastest}
        highlight
      />
      <OptionCard
        title={t.onboardingManualTitle}
        description={t.onboardingManualDesc}
        onPress={startManual}
        icon={<Icon path={ICON_PENCIL} color={colors.olive} />}
      />
      {/* Import stays visible as "Em breve" until it is backed by AI. */}
      <OptionCard
        title={t.onboardingImportTitle}
        description={t.onboardingImportDesc}
        onPress={() => setStep('import')}
        icon={<Icon path={ICON_PASTE} color={colors.olive} />}
        badge={FEATURES.importWorkout ? undefined : t.comingSoon}
        disabled={!FEATURES.importWorkout}
      />
    </>
  );

  const renderDefault = () => (
    <>
      <ScreenHeader
        onBack={() => setStep('choose')}
        title={t.onboardingDefaultPreviewTitle}
        subtitle={t.onboardingDefaultPreviewSubtitle}
      />
      <DefaultProgramPreview />
    </>
  );

  const renderImport = () => (
    <>
      <ScreenHeader
        onBack={() => setStep(appending ? 'editor' : 'choose')}
        title={t.onboardingImportPasteTitle}
        subtitle={t.onboardingImportPasteSubtitle}
      />
      <PasteWorkoutInput value={pasted} onChangeText={setPasted} />
    </>
  );

  const renderEditor = () => (
    <>
      <ScreenHeader
        onBack={() => setStep(mode === 'import' ? 'import' : 'choose')}
        title={mode === 'import' ? t.onboardingReviewTitle : t.onboardingManualEditorTitle}
        subtitle={mode === 'import' ? t.onboardingReviewSubtitle : t.onboardingManualEditorSubtitle}
      />
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
    <SafeAreaView style={layout.screen} edges={['left', 'right']}>
      <LogoBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={[layout.content, layout.contentWithFooter]} keyboardShouldPersistTaps="handled">
          {step === 'choose' && renderChoose()}
          {step === 'default' && renderDefault()}
          {step === 'import' && renderImport()}
          {step === 'editor' && renderEditor()}
        </ScrollView>

        {step === 'default' && (
          <FooterButton label={t.onboardingStartWithThis} onPress={handleUseDefault} loading={isBusy} />
        )}
        {step === 'import' && (
          <FooterButton label={t.onboardingImportButton} onPress={handleOrganise} disabled={!pasted.trim()} loading={isBusy} />
        )}
        {step === 'editor' && (
          <FooterButton
            label={t.onboardingSave(shownDays.length)}
            onPress={handleSave}
            disabled={shownDays.length === 0}
            loading={isBusy}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Read-only preview of the ready-made program (also used by "Meu treino"). */
export function DefaultProgramPreview() {
  const { t } = useI18n();
  return (
    <View style={layout.card}>
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
