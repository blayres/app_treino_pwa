/**
 * LineChart.tsx
 *
 * Pure React + inline SVG chart — no external libraries required.
 * Works via react-native-web's <svg> passthrough on web.
 */

import React from 'react';
import { View } from 'react-native';
import { colors } from '../theme';

type DataPoint = {
  date: string;   // YYYY-MM-DD
  load_kg: number;
};

type Props = {
  data: DataPoint[];
  width: number;
  height?: number;
  lineColor?: string;
  dotColor?: string;
};

const PAD = { top: 16, right: 16, bottom: 36, left: 44 };

function shortDate(date: string): string {
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;
}

export function LineChart({
  data,
  width,
  height = 180,
  lineColor = colors.olive,
  dotColor = colors.accent,
}: Props) {
  if (!data || data.length === 0) return null;

  const cW = width - PAD.left - PAD.right;
  const cH = height - PAD.top - PAD.bottom;

  const loads = data.map(d => d.load_kg);
  const minLoad = Math.min(...loads);
  const maxLoad = Math.max(...loads);
  const range = maxLoad - minLoad || 1;

  const toX = (i: number) =>
    PAD.left + (data.length === 1 ? cW / 2 : (i / (data.length - 1)) * cW);

  const toY = (v: number) =>
    PAD.top + cH - ((v - minLoad) / range) * cH;

  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.load_kg).toFixed(1)}`)
    .join(' ');

  // Y grid lines + labels (min, mid, max)
  const yTicks =
    minLoad === maxLoad
      ? [{ v: minLoad, y: toY(minLoad) }]
      : [
          { v: minLoad, y: toY(minLoad) },
          { v: (minLoad + maxLoad) / 2, y: toY((minLoad + maxLoad) / 2) },
          { v: maxLoad, y: toY(maxLoad) },
        ];

  // X labels: up to 5 evenly spaced
  const labelCount = Math.min(data.length, 5);
  const xIndices =
    labelCount <= 1
      ? [0]
      : Array.from({ length: labelCount }, (_, i) =>
          Math.round((i / (labelCount - 1)) * (data.length - 1)),
        );

  // react-native-web renders unknown elements as-is, so plain JSX SVG works.
  // @ts-ignore — 'svg', 'path', etc. are valid in web context via RNW
  return (
    <View>
      {/* @ts-ignore */}
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          // @ts-ignore
          <line
            key={`g${i}`}
            x1={PAD.left}
            y1={t.y}
            x2={width - PAD.right}
            y2={t.y}
            stroke={colors.borderSoftLight}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ))}

        {/* Y labels */}
        {yTicks.map((t, i) => (
          // @ts-ignore
          <text
            key={`yl${i}`}
            x={PAD.left - 6}
            y={t.y + 4}
            fontSize={10}
            fill={colors.textSecondary}
            textAnchor="end"
          >
            {Number.isInteger(t.v) ? t.v : t.v.toFixed(1)}
          </text>
        ))}

        {/* Line */}
        {/* @ts-ignore */}
        <path
          d={pathD}
          stroke={lineColor}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {data.map((d, i) => (
          // @ts-ignore
          <circle
            key={`d${i}`}
            cx={toX(i)}
            cy={toY(d.load_kg)}
            r={4}
            fill={dotColor}
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}

        {/* X labels */}
        {xIndices.map(i => (
          // @ts-ignore
          <text
            key={`xl${i}`}
            x={toX(i)}
            y={height - 6}
            fontSize={10}
            fill={colors.textSecondary}
            textAnchor="middle"
          >
            {shortDate(data[i].date)}
          </text>
        ))}
      </svg>
    </View>
  );
}
