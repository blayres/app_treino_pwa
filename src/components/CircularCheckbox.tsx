import React from 'react';
import { Pressable, View } from 'react-native';
import { styles } from './CircularCheckbox.styles';

type CircularCheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** What is checked, for screen readers (e.g. the exercise name). */
  accessibilityLabel?: string;
};

export function CircularCheckbox({ checked, onToggle, disabled, accessibilityLabel }: CircularCheckboxProps) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.outer,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {checked && <View style={styles.inner} />}
    </Pressable>
  );
}

