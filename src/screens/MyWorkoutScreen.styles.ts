import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  // ── Header — mirrors WorkoutScreen header ─────────────────────────────────
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backLabel: {
    ...typography.caption,
    color: colors.olive,
  },
  screenTitle: {
    ...typography.h2,
    marginTop: spacing.sm,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // ── Card — mirrors SectionCard ────────────────────────────────────────────
  card: {
    borderRadius: 16,
    padding: spacing.lg,
    backgroundColor: colors.surfaceLight,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.h2,
    marginBottom: spacing.md,
  },
  cardContent: {
    marginTop: spacing.xs,
  },

  // ── Workout row — mirrors DayWorkouts item ────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceMutedLight,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  rowPressed: {
    opacity: 0.8,
  },
  rowInfo: {
    flex: 1,
  },
  dayLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  exerciseCount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  chevron: {
    fontSize: 22,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    lineHeight: 26,
  },

  // ── Skeleton rows ─────────────────────────────────────────────────────────
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceMutedLight,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  skeletonInfo: {
    flex: 1,
  },

  // ── Add day button ────────────────────────────────────────────────────────
  addDayButton: {
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
  },
  addDayButtonPressed: {
    opacity: 0.7,
  },
  addDayButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.olive,
  },
});
