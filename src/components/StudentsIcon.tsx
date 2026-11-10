import React from 'react';
import { StrokeIcon } from './StrokeIcon';

type Props = { size?: number; color?: string };

/** Two people: the trainer's students. */
export function StudentsIcon({ size = 16, color }: Props) {
  return (
    <StrokeIcon size={size} color={color}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.3c2.1.6 3.5 2.5 3.5 5.2" />
    </StrokeIcon>
  );
}
