import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

export const styles = StyleSheet.create({
  tips: { ...typography.caption, marginTop: -spacing.md, marginBottom: spacing.md },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceLight,
  },
  count: { fontSize: 13, fontWeight: '600', color: colors.oliveDark, marginTop: spacing.md, marginBottom: spacing.sm },
  skeletons: { gap: spacing.sm },
  row: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { ...typography.caption },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.xs, maxWidth: '60%' },
});
