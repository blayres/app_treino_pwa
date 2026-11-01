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
  },
  screenTitle: {
    ...typography.h2,
    marginTop: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  dayChipSelected: {
    backgroundColor: colors.olive,
    borderColor: colors.olive,
  },
  dayChipDisabled: {
    opacity: 0.35,
  },
  dayChipLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  dayChipLabelSelected: {
    color: colors.textPrimaryDark,
  },
  dayChipLabelDisabled: {
    color: colors.textSecondary,
  },
  titleInput: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    // iOS Safari zooms when focusing inputs smaller than 16px.
    fontSize: 16,
    color: colors.textPrimary,
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
  saveButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.olive,
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimaryDark,
  },
  spinner: {
    color: colors.olive,
  },
});
