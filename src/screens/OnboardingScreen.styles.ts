import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

/** Ready-made program preview (onboarding "Usar treino pronto"). */
export const styles = StyleSheet.create({
  previewDay: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoftLight,
  },
  previewDayLast: { borderBottomWidth: 0 },
  dayLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  previewTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  previewExercises: { ...typography.caption, marginTop: 2, lineHeight: 17 },
});
