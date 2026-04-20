import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export const feedbackStyles = StyleSheet.create({
  successBox: {
    marginTop: spacing.md,
    backgroundColor: '#EAF7EE',
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    borderRadius: 8,
    padding: spacing.md,
  },
  successText: {
    color: '#2D6A4F',
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    marginTop: spacing.md,
    backgroundColor: '#FDF0ED',
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: 8,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'monospace',
  },
});
