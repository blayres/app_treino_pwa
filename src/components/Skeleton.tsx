import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export function Skeleton({ width, height, style }: any) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
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

