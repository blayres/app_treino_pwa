import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, minTouchSize, spacing } from '../theme';

type IconProps = { size?: number; color?: string };

type Props = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Thin stroke icon before the label (e.g. PlayCircleIcon, SwapIcon). */
  icon?: React.ComponentType<IconProps>;
  /** Makes it a toggle: true = open (filled olive), the label stays the same. */
  active?: boolean;
};

/** Small secondary action under an exercise ("Como fazer", "Alternativas"). */
export function PillButton({ label, onPress, accessibilityLabel, icon: Icon, active }: Props) {
  const color = active ? colors.surfaceLight : colors.olive;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-expanded={active}
      style={styles.touchArea}
    >
      {({ pressed }) => (
        <View style={[styles.pill, active && styles.active, pressed && styles.pressed]}>
          {Icon ? <Icon size={15} color={color} /> : null}
          <Text style={[styles.label, { color }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const PILL_HEIGHT = 30;
const EXTRA = (minTouchSize - PILL_HEIGHT) / 2;

const styles = StyleSheet.create({
  // Invisible 40px-high tap area; negative margins keep the 30px pill's layout.
  touchArea: {
    alignSelf: 'flex-start',
    minHeight: minTouchSize,
    justifyContent: 'center',
    marginTop: spacing.xs - EXTRA,
    marginBottom: -EXTRA,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: PILL_HEIGHT,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  active: { backgroundColor: colors.olive, borderColor: colors.olive },
  pressed: { opacity: 0.7 },
  label: { fontSize: 12, fontWeight: '600' },
});
