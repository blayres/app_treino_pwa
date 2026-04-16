import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export const styles = StyleSheet.create({
  calendarContainer: {
    marginTop: spacing.md,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  dayHeaderLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  day: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceMutedLight,
  },
  dayActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentStrong,
  },
  dayLabel: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});

