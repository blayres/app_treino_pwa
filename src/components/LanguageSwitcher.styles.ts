import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    backgroundColor: colors.surfaceMutedLight,
    minWidth: 44,
    justifyContent: 'center',
  },
  triggerPressed: {
    opacity: 0.8,
  },
  triggerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  chevron: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  menu: {
    position: 'absolute',
    width: 80,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    backgroundColor: colors.surfaceLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  option: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  optionActive: {
    backgroundColor: colors.olive + '18',
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  optionLabelActive: {
    color: colors.olive,
  },
});
