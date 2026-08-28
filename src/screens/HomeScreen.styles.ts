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
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
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
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    backgroundColor: colors.surfaceMutedLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonPressed: {
    opacity: 0.7,
  },
  settingsIcon: {
    fontSize: 25,
    color: colors.olive,
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
  sectionDescription: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  customizeButton: {
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.olive,
    alignItems: 'center',
  },
  customizeButtonPressed: {
    opacity: 0.85,
  },
  customizeButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimaryDark,
  },
});
