import React from 'react';
import { StrokeIcon } from './StrokeIcon';

type Props = { size?: number; color?: string };

/** Dumbbell: the user's own training. */
export function DumbbellIcon({ size = 16, color }: Props) {
  return (
    <StrokeIcon size={size} color={color}>
      <path d="M8 12h8" />
      <rect x="4.5" y="7" width="3.5" height="10" rx="1" />
      <rect x="16" y="7" width="3.5" height="10" rx="1" />
      <path d="M2.5 10v4M21.5 10v4" />
    </StrokeIcon>
  );
}
