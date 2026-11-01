import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export const MENU_WIDTH = 168;

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
    gap: spacing.sm,
    minHeight: 36,
    paddingLeft: spacing.md,
    paddingRight: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.olive + '40',
    backgroundColor: colors.olive + '0F',
  },
  triggerOpen: {
    borderColor: colors.olive,
  },
  triggerPressed: {
    opacity: 0.75,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.olive,
  },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
    backgroundColor: colors.surfaceLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  optionHovered: {
    backgroundColor: colors.surfaceMutedLight,
  },
  optionActive: {
    backgroundColor: colors.olive + '14',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  optionLabelActive: {
    color: colors.olive,
    fontWeight: '600',
  },
});
