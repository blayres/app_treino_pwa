import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { showAlert } from '../store/useDialogStore';
import { useI18n } from '../i18n';
import { colors, layout, spacing, typography } from '../theme';
import { LogoBar } from '../components/LogoBar';
import { ScreenHeader } from '../components/ScreenHeader';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatShortDate, ProgressChart, Sparkline } from '../components/ProgressChart';
import {
  deleteLoadHistoryEntries,
  getCompletedSessionDates,
  getLoadHistoryByUser,
} from '../services/progressService';
import {
  buildExerciseProgress,
  summarizeProgress,
  type ExerciseProgress,
  type LoadHistoryRow,
  type PeriodKey,
} from '../services/progressUtils';
import { formatDecimal, formatKg, formatKgDelta } from '../utils/decimal';

const PERIODS: PeriodKey[] = ['1m', '3m', '6m', 'all'];
type LoadState = 'pending' | 'ready' | 'error';
type Entry = ExerciseProgress['entries'][number];

/**
 * Progress: how each exercise's load evolves.
 * 1. Period filter (scopes everything below).
 * 2. Three stat tiles: workouts (vs previous period), exercises improving, records.
 * 3. One row per exercise (current load, change, sparkline), biggest gain first;
 *    tapping expands its chart, start/current/best/change and the entries
 *    (table view, where a wrongly typed entry can be deleted).
 */
