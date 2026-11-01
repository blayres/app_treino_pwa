import { StyleSheet } from 'react-native';
import { colors, spacing, cardSurface } from '../theme';

export const styles = StyleSheet.create({
  container: { ...cardSurface, marginBottom: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rightLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  content: {
    marginTop: spacing.xs,
  },
});

