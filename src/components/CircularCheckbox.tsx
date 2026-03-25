import React from 'react';
import { Pressable, View } from 'react-native';
import { styles } from './CircularCheckbox.styles';

type CircularCheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export function CircularCheckbox({ checked, onToggle, disabled }: CircularCheckboxProps) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
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

