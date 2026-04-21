import { StyleSheet } from 'react-native';import { colors, spacing, typography } from '../theme';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  container: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.oliveDark,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surfaceMutedLight,
    borderRadius: 14,
    padding: spacing.md,
  },
  cardTitle: {
    ...typography.h2,
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  input: {
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.backgroundLight,
  },
  button: {
    marginTop: spacing.sm,
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: colors.olive,
    paddingVertical: spacing.sm,
  },
  buttonLabel: {
    color: colors.textPrimaryDark,
    fontWeight: '600',
  },
  helper: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    backgroundColor: colors.backgroundLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipActive: {
    borderColor: colors.olive,
    backgroundColor: colors.olive + '20',
  },
  chipLabel: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  listItem: {
    ...typography.caption,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  spaced: {
    marginTop: spacing.sm,
  },
  // ── Student dashboard ──────────────────────────────────────────────────────
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.oliveDark,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checkinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 2,
  },
  loadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoftLight,
  },
  loadName: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  loadValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.oliveDark,
    marginLeft: spacing.sm,
  },
  loadProgression: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
