import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { showAlert } from '../store/useDialogStore';
import { useI18n } from '../i18n';
import { colors, layout, spacing, typography } from '../theme';
import { LogoBar } from '../components/LogoBar';
import { ScreenHeader } from '../components/ScreenHeader';
import { FooterButton } from '../components/FooterButton';
import { OptionCard } from '../components/OptionCard';
import { Skeleton } from '../components/Skeleton';
import { ConfirmModal } from '../components/ConfirmModal';
import { invalidateExerciseCatalogue, loadExerciseCatalogue } from '../components/ExercisePickerSheet';
import { AddAnotherSheetButton, PasteWorkoutInput, ProgramEditor } from '../components/ProgramEditor';
import { applyDefaultProgram } from '../services/defaultWorkoutService';
import { archiveWorkout, invalidateWorkoutsByUserCache } from '../services/workoutService';
import {
  draftFromText,
  draftSchedule,
  isProgramDirty,
  loadProgramDraft,
  peekProgramDraft,
  saveProgram,
  textSchedule,
  visibleDays,
  type DraftDay,
} from '../services/programService';
import { slotLabel, type Schedule } from '../utils/schedule';
import { FEATURES } from '../config/features';
import { restartProgramCycle } from '../services/programReminder';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'MyWorkout'>;
type Route = RouteProp<RootStackParamList, 'MyWorkout' | 'CoachProgram'>;
/** edit = current program; import/review = replacing it with a pasted one. */
type Step = 'edit' | 'import' | 'review';
type Confirm = null | 'removeDays' | 'replaceImport' | 'replaceDefault' | 'discard';

/**
 * "Meu treino": the whole weekly program in the same editor as onboarding.
 * Edits are applied only on save (removed days are archived, so history is
 * kept). "Trocar meu treino" replaces the program by an imported one or the
 * ready-made one.
 *
 * Also opened by a coach for a student (route CoachProgram): same editor on
 * the student's program (RLS: migration_coach.sql).
 */
