import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useI18n } from '../i18n';
import { colors, spacing } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Extra style for the panel (height, margins…). */
  sheetStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const OPEN_MS = 320;
const CLOSE_MS = 240;

/**
 * Panel that slides up from the bottom, iOS-like: the backdrop fades in place
 * while only the panel moves, easing out as it arrives; closing plays it back.
 * CSS transitions (react-native-web) so the motion runs off the JS thread.
 */
export function BottomSheet({ visible, onClose, sheetStyle, children }: Props) {
  const { t } = useI18n();
  // Mount in the same render that opens it: an autoFocus input inside then
  // focuses within the user's tap, which iOS needs to show the keyboard.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (visible) {
      // Paint the hidden position first, then move: otherwise nothing animates.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setShown(false);
    // A little after the slide ends, so the last frames aren't cut.
    const timer = setTimeout(() => setMounted(false), CLOSE_MS + 40);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[styles.backdrop, shown ? styles.backdropShown : styles.backdropHidden]}
          onPress={onClose}
          accessibilityLabel={t.cancel}
        />
        <View style={[styles.sheet, sheetStyle, shown ? styles.sheetShown : styles.sheetHidden]}>{children}</View>
      </View>
    </Modal>
  );
}

// Web-only transition props are not in React Native's style types.
const transition = (property: string, ms: number, easing: string) =>
  ({ transitionProperty: property, transitionDuration: `${ms}ms`, transitionTimingFunction: easing }) as ViewStyle;

const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  backdropShown: { opacity: 1, ...transition('opacity', 220, 'ease') },
  backdropHidden: { opacity: 0, ...transition('opacity', CLOSE_MS, 'ease') },
  sheet: {
    backgroundColor: colors.surfaceLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
  },
  // margin-bottom/height: the add-exercise panel follows the iOS keyboard smoothly.
  sheetShown: { transform: [{ translateY: 0 }], ...transition('transform, margin-bottom, height', OPEN_MS, EASE_OUT) },
  sheetHidden: { transform: [{ translateY: '100%' }], ...transition('transform', CLOSE_MS, EASE_IN) },
});
