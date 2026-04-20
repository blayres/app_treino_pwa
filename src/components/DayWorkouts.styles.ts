import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export const styles = StyleSheet.create({
  item: {
    paddingVertical: spacing.md,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceMutedLight,
    marginBottom: spacing.sm,
  },
  itemPressed: {
    opacity: 0.8,
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

