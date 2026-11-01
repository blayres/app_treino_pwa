/**
 * Load-progression charts (inline SVG, no chart library).
 *
 * ProgressChart — one exercise over time: 2px line + 10% area wash, solid
 * hairline grid, round y ticks, the current value labelled at the line end,
 * the all-time best ringed, and a crosshair + tooltip that snaps to the
 * nearest training day on hover/touch. Sparkline — the same series in a row.
 * Colours come from the theme (chartLine validated for contrast/chroma).
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { colors } from '../theme';
import type { Locale } from '../i18n/translations';
import { formatKg, localeTag } from '../utils/decimal';
import { niceTicks, type ProgressDataPoint } from '../services/progressUtils';

const PAD = { top: 28, right: 20, bottom: 28, left: 40 };
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function formatShortDate(date: string, locale: Locale): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(localeTag(locale), { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace('.', '');
}

type ChartProps = {
  points: ProgressDataPoint[];
  width: number;
  height?: number;
  locale: Locale;
  bestDate?: string;
  accessibilityLabel: string;
};

export function ProgressChart({ points, width, height = 210, locale, bestDate, accessibilityLabel }: ChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0 || width <= 0) return null;

  const loads = points.map((p) => p.load_kg);
  const ticks = niceTicks(Math.min(...loads), Math.max(...loads), 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  // Time-proportional x so gaps between sessions are visible.
  const times = points.map((p) => Date.parse(`${p.date}T00:00:00Z`));
  const t0 = times[0];
  const span = times[times.length - 1] - t0;
  const x = (i: number) => PAD.left + (span === 0 ? plotW / 2 : ((times[i] - t0) / span) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.load_kg).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${PAD.top + plotH} L${x(0).toFixed(1)},${PAD.top + plotH} Z`;
  const last = points.length - 1;
  const bestIndex = bestDate ? points.findIndex((p) => p.date === bestDate) : -1;
  const showAllDots = points.length <= 16;

  const nearest = (clientX: number, rectLeft: number) => {
    const px = clientX - rectLeft;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    return best;
  };
  const onPointer = (e: any) => {
    const touch = e.touches?.[0] ?? e.nativeEvent?.touches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const rect = (e.currentTarget as any).ownerSVGElement?.getBoundingClientRect?.() ??
      (e.currentTarget as any).getBoundingClientRect();
    setHover(nearest(clientX, rect.left));
  };

  const xLabels = points.length === 1 ? [0] : [0, last];
  const endLabel = formatKg(points[last].load_kg, locale);
  const endLabelX = Math.min(x(last), width - 4);

  // Tooltip geometry (kept inside the chart).
  const tip = hover !== null ? { i: hover, w: 112, h: 40 } : null;
  const tipX = tip ? Math.max(2, Math.min(x(tip.i) - tip.w / 2, width - tip.w - 2)) : 0;

  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      {/* @ts-ignore — SVG JSX is valid in react-native-web / DOM environments */}
      <svg width={width} height={height} style={{ display: 'block', touchAction: 'pan-y', fontFamily: FONT }}>
        {/* grid + y ticks */}
        {ticks.map((v) => (
          // @ts-ignore
          <g key={`t${v}`}>
            {/* @ts-ignore */}
            <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={colors.chartGrid} strokeWidth={1} />
            {/* @ts-ignore */}
            <text x={PAD.left - 8} y={y(v) + 4} fontSize={11} fill={colors.textSecondary} textAnchor="end"
              style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatKg(v, locale).replace(' kg', '')}
            </text>
          </g>
        ))}

        {/* area + line */}
        {/* @ts-ignore */}
        <path d={area} fill={colors.chartLineWash} />
        {/* @ts-ignore */}
        <path d={line} fill="none" stroke={colors.chartLine} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* markers: every session when sparse; always the best and the last */}
        {points.map((p, i) => {
          if (!showAllDots && i !== last && i !== bestIndex) return null;
          const isBest = i === bestIndex;
          return (
            // @ts-ignore
            <circle key={`d${i}`} cx={x(i)} cy={y(p.load_kg)} r={isBest ? 5.5 : 4}
              fill={isBest ? colors.surfaceLight : colors.chartLine}
              stroke={isBest ? colors.chartLine : colors.surfaceLight} strokeWidth={2} />
          );
        })}

        {/* current value at the line end */}
        {/* @ts-ignore */}
        <text x={endLabelX} y={y(points[last].load_kg) - 12} fontSize={12} fontWeight={600}
          fill={colors.textPrimary} textAnchor={points.length === 1 ? 'middle' : 'end'}>
          {endLabel}
        </text>

        {/* x labels: first and last training day */}
        {xLabels.map((i) => (
          // @ts-ignore
          <text key={`x${i}`} x={x(i)} y={height - 8} fontSize={11} fill={colors.textSecondary}
            textAnchor={points.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'}>
            {formatShortDate(points[i].date, locale)}
          </text>
        ))}

        {/* crosshair + tooltip */}
        {tip && (
          // @ts-ignore
          <g pointerEvents="none">
            {/* @ts-ignore */}
            <line x1={x(tip.i)} x2={x(tip.i)} y1={PAD.top - 6} y2={PAD.top + plotH} stroke={colors.textSecondary} strokeWidth={1} />
            {/* @ts-ignore */}
            <circle cx={x(tip.i)} cy={y(points[tip.i].load_kg)} r={5} fill={colors.chartLine} stroke={colors.surfaceLight} strokeWidth={2} />
            {/* @ts-ignore */}
            <rect x={tipX} y={2} width={tip.w} height={tip.h} rx={8} fill={colors.surfaceLight} stroke={colors.borderSoftLight} />
            {/* @ts-ignore */}
            <text x={tipX + 10} y={19} fontSize={13} fontWeight={700} fill={colors.textPrimary}>
              {formatKg(points[tip.i].load_kg, locale)}
            </text>
            {/* @ts-ignore */}
            <text x={tipX + 10} y={34} fontSize={11} fill={colors.textSecondary}>
              {formatShortDate(points[tip.i].date, locale)}
            </text>
          </g>
        )}

        {/* hit area larger than the marks */}
        {/* @ts-ignore */}
        <rect x={0} y={0} width={width} height={height} fill="transparent"
          onMouseMove={onPointer} onMouseLeave={() => setHover(null)}
          onTouchStart={onPointer} onTouchMove={onPointer} onTouchEnd={() => setHover(null)} />
      </svg>
    </View>
  );
}

export function Sparkline({ points, width = 72, height = 28 }: { points: ProgressDataPoint[]; width?: number; height?: number }) {
  if (points.length === 0) return <View style={{ width, height }} />;
  const loads = points.map((p) => p.load_kg);
  const min = Math.min(...loads);
  const max = Math.max(...loads);
  const pad = 5;
  const x = (i: number) => (points.length === 1 ? width / 2 : pad + (i / (points.length - 1)) * (width - pad * 2));
  const y = (v: number) => (max === min ? height / 2 : pad + (1 - (v - min) / (max - min)) * (height - pad * 2));
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.load_kg).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  return (
    // @ts-ignore — SVG JSX is valid in react-native-web / DOM environments
    <svg width={width} height={height} style={{ display: 'block' }} aria-hidden="true">
      {/* @ts-ignore */}
      <path d={d} fill="none" stroke={colors.chartLine} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* @ts-ignore */}
      <circle cx={x(last)} cy={y(points[last].load_kg)} r={3.5} fill={colors.chartLine} stroke={colors.surfaceLight} strokeWidth={1.5} />
    </svg>
  );
}
