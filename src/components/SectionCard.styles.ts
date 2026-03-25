import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: spacing.lg,
    backgroundColor: colors.surfaceLight,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: spacing.lg,
  },
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

