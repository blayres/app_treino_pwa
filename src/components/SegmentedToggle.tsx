import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, shadows, spacing } from '../theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  /** Prefix for screen readers, e.g. the exercise name: "Prancha · Tempo". */
  accessibilityPrefix?: string;
  /** 'md' for a screen-level choice (bigger labels and tap area). */
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/** Pill switch between a few options ("Carga | Tempo", "Dias fixos | Em sequência"). */
export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  accessibilityPrefix,
  size = 'sm',
  style,
}: Props<T>) {
  const md = size === 'md';
  return (
    <View style={[styles.toggle, style]} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => !selected && onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            aria-checked={selected}
            accessibilityLabel={accessibilityPrefix ? `${accessibilityPrefix} · ${option.label}` : option.label}
            hitSlop={{ top: 8, bottom: 8 }}
            style={[styles.option, md && styles.optionMd, selected && styles.optionSelected]}
          >
            <Text style={[styles.label, md && styles.labelMd, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    padding: 2,
    borderRadius: 999,
    backgroundColor: colors.surfaceMutedLight,
  },
  option: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  // 40px tall: hitSlop is ignored on the web.
  optionMd: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md },
  optionSelected: { backgroundColor: colors.surfaceLight, ...shadows.card },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  labelMd: { fontSize: 14 },
  labelSelected: { color: colors.oliveDark },
});
