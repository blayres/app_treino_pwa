import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  title: {
    ...typography.h1,
    color: colors.oliveDark,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.sm,
  },
  buttons: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  input: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceMutedLight,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  button: {
    paddingVertical: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.olive,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: colors.textPrimaryDark,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  linkWrap: {
    marginTop: spacing.lg,
    alignSelf: 'center',
  },
  linkLabel: {
    ...typography.caption,
    color: colors.olive,
    textDecorationLine: 'underline',
  },
  mt: {
    marginTop: spacing.md,
  },
});

