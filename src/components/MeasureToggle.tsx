import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { useI18n } from '../i18n';
import type { Measure } from '../utils/measure';
import { SegmentedToggle } from './SegmentedToggle';

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
  return (
    <SegmentedToggle
      value={value}
      onChange={onChange}
      accessibilityPrefix={accessibilityPrefix}
      style={style}
      options={[
        { value: 'load', label: t.measureLoad },
        { value: 'time', label: t.measureTime },
      ]}
    />
  );
}
