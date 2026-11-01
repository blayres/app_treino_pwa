import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

/** Shared by CoachScreen and CoachStudentScreen. */
export const styles = StyleSheet.create({
  skeletons: { gap: spacing.md },
  helper: { ...typography.body, marginBottom: spacing.md },
  empty: { ...typography.body, paddingVertical: spacing.md },
  attention: { fontSize: 13, fontWeight: '600', color: colors.oliveDark, marginBottom: spacing.sm },

  // Intro (not a coach yet)
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberLabel: { fontSize: 14, fontWeight: '700', color: colors.oliveDark },
  stepText: { ...typography.body, flex: 1, color: colors.textPrimary, paddingTop: 4 },

  // Invite
  codeBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceMutedLight,
    marginBottom: spacing.md,
  },
  codeLabel: { ...typography.caption, textTransform: 'uppercase', letterSpacing: 1 },
  code: { fontSize: 32, fontWeight: '700', letterSpacing: 6, color: colors.oliveDark, marginVertical: spacing.xs },
  link: { ...typography.caption, maxWidth: '100%' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  textLink: { alignSelf: 'center', marginTop: spacing.md, paddingVertical: spacing.xs },
  textLinkLabel: { fontSize: 13, color: colors.textSecondary, textDecorationLine: 'underline' },

  search: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceLight,
  },

  // Student page
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { ...typography.h2 },
  profileSince: { ...typography.caption, marginTop: 2 },
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  statLabel: { ...typography.caption },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoftLight,
  },
  dayName: { width: 74, fontSize: 13, fontWeight: '600', color: colors.olive },
  dayBody: { flex: 1, minWidth: 0 },
  dayTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  dayMeta: { ...typography.caption, marginTop: 1 },
  cardAction: { flexDirection: 'row', marginTop: spacing.md },
  dangerRow: { alignSelf: 'center', marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  dangerLabel: { fontSize: 14, fontWeight: '600', color: colors.danger },
});
