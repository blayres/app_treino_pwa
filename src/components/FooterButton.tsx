import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows a spinner instead of the label (the label itself never changes). */
  loading?: boolean;
};

/** Primary action pinned to the bottom of the screen (use layout.contentWithFooter). */
export function FooterButton({ label, onPress, disabled = false, loading = false }: Props) {
  const insets = useSafeAreaInsets();
  const inactive = disabled || loading;
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <Pressable
        onPress={onPress}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: inactive, busy: loading }}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, inactive && styles.inactive]}
      >
        {loading ? <ActivityIndicator color={colors.textPrimaryDark} /> : <Text style={styles.label}>{label}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.backgroundLight + 'F2',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoftLight,
  },
  button: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.olive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.oliveDark },
  inactive: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: '600', color: colors.textPrimaryDark, textAlign: 'center' },
});
