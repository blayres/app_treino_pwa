import React from 'react';
import { StrokeIcon } from './StrokeIcon';

type Props = { size?: number; color?: string };

/** Stopwatch: timed exercises (plank…). */
export function StopwatchIcon({ size = 16, color }: Props) {
  return (
    <StrokeIcon size={size} color={color}>
      <path d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2.5M10 2h4M19 6l1.5-1.5" />
    </StrokeIcon>
  );
}
