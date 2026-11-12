import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useI18n } from '../i18n';
import { colors, shadows, spacing } from '../theme';
import type { Measure } from '../utils/measure';

type Props = {
  value: Measure;
  onChange: (measure: Measure) => void;
  /** Prefix for screen readers, e.g. the exercise name: "Prancha · Tempo". */
  accessibilityPrefix: string;
  style?: StyleProp<ViewStyle>;
};

/** "Carga | Tempo": whether an exercise is logged by load (kg) or done for time (plank…). */
export function MeasureToggle({ value, onChange, accessibilityPrefix, style }: Props) {
  const { t } = useI18n();
  const option = (measure: Measure, label: string) => {
    const selected = value === measure;
    return (
      <Pressable
        key={measure}
        onPress={() => !selected && onChange(measure)}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        aria-checked={selected}
        accessibilityLabel={`${accessibilityPrefix} · ${label}`}
        hitSlop={{ top: 8, bottom: 8 }}
        style={[styles.option, selected && styles.optionSelected]}
      >
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[styles.toggle, style]} accessibilityRole="radiogroup">
      {option('load', t.measureLoad)}
      {option('time', t.measureTime)}
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
  optionSelected: { backgroundColor: colors.surfaceLight, ...shadows.card },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  labelSelected: { color: colors.oliveDark },
});
