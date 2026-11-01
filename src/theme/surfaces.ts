import type { ViewStyle } from 'react-native';

/**
 * Elevation tokens. `boxShadow` replaces the deprecated shadow* props
 * (react-native-web warns on them; RN 0.76+ supports boxShadow natively).
 */
export const shadows = {
  /** Cards on the page background. */
  card: { boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.08)' } as ViewStyle,
  /** Menus/popovers floating over content. */
  popover: { boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.12)' } as ViewStyle,
  /** Toasts above everything. */
  toast: { boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.25)' } as ViewStyle,
};
