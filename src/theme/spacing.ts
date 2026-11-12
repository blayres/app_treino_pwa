export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};


/**
 * Smallest tap target (CLAUDE.md: ≥ 40px). hitSlop does nothing on the web, so
 * small controls get an invisible area of this size around the visible shape,
 * with negative margins so the layout doesn't move.
 */
export const minTouchSize = 40;
