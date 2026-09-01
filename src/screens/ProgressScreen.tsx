import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { useI18n } from '../i18n';
import { colors, spacing, typography } from '../theme';
import { LineChart } from '../components/LineChart';
import { Skeleton } from '../components/Skeleton';
import {
  getLoadHistoryByUser,
  getTrackedExercises,
} from '../services/progressService';
import {
  buildProgressionSeries,
  calculatePersonalRecords,
  calculateVolumeComparison,
  countImprovedExercises,
  countNewPersonalRecords,
  type PeriodKey,
  type LoadHistoryRow,
  type PersonalRecord,
  type ProgressDataPoint,
} from '../services/progressUtils';
import { StyleSheet } from 'react-native';

const PERIODS: PeriodKey[] = ['1m', '3m', '6m', 'all'];

type TrackedExercise = { exercise_id: number; exercise_name: string };

export default function ProgressScreen() {
  const navigation = useNavigation();
  const currentUser = useAppStore(state => state.currentUser);
  const { t } = useI18n();
  const { width: screenWidth } = useWindowDimensions();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<(LoadHistoryRow & { scheme: string })[]>([]);
  const [trackedExercises, setTrackedExercises] = useState<TrackedExercise[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('3m');
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);

  // Derived state
  const now = new Date();
  const prs: PersonalRecord[] = calculatePersonalRecords(history);
  const volumeResult = calculateVolumeComparison(history, now, period);
  const improvedCount = countImprovedExercises(history, now, period);
  const newPRCount = countNewPersonalRecords(history, now, period);
  const progressionData: ProgressDataPoint[] = selectedExerciseId
    ? buildProgressionSeries(history, selectedExerciseId, now, period)
    : [];

  const load = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const [hist, exercises] = await Promise.all([
        getLoadHistoryByUser(currentUser.id),
        getTrackedExercises(currentUser.id),
      ]);
      setHistory(hist);
      setTrackedExercises(exercises);
      if (exercises.length > 0 && selectedExerciseId === null) {
        setSelectedExerciseId(exercises[0].exercise_id);
      }
    } catch {
      setError(t.progressError);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, t.progressError]);

  useEffect(() => { void load(); }, [load]);

  const periodLabel = (p: PeriodKey): string => {
    if (p === '1m') return t.period1m;
    if (p === '3m') return t.period3m;
    if (p === '6m') return t.period6m;
    return t.periodAll;
  };

  const isEmpty = !isLoading && history.length === 0;
  const chartWidth = screenWidth - spacing.md * 2 - 2; // full card inner width

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
          <Text style={styles.backLabel}>{t.back}</Text>
        </Pressable>
        <Text style={styles.title}>{t.progress}</Text>
        <Text style={styles.subtitle}>{t.progressSubtitle}</Text>
      </View>

      {/* Period filter */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <Pressable
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodLabel, period === p && styles.periodLabelActive]}>
              {periodLabel(p)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Error state */}
        {error ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryLabel}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : isEmpty ? (
          /* Empty state */
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t.loadHistoryEmpty}</Text>
          </View>
        ) : (
          <>
            {/* ── Summary card ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t.progressSummary}</Text>

              {isLoading ? (
                <>
                  <Skeleton width="60%" height={14} style={{ marginTop: spacing.sm }} />
                  <Skeleton width="50%" height={14} style={{ marginTop: spacing.xs }} />
                  <Skeleton width="70%" height={14} style={{ marginTop: spacing.xs }} />
                </>
              ) : (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryValue}>{improvedCount}</Text>
                    <Text style={styles.summaryDesc}>
                      {t.improvedExercises(improvedCount)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryValue}>{newPRCount}</Text>
                    <Text style={styles.summaryDesc}>
                      {t.newPersonalRecords(newPRCount)}
                    </Text>
                  </View>
                  <View style={[styles.summaryRow, { marginTop: spacing.sm }]}>
                    <View>
                      <Text style={styles.summaryLabel}>{t.volumeLabel}</Text>
                      <Text style={styles.summaryValueLarge}>
                        {volumeResult.current.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        <Text style={styles.summaryUnit}> {t.volumeUnit}</Text>
                      </Text>
                      <Text style={styles.summaryChange}>
                        {volumeResult.changePercent !== null
                          ? t.volumeVsPrevious(volumeResult.changePercent)
                          : t.volumeNoPrevious}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* ── Personal Records card ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t.personalRecords}</Text>

              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} width="80%" height={13} style={{ marginTop: spacing.sm }} />
                ))
              ) : prs.length === 0 ? (
                <Text style={styles.emptyCardText}>{t.noPersonalRecords}</Text>
              ) : (
                prs.map(pr => (
                  <View key={pr.exercise_id} style={styles.prRow}>
                    <Text style={styles.prName} numberOfLines={1}>{pr.exercise_name}</Text>
                    <View style={styles.prRight}>
                      <Text style={styles.prLoad}>
                        {pr.load_kg % 1 === 0 ? pr.load_kg.toFixed(0) : pr.load_kg.toFixed(1)}
                        {' '}{t.kgAbbrev}
                      </Text>
                      <View style={styles.prBadge}>
                        <Text style={styles.prBadgeText}>{t.prBadge}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* ── Exercise Progression card ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t.exerciseProgression}</Text>

              {/* Exercise selector */}
              {isLoading ? (
                <Skeleton width="70%" height={32} style={{ marginTop: spacing.sm, borderRadius: 8 }} />
              ) : trackedExercises.length === 0 ? (
                <Text style={styles.emptyCardText}>{t.noPersonalRecords}</Text>
              ) : (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.exerciseSelectorScroll}
                    contentContainerStyle={styles.exerciseSelectorContent}
                  >
                    {trackedExercises.map(ex => (
                      <Pressable
                        key={ex.exercise_id}
                        style={[
                          styles.exerciseChip,
                          selectedExerciseId === ex.exercise_id && styles.exerciseChipActive,
                        ]}
                        onPress={() => setSelectedExerciseId(ex.exercise_id)}
                      >
                        <Text
                          style={[
                            styles.exerciseChipLabel,
                            selectedExerciseId === ex.exercise_id && styles.exerciseChipLabelActive,
                          ]}
                          numberOfLines={1}
                        >
                          {ex.exercise_name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {progressionData.length === 0 ? (
                    <Text style={styles.emptyCardText}>{t.noProgressionData}</Text>
                  ) : (
                    <View style={styles.chartContainer}>
                      <LineChart
                        data={progressionData}
                        width={chartWidth}
                        height={180}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backLabel: {
    ...typography.caption,
    color: colors.olive,
  },
  title: {
    ...typography.h2,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  periodBtnActive: {
    backgroundColor: colors.olive,
    borderColor: colors.olive,
  },
  periodLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  periodLabelActive: {
    color: colors.textPrimaryDark,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  cardTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.olive,
    minWidth: 32,
    textAlign: 'center',
  },
  summaryDesc: {
    ...typography.body,
    color: colors.textPrimary,
  },
  summaryLabel: {
    ...typography.caption,
    marginBottom: 2,
  },
  summaryValueLarge: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  summaryChange: {
    ...typography.caption,
    marginTop: 2,
    color: colors.olive,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoftLight,
  },
  prName: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
    marginRight: spacing.sm,
  },
  prRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  prLoad: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  prBadge: {
    backgroundColor: colors.olive,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  prBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimaryDark,
  },
  exerciseSelectorScroll: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  exerciseSelectorContent: {
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  exerciseChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    maxWidth: 160,
  },
  exerciseChipActive: {
    backgroundColor: colors.olive,
    borderColor: colors.olive,
  },
  exerciseChipLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  exerciseChipLabelActive: {
    color: colors.textPrimaryDark,
  },
  chartContainer: {
    marginTop: spacing.xs,
    borderRadius: 8,
    overflow: 'hidden',
  },
  emptyContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  emptyCardText: {
    ...typography.caption,
    marginTop: spacing.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  retryBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.olive,
  },
  retryLabel: {
    color: colors.textPrimaryDark,
    fontWeight: '600',
    fontSize: 14,
  },
});
