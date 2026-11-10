import React from 'react';

type Props = {
  size?: number;
  color?: string;
  opacity?: number;
  strokeWidth?: number;
  children: React.ReactNode;
};

/**
 * Base of the app's inline line icons (24×24 viewBox, round thin stroke):
 * PencilIcon, StudentsIcon, DumbbellIcon. Works on web without icon libraries.
 */
export function StrokeIcon({ size = 16, color = '#556B2F', opacity = 1, strokeWidth = 1.8, children }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      style={{ display: 'block' }}
    >
      {children}
    </svg>
  );
}
