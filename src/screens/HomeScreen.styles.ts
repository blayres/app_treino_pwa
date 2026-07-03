import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  logoBar: {
    width: '100%',
    backgroundColor: colors.oliveLogo,
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  logo: {
    width: '75%',
    maxWidth: 280,
    height: 52,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
    overflow: 'visible',
  },
  greeting: {
    ...typography.h1,
    color: colors.oliveDark,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'visible',
  },
  logoutButton: {
    paddingVertical: 2,
  },
  logoutLabel: {
    ...typography.caption,
    color: colors.olive,
    textDecorationLine: 'underline',
  },
  toolsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  toolButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    backgroundColor: colors.surfaceMutedLight,
  },
  toolButtonLabel: {
    ...typography.caption,
    color: colors.textPrimary,
  },
});

