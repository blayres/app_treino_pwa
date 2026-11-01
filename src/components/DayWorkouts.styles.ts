import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export const styles = StyleSheet.create({
  item: {
    paddingVertical: spacing.md,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceMutedLight,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  itemPressed: {
    opacity: 0.8,
  },
  itemInProgress: {
    borderColor: colors.success,
  },
  dayLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inProgressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  inProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.olive,
  },
  dayLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  title: {
    marginTop: spacing.xs,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lastDone: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 5,
  },
  itemRest: {
    paddingVertical: spacing.md,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceMutedLight,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    opacity: 0.45,
  },
  titleRest: {
    color: colors.textSecondary,
    fontWeight: '400',
  },
  loadingWrap: {
    paddingVertical: spacing.md,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});

