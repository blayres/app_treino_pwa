import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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
  isProgramDirty,
  loadProgramDraft,
  saveProgram,
  visibleDays,
  type DraftDay,
} from '../services/programService';
import { FEATURES } from '../config/features';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'MyWorkout'>;
/** edit = current program; import/review = replacing it with a pasted one. */
type Step = 'edit' | 'import' | 'review';
type Confirm = null | 'removeDays' | 'replaceImport' | 'replaceDefault' | 'discard';

/**
 * "Meu treino": the whole weekly program in the same editor as onboarding.
 * Edits are applied only on save (removed days are archived, so history is
 * kept). "Trocar meu treino" replaces the program by an imported one or the
 * ready-made one.
 */
export default function MyWorkoutScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useAppStore((s) => s.currentUser);
  const { t } = useI18n();

  const [step, setStep] = useState<Step>('edit');
  const [original, setOriginal] = useState<DraftDay[]>([]);
  const [days, setDays] = useState<DraftDay[]>([]);
  const [imported, setImported] = useState<DraftDay[]>([]);
  const [pasted, setPasted] = useState('');
  const [appending, setAppending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const isSavingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const userId = currentUser?.id;
  const dayName = (day: number) => t.dayLabels[day];
  const dirty = isProgramDirty(original, days);

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const draft = await loadProgramDraft(userId);
      setOriginal(draft);
      setDays(draft);
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
  const validate = (draft: DraftDay[]): boolean => {
    const emptyDay = visibleDays(draft).find((d) => d.items.length === 0);
    if (emptyDay) {
      showAlert('', t.onboardingEmptyDay(dayName(emptyDay.dayOfWeek)));
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
      after();
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.errorSavingWorkout);
    } finally {
      isSavingRef.current = false;
      setIsBusy(false);
    }
  };

  const defaultTitle = (day: number) => t.onboardingDefaultDayTitle(dayName(day));

  // ── Edit current program ─────────────────────────────────────────────────
  const removedDayNames = () => {
    const keptIds = new Set(visibleDays(days).map((d) => d.workoutId).filter(Boolean));
    return original.filter((d) => !keptIds.has(d.workoutId)).map((d) => dayName(d.dayOfWeek));
  };

  const handleSaveEdits = () => {
    if (!validate(days)) return;
    if (removedDayNames().length > 0) setConfirm('removeDays');
    else saveEdits();
  };

  const saveEdits = () =>
    run(
      () => saveProgram({ userId, draft: days, original, defaultTitle }),
      async () => {
        invalidateExerciseCatalogue();
        await load();
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
      () => saveProgram({ userId, draft: imported, original, replaceAll: true, defaultTitle }),
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
        await applyDefaultProgram(userId);
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
      <ScreenHeader onBack={handleBack} title={t.myWorkoutOverviewTitle} subtitle={t.myWorkoutSubtitle} />
      {isLoading ? (
        [...Array(3)].map((_, i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <Skeleton width="100%" height={120} />
          </View>
        ))
      ) : (
        <>
          <ProgramEditor userId={userId} days={days} onChange={setDays} />
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
      <ProgramEditor userId={userId} days={imported} onChange={setImported} />
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
      title: t.removeDaysConfirmTitle,
      message: t.removeDaysConfirmMsg(removedDayNames().join(', ')),
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
            label={t.replaceSave(importedCount)}
            onPress={() => validate(imported) && setConfirm('replaceImport')}
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
