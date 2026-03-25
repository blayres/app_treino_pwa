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
  button: {
    paddingVertical: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.olive,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: colors.textPrimaryDark,
    fontSize: 16,
    fontWeight: '600',
  },
});

