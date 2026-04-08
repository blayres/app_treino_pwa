import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    paddingHorizontal: spacing.xl,
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
  timerRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  exerciseRowActive: {
    backgroundColor: colors.olive + '18',
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  buttonPrimary: {
    flex: 1,
    backgroundColor: colors.olive,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonPrimaryPressed: {
    opacity: 0.9,
  },
  buttonPrimaryLabel: {
    color: colors.textPrimaryDark,
    fontWeight: '600',
  },
  buttonSecondary: {
    flex: 1,
    backgroundColor: colors.surfaceMutedLight,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  buttonSecondaryPressed: {
    opacity: 0.9,
  },
  buttonSecondaryLabel: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoftLight,
  },
  checkboxPlaceholder: {
    width: 22,
    height: 22,
  },
  exerciseInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  scheme: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  rest: {
    ...typography.caption,
    marginTop: 2,
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadColumn: {
    marginLeft: spacing.lg,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  loadLabel: {
    ...typography.caption,
  },
  loadLabelProgression: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  loadInput: {
    marginTop: spacing.xs,
    width: 64,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    textAlign: 'center',
    fontSize: 16,
  },
});

