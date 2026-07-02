import React, { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

type Props = {
  width: DimensionValue;
  height: DimensionValue;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width, height, style }: Props) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: 8,
          backgroundColor: '#E1E1E1',
          opacity,
        },
        style,
      ]}
    />
  );
}