export default function ProgressScreen() {
  const navigation = useNavigation();
  const currentUser = useAppStore((state) => state.currentUser);
  const { t, locale } = useI18n();

  const [loadState, setLoadState] = useState<LoadState>('pending');
  const [history, setHistory] = useState<LoadHistoryRow[]>([]);
  const [sessionDates, setSessionDates] = useState<string[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('3m');
  const [openId, setOpenId] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [toDelete, setToDelete] = useState<Entry | null>(null);

  const load = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [rows, sessions] = await Promise.all([
        getLoadHistoryByUser(currentUser.id),
        getCompletedSessionDates(currentUser.id).catch(() => [] as string[]),
      ]);
      setHistory(rows);
      setSessionDates(sessions);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [currentUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const now = useMemo(() => new Date(), [history]);
  const progress = useMemo(() => buildExerciseProgress(history, now, period), [history, now, period]);
  const summary = useMemo(() => summarizeProgress(progress, sessionDates, now, period), [progress, sessionDates, now, period]);

  // Keep the first exercise open by default so the page always shows a chart.
  const openExercise = progress.find((p) => p.exercise_id === openId) ?? progress[0] ?? null;

  const periodLabel = (p: PeriodKey) =>
    p === '1m' ? t.period1m : p === '3m' ? t.period3m : p === '6m' ? t.period6m : t.periodAll;
  const shortDate = (iso: string) => formatShortDate(iso.slice(0, 10), locale);
  const pct = (value: number | null) => (value === null ? '' : ` · ${value > 0 ? '+' : ''}${value}%`);

  const handleDelete = async () => {
    const entry = toDelete;
    setToDelete(null);
    if (!entry || entry.ids.length === 0) return;
    try {
      await deleteLoadHistoryEntries(entry.ids);
      setHistory((rows) => rows.filter((r) => r.id == null || !entry.ids.includes(r.id)));
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.genericError);
    }
  };

  const renderStat = (label: string, value: string, caption: string) => (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value} ${caption}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statCaption} numberOfLines={2}>{caption}</Text>
    </View>
  );

  const renderDetail = (item: ExerciseProgress) => (
    <View style={styles.detail} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
      {chartWidth > 0 && (
        <ProgressChart
          points={item.points}
          width={chartWidth}
          locale={locale}
          bestDate={item.bestDate}
          accessibilityLabel={t.chartLabel(item.exercise_name)}
        />
      )}

      <View style={styles.figures}>
        {[
          [t.startLabel, formatKg(item.start, locale)],
          [t.currentLabel, formatKg(item.current, locale)],
          [t.bestLabel, formatKg(item.best, locale)],
          [t.changeLabel, formatKgDelta(item.change, locale)],
        ].map(([label, value], index) => (
          <View key={label} style={styles.figure}>
            <Text style={styles.figureLabel}>{label}</Text>
            <Text style={[styles.figureValue, index === 3 && item.change > 0 && styles.deltaUp]}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.entriesTitle}>{t.entriesTitle}</Text>
      {item.entries.map((entry) => (
        <View key={entry.date} style={styles.entryRow}>
          <Text style={styles.entryDate}>{shortDate(entry.date)}</Text>
          <Text style={styles.entryLoad}>{formatKg(entry.load_kg, locale)}</Text>
          {entry.ids.length > 0 && (
            <Pressable
              onPress={() => setToDelete(entry)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.deleteEntry(formatKg(entry.load_kg, locale), shortDate(entry.date))}
              style={({ pressed }) => [styles.entryDelete, pressed && styles.entryDeletePressed]}
            >
              <Text style={styles.entryDeleteLabel}>✕</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={layout.screen} edges={['left', 'right', 'bottom']}>
      <LogoBar />
      <ScrollView contentContainerStyle={[layout.content, styles.wide]} showsVerticalScrollIndicator={false}>
        <ScreenHeader onBack={() => navigation.goBack()} title={t.progress} subtitle={t.progressHeaderSubtitle} />

        <View style={styles.periodRow} accessibilityRole="tablist">
          {PERIODS.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              accessibilityRole="tab"
              accessibilityState={{ selected: period === p }}
              style={[styles.periodChip, period === p && styles.periodChipActive]}
            >
              <Text style={[styles.periodLabel, period === p && styles.periodLabelActive]}>{periodLabel(p)}</Text>
            </Pressable>
          ))}
        </View>

        {loadState === 'pending' ? null : loadState === 'error' ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t.progressError}</Text>
            <Pressable style={styles.retry} onPress={load}>
              <Text style={styles.retryLabel}>{t.tryAgain}</Text>
            </Pressable>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t.loadHistoryEmpty}</Text>
          </View>
        ) : (
          <>
            <View style={styles.stats}>
              {renderStat(
                t.statWorkouts,
                String(summary.sessions),
                summary.previousSessions === null
                  ? t.statInPeriod
                  : t.statVsPrevious(summary.sessions - summary.previousSessions),
              )}
              {renderStat(t.statImproving, String(summary.improved), t.statImprovingOf(summary.trained))}
              {/* "Records in the period" needs an earlier period to beat; not shown for "Tudo". */}
              {period !== 'all' && renderStat(t.statRecords, String(summary.records), t.statRecordsSub)}
            </View>

            <Text style={styles.sectionTitle}>{t.evolutionTitle}</Text>
            {progress.length === 0 ? (
              <Text style={styles.emptyText}>{t.noDataInPeriod}</Text>
            ) : (
              <>
                <Text style={styles.sectionHint}>{t.evolutionHint}</Text>
                <View style={styles.list}>
                  {progress.map((item, index) => {
                    const isOpen = openExercise?.exercise_id === item.exercise_id;
                    return (
                      <View
                        key={item.exercise_id}
                        style={[styles.item, index === progress.length - 1 && styles.itemLast]}
                      >
                        <Pressable
                          onPress={() => setOpenId(isOpen ? -1 : item.exercise_id)}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: isOpen }}
                          style={({ pressed }) => [styles.itemHeader, pressed && styles.itemHeaderPressed]}
                        >
                          <View style={styles.itemInfo}>
                            <View style={styles.itemNameRow}>
                              <Text style={styles.itemName} numberOfLines={2}>{item.exercise_name}</Text>
                              {item.isNewRecord && (
                                <View style={styles.recordBadge}>
                                  <Text style={styles.recordBadgeText}>{t.newRecordBadge}</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.itemMeta}>{t.lastTrained(formatShortDate(item.lastDate, locale))}</Text>
                          </View>
                          <Sparkline points={item.points} />
                          <View style={styles.itemValues}>
                            <Text style={styles.itemCurrent}>
                              {formatDecimal(item.current, locale, 1)}
                              <Text style={styles.itemUnit}> kg</Text>
                            </Text>
                            <Text style={[styles.itemDelta, item.change > 0 && styles.deltaUp]}>
                              {formatKgDelta(item.change, locale)}
                              {pct(item.changePercent)}
                            </Text>
                          </View>
                        </Pressable>
                        {isOpen && renderDetail(item)}
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={toDelete !== null}
        title={t.deleteEntryTitle}
        message={
          toDelete ? t.deleteEntryMsg(formatKg(toDelete.load_kg, locale), shortDate(toDelete.date)) : ''
        }
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        confirmDanger
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wide: { maxWidth: 720 },
  periodRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  periodChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    backgroundColor: colors.surfaceLight,
  },
  periodChipActive: { backgroundColor: colors.olive, borderColor: colors.olive },
  periodLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  periodLabelActive: { color: colors.textPrimaryDark },

  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  statLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  statValue: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  statCaption: { ...typography.caption, fontSize: 11, lineHeight: 14, marginTop: 2 },

  sectionTitle: { ...typography.h3, marginBottom: spacing.xs },
  sectionHint: { ...typography.caption, marginBottom: spacing.md },
  list: {
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    overflow: 'hidden',
  },
  item: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoftLight },
  itemLast: { borderBottomWidth: 0 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  itemHeaderPressed: { backgroundColor: colors.surfaceMutedLight },
  itemInfo: { flex: 1, minWidth: 0 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  itemMeta: { ...typography.caption, marginTop: 2 },
  itemValues: { alignItems: 'flex-end', minWidth: 84 },
  itemCurrent: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  itemUnit: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  itemDelta: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
  deltaUp: { color: colors.deltaUpText },
  recordBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.accentSoft },
  recordBadgeText: { fontSize: 10, fontWeight: '700', color: colors.oliveDark },

  detail: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  figures: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoftLight,
  },
  figure: { flex: 1 },
  figureLabel: { ...typography.caption, fontSize: 11 },
  figureValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  entriesTitle: { ...typography.caption, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoftLight,
  },
  entryDate: { flex: 1, ...typography.body, color: colors.textSecondary },
  entryLoad: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  entryDelete: { width: 32, height: 32, marginLeft: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  entryDeletePressed: { backgroundColor: colors.danger + '1A' },
  entryDeleteLabel: { fontSize: 14, color: colors.textSecondary },

  empty: { marginTop: spacing.xl, alignItems: 'center', gap: spacing.md },
  emptyText: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  retry: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 999, backgroundColor: colors.olive },
  retryLabel: { color: colors.textPrimaryDark, fontWeight: '600', fontSize: 14 },
});
