import React from 'react';
import { StrokeIcon } from './StrokeIcon';

type Props = { size?: number; color?: string };

/** Play inside a circle: how to perform an exercise (animation or coach video). */
export function PlayCircleIcon({ size = 16, color }: Props) {
  return (
    <StrokeIcon size={size} color={color}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5v7l5.5-3.5z" />
    </StrokeIcon>
  );
}
