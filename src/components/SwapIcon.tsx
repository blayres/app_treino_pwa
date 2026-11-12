import React from 'react';
import { StrokeIcon } from './StrokeIcon';

type Props = { size?: number; color?: string };

/** Two opposite arrows: alternatives to an exercise. */
export function SwapIcon({ size = 16, color }: Props) {
  return (
    <StrokeIcon size={size} color={color}>
      <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
    </StrokeIcon>
  );
}
