import { StyleSheet } from 'react-native';
import { colors, spacing, typography, shadows } from '../theme';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
    overflow: 'visible',
  },
  successToast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.olive,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    ...shadows.toast,
  },

  successToastText: {
    ...typography.body,
    color: '#FFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  greetingWrapper: {
    flex: 1,
    minWidth: 0,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: {
    ...typography.h1,
    color: colors.oliveDark,
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
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
  // Profile-avatar pattern (Gmail/Notion/Slack): initial in a filled circle
  // opens Settings. 40px touch target, soft halo on hover/press.
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonHovered: {
    backgroundColor: colors.olive + '14',
  },
  settingsButtonPressed: {
    backgroundColor: colors.olive + '24',
  },
  sectionDescription: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  cardAction: { flexDirection: 'row' },
});
