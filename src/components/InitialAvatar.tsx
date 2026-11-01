import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = { name: string; size?: number };

/** First letter of a name in a filled circle (profile button, students list). */
export function InitialAvatar({ name, size = 34 }: Props) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initial, { fontSize: Math.round(size * 0.44), lineHeight: Math.round(size * 0.53) }]}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '700', color: colors.textPrimaryDark },
});
