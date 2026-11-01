import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { typography } from '../theme/typography';

export const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  time: {
    marginTop: spacing.xs,
    fontSize: 24,
    fontWeight: '700',
    color: colors.olive,
  },
});

