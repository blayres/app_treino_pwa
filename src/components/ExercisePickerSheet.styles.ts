import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    backgroundColor: colors.surfaceLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h3,
  },
  close: {
    fontSize: 18,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  searchInput: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    fontSize: 16,
    color: colors.textPrimary,
  },
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  exerciseList: {
    flex: 1,
  },
  emptyText: {
    ...typography.body,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoftLight,
  },
  exerciseItemDisabled: {
    opacity: 0.45,
  },
  exerciseItemPressed: {
    backgroundColor: colors.surfaceMutedLight,
  },
  exerciseItemInfo: {
    flex: 1,
  },
  exerciseItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  exerciseItemNameDisabled: {
    color: colors.textSecondary,
  },
  exerciseItemMuscle: {
    ...typography.caption,
    marginTop: 2,
  },
  addedTag: {
    fontSize: 16,
    color: colors.olive,
    marginLeft: spacing.sm,
  },
  createItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoftLight,
    backgroundColor: colors.olive + '0D',
  },
  createPlus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.olive,
    color: colors.textPrimaryDark,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 18,
    fontWeight: '600',
    overflow: 'hidden',
  },
  createLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.olive,
  },
  createHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  customTag: {
    ...typography.caption,
    color: colors.olive,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
});
