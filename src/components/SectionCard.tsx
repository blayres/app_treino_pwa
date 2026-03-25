import React from 'react';
import { View, Text, ViewProps } from 'react-native';
import { styles } from './SectionCard.styles';
import { typography } from '../theme';

type SectionCardProps = ViewProps & {
  title: string;
  rightLabel?: string;
  children: React.ReactNode;
};

export function SectionCard({ title, rightLabel, children, style, ...rest }: SectionCardProps) {
  return (
    <View style={[styles.container, style]} {...rest}>
      <View style={styles.header}>
        <Text style={typography.h2}>{title}</Text>
        {rightLabel ? <Text style={styles.rightLabel}>{rightLabel}</Text> : null}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

