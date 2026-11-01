import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backLabel: {
    ...typography.caption,
    color: colors.olive,
    minWidth: 48,
  },
  screenTitle: {
    ...typography.h2,
    marginTop: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    borderRadius: 16,
    padding: spacing.lg,
    backgroundColor: colors.surfaceLight,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  titleInput: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    // iOS Safari zooms the page when an auto-focused input is below 16px.
    fontSize: 16,
    color: colors.textPrimary,
  },
  spinner: {
    color: colors.olive,
  },
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceMutedLight,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  exerciseScheme: {
    ...typography.caption,
    marginTop: 2,
  },
  removeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeButtonPressed: {
    opacity: 0.7,
  },
  removeButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  addExerciseButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderSoftLight,
    alignItems: 'center',
    backgroundColor: colors.surfaceMutedLight,
  },
  addExerciseButtonPressed: {
    opacity: 0.7,
  },
  addExerciseButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.olive,
  },
  archiveButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surfaceLight,
  },
  archiveButtonPressed: {
    opacity: 0.7,
  },
  archiveButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.danger,
  },
  saveButton: {
    marginTop: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.olive,
  },
  saveButtonPressed: {
    opacity: 0.8,
  },
  saveButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surfaceLight,
  },
});