export default function MyWorkoutScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const currentUser = useAppStore((s) => s.currentUser);
  const { t, locale } = useI18n();
  const params = route.params as { studentId?: number | string; studentName?: string } | undefined;
  const studentId = params?.studentId != null ? Number(params.studentId) : null;

  const [step, setStep] = useState<Step>('edit');
  const userId = studentId ?? currentUser?.id;
  // Program as last loaded (warmed from Home): drawn at once, then replaced by fresh rows.
  const [initialDraft] = useState(() => (userId ? peekProgramDraft(userId) : null));
  const [original, setOriginal] = useState<DraftDay[]>(() => initialDraft ?? []);
  const [days, setDays] = useState<DraftDay[]>(() => initialDraft ?? []);
  // Fixed weekdays or a sequence, for the current program and an imported one.
  const [schedule, setSchedule] = useState<Schedule>(() => draftSchedule(initialDraft ?? []));
  const [imported, setImported] = useState<DraftDay[]>([]);
  const [importedSchedule, setImportedSchedule] = useState<Schedule>('week');
  const [pasted, setPasted] = useState('');
  const [appending, setAppending] = useState(false);
  const [isLoading, setIsLoading] = useState(() => initialDraft === null);
  const [isBusy, setIsBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const isSavingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const dayName = (day: number, mode: Schedule = schedule) => slotLabel(t, mode, day);
  const dirty = isProgramDirty(original, days, schedule);

  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const hasDraftRef = useRef(initialDraft !== null);

  /** `afterSave`: the saved program replaces the draft even though it differed from the original. */
  const load = useCallback(async (afterSave = false) => {
    if (!userId) return;
    if (!hasDraftRef.current) setIsLoading(true);
    try {
      const draft = await loadProgramDraft(userId);
      // Never throw away edits made while the fresh rows were on their way.
      if (!afterSave && hasDraftRef.current && dirtyRef.current) return;
      hasDraftRef.current = true;
      setOriginal(draft);
      setDays(draft);
      setSchedule(draftSchedule(draft));
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.genericError);
    } finally {
      setIsLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    load();
    if (userId) loadExerciseCatalogue(userId).catch(() => {});
  }, [load, userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [step]);

  if (!currentUser || !userId) return null;

  // ── Validation shared by edit and replace ────────────────────────────────
  const validate = (draft: DraftDay[], mode: Schedule): boolean => {
    const emptyDay = visibleDays(draft).find((d) => d.items.length === 0);
    if (emptyDay) {
      const label = dayName(emptyDay.dayOfWeek, mode);
      showAlert('', mode === 'sequence' ? t.onboardingEmptyWorkout(label) : t.onboardingEmptyDay(label));
      return false;
    }
    if (visibleDays(draft).length === 0) {
      showAlert('', t.onboardingNeedOneDay);
      return false;
    }
    return true;
  };

  const run = async (work: () => Promise<void>, after: () => void) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsBusy(true);
    try {
      await work();
      invalidateWorkoutsByUserCache(userId);
      // The program was updated: the "time to update" reminder starts over
      // (own program only — the coach can't write the student's profile).
      if (studentId === null) restartProgramCycle(userId).catch(() => {});
      after();
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.errorSavingWorkout);
    } finally {
      isSavingRef.current = false;
      setIsBusy(false);
    }
  };

  // "Treino de Segunda" for a weekday; a sequence slot is a name already ("Treino 2").
  const defaultTitleFor = (mode: Schedule) => (day: number) =>
    mode === 'sequence' ? dayName(day, mode) : t.onboardingDefaultDayTitle(dayName(day, mode));

  // ── Edit current program ─────────────────────────────────────────────────
  const removedDayNames = () => {
    const keptIds = new Set(visibleDays(days).map((d) => d.workoutId).filter(Boolean));
    const originalSchedule = draftSchedule(original);
    return original.filter((d) => !keptIds.has(d.workoutId)).map((d) => dayName(d.dayOfWeek, originalSchedule));
  };

  const handleSaveEdits = () => {
    if (!validate(days, schedule)) return;
    if (removedDayNames().length > 0) setConfirm('removeDays');
    else saveEdits();
  };

  const saveEdits = () =>
    run(
      () => saveProgram({ userId, draft: days, original, defaultTitle: defaultTitleFor(schedule), schedule }),
      async () => {
        invalidateExerciseCatalogue();
        await load(true);
        showAlert(t.savedSuccess, t.programSaved);
      },
    );

  // ── Replace: import ──────────────────────────────────────────────────────
  const handleOrganise = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const used = appending ? visibleDays(imported).map((d) => d.dayOfWeek) : [];
      const draft = draftFromText(pasted, await loadExerciseCatalogue(userId), used);
      if (draft.length === 0) {
        showAlert('', t.onboardingImportNothingFound);
        return;
      }
      setImported(
        appending
          ? [...imported.filter((d) => !d.hidden), ...draft].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          : draft,
      );
      // A sheet without weekdays ("Treino A, B, C") is done in sequence.
      if (!appending) setImportedSchedule(textSchedule(pasted));
      if (appending) setPasted('');
      setAppending(false);
      setStep('review');
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.genericError);
    } finally {
      setIsBusy(false);
    }
  };

  const replaceWithImport = () =>
    run(
      () =>
        saveProgram({
          userId,
          draft: imported,
          original,
          replaceAll: true,
          defaultTitle: defaultTitleFor(importedSchedule),
          schedule: importedSchedule,
        }),
      () => {
        invalidateExerciseCatalogue();
        navigation.goBack();
      },
    );

  // ── Replace: ready-made program ──────────────────────────────────────────
  const replaceWithDefault = () =>
    run(
      async () => {
        for (const day of original) if (day.workoutId) await archiveWorkout(day.workoutId);
        invalidateWorkoutsByUserCache(userId);
        await applyDefaultProgram(userId, locale);
      },
      () => navigation.goBack(),
    );

  const handleBack = () => {
    if (step === 'import') setStep(appending ? 'review' : 'edit');
    else if (step === 'review') setStep('import');
    else if (dirty) setConfirm('discard');
    else navigation.goBack();
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const renderEdit = () => (
    <>
      <ScreenHeader
        onBack={handleBack}
        title={studentId !== null ? t.studentProgramTitle(params?.studentName ?? '') : t.myWorkoutOverviewTitle}
        subtitle={
          studentId !== null
            ? t.studentProgramSubtitle
            : schedule === 'sequence'
              ? t.myWorkoutSubtitleSequence
              : t.myWorkoutSubtitle
        }
      />
      {isLoading ? (
        [...Array(3)].map((_, i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <Skeleton width="100%" height={120} />
          </View>
        ))
      ) : (
        <>
          <ProgramEditor
            userId={userId}
            days={days}
            onChange={setDays}
            schedule={schedule}
            onScheduleChange={setSchedule}
          />
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {t.replaceSectionTitle}
          </Text>
          <OptionCard
            title={t.replaceDefaultTitle}
            description={t.replaceDefaultDesc}
            onPress={() => setConfirm('replaceDefault')}
          />
          <OptionCard
            title={t.replaceImportTitle}
            description={t.replaceImportDesc}
            onPress={() => setStep('import')}
            badge={FEATURES.importWorkout ? undefined : t.comingSoon}
            disabled={!FEATURES.importWorkout}
          />
        </>
      )}
    </>
  );

  const renderImport = () => (
    <>
      <ScreenHeader onBack={handleBack} title={t.replaceImportPasteTitle} subtitle={t.onboardingImportPasteSubtitle} />
      <PasteWorkoutInput value={pasted} onChangeText={setPasted} />
    </>
  );

  const renderReview = () => (
    <>
      <ScreenHeader onBack={handleBack} title={t.replaceReviewTitle} subtitle={t.replaceReviewSubtitle} />
      <ProgramEditor
        userId={userId}
        days={imported}
        onChange={setImported}
        schedule={importedSchedule}
        onScheduleChange={setImportedSchedule}
      />
      <AddAnotherSheetButton
        onPress={() => {
          setAppending(true);
          setPasted('');
          setStep('import');
        }}
      />
    </>
  );

  const importedCount = visibleDays(imported).length;
  const confirmProps = {
    removeDays: {
      title: draftSchedule(original) === 'sequence' ? t.removeWorkoutsConfirmTitle : t.removeDaysConfirmTitle,
      message: (draftSchedule(original) === 'sequence' ? t.removeWorkoutsConfirmMsg : t.removeDaysConfirmMsg)(
        removedDayNames().join(', '),
      ),
      confirmLabel: t.saveChanges,
      onConfirm: () => {
        setConfirm(null);
        saveEdits();
      },
      danger: false,
    },
    replaceImport: {
      title: t.replaceConfirmTitle,
      message: t.replaceConfirmMsg,
      confirmLabel: t.replaceConfirm,
      onConfirm: () => {
        setConfirm(null);
        replaceWithImport();
      },
      danger: true,
    },
    replaceDefault: {
      title: t.replaceConfirmTitle,
      message: t.replaceConfirmMsg,
      confirmLabel: t.replaceConfirm,
      onConfirm: () => {
        setConfirm(null);
        replaceWithDefault();
      },
      danger: true,
    },
    discard: {
      title: t.discardChangesTitle,
      message: t.discardChangesMsg,
      confirmLabel: t.discardChanges,
      onConfirm: () => {
        setConfirm(null);
        navigation.goBack();
      },
      danger: true,
    },
  } as const;
  const activeConfirm = confirm ? confirmProps[confirm] : null;

  return (
    <SafeAreaView style={layout.screen} edges={['left', 'right']}>
      <LogoBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[layout.content, layout.contentWithFooter]}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'edit' && renderEdit()}
          {step === 'import' && renderImport()}
          {step === 'review' && renderReview()}
        </ScrollView>

        {step === 'edit' && dirty && <FooterButton label={t.saveChanges} onPress={handleSaveEdits} loading={isBusy} />}
        {step === 'import' && (
          <FooterButton label={t.onboardingImportButton} onPress={handleOrganise} disabled={!pasted.trim()} loading={isBusy} />
        )}
        {step === 'review' && (
          <FooterButton
            label={importedSchedule === 'sequence' ? t.replaceSaveSequence(importedCount) : t.replaceSave(importedCount)}
            onPress={() => validate(imported, importedSchedule) && setConfirm('replaceImport')}
            disabled={importedCount === 0}
            loading={isBusy}
          />
        )}
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={activeConfirm !== null}
        title={activeConfirm?.title ?? ''}
        message={activeConfirm?.message ?? ''}
        confirmLabel={activeConfirm?.confirmLabel ?? ''}
        cancelLabel={t.cancel}
        onConfirm={() => activeConfirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
        confirmDanger={activeConfirm?.danger ?? false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.h3, color: colors.oliveDark, marginTop: spacing.xl, marginBottom: spacing.md },
});
