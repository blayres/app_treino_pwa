import React from 'react';

// Inline SVG pencil — single thin stroke, gently tilted (~22°).
// Works on web (Expo PWA) without any extra dependencies.
type Props = {
  size?: number;
  color?: string;
  opacity?: number;
};

export function PencilIcon({ size = 16, color = '#556B2F', opacity = 0.7 }: Props) {
  return (
    // @ts-ignore — SVG JSX is valid in react-native-web / DOM environments
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      style={{ display: 'block' }}
    >
      {/* Pencil body */}
      <path d="M16.5 3.5 a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
