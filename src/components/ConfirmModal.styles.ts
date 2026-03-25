import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  container: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 320,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  buttonCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surfaceMutedLight,
    alignItems: 'center',
  },
  buttonCancelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  buttonConfirm: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.olive,
    alignItems: 'center',
  },
  buttonConfirmDanger: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  buttonConfirmLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimaryDark,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
