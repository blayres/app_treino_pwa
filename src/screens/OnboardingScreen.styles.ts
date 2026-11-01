import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundLight },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: 120,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  backLabel: { ...typography.caption, color: colors.olive, marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.oliveDark },
  subtitle: { ...typography.body, marginTop: spacing.xs, marginBottom: spacing.xl },

  // ── Choose step ──
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: spacing.md,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  optionHighlighted: { borderColor: colors.olive },
  optionHovered: { borderColor: colors.olive + '66' },
  optionPressed: { opacity: 0.85 },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.olive + '14',
  },
  optionIconHighlighted: { backgroundColor: colors.olive },
  optionBody: { flex: 1 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  optionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  optionDesc: { ...typography.body, marginTop: 2 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.oliveDark, letterSpacing: 0.3 },
  chevron: { fontSize: 22, color: colors.textSecondary },

  // ── Cards ──
  card: {
    borderRadius: 16,
    padding: spacing.lg,
    backgroundColor: colors.surfaceLight,
    marginBottom: spacing.md,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
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




  // ── Footer ──
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.backgroundLight + 'F2',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoftLight,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.olive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: { backgroundColor: colors.oliveDark },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonLabel: { fontSize: 16, fontWeight: '600', color: colors.textPrimaryDark },

});
