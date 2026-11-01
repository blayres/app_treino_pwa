import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { spacing } from './spacing';
import { shadows } from './surfaces';

/** White rounded card on the page background (spread into a style: `...cardSurface`). */
export const cardSurface = {
  borderRadius: 16,
  padding: spacing.lg,
  backgroundColor: colors.surfaceLight,
  ...shadows.card,
};

/** Page layout shared by every screen (mobile-first, centred on wide screens). */
export const layout = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundLight },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  /** Extra bottom room when a FooterButton floats over the content. */
  contentWithFooter: { paddingBottom: 120 },
  card: { ...cardSurface, marginBottom: spacing.md },
});
