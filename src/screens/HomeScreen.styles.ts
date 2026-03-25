import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  greeting: {
    ...typography.h1,
    color: colors.oliveDark,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  logoutLabel: {
    ...typography.caption,
    color: colors.olive,
    textDecorationLine: 'underline',
  },
});

