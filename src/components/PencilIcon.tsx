import React from 'react';
import { StrokeIcon } from './StrokeIcon';

type Props = { size?: number; color?: string; opacity?: number };

/** Thin pencil, gently tilted (~22°): "edit". */
export function PencilIcon({ size = 16, color = '#556B2F', opacity = 0.7 }: Props) {
  return (
    <StrokeIcon size={size} color={color} opacity={opacity} strokeWidth={1.6}>
      <path d="M16.5 3.5 a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </StrokeIcon>
  );
}
