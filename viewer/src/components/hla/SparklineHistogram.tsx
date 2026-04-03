'use client';

import { COLOR } from '@/config/theme';
import type { MetricDistribution } from '@/lib/hla/types';

/**
 * SparklineHistogram — tiny inline SVG histogram with a marker for the current value.
 * Renders behind a table cell value to show distribution context at a glance.
 *
 * Width defaults to 60px, height 16px. The marker is a vertical line at the
 * position corresponding to `value` within the distribution range.
 */
export function SparklineHistogram({
  dist,
  value,
  width = 60,
  height = 16,
  color = COLOR.accent.teal,
}: {
  dist: MetricDistribution;
  value: number | null;
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!dist || dist.n === 0 || !dist.histogram || value == null) return null;

  const bins = dist.histogram;
  const maxCount = Math.max(...bins);
  if (maxCount === 0) return null;

  const nBins = bins.length;
  const barW = width / nBins;
  const range = dist.max - dist.min;

  // Marker position (clamp to [0, width])
  const markerX = range > 0
    ? Math.max(0, Math.min(width, ((value - dist.min) / range) * width))
    : width / 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Histogram bars */}
      {bins.map((count, i) => {
        const barH = (count / maxCount) * height;
        return (
          <rect
            key={i}
            x={i * barW}
            y={height - barH}
            width={Math.max(barW - 0.5, 0.5)}
            height={barH}
            fill={color}
            opacity={0.2}
          />
        );
      })}
      {/* Value marker line */}
      <line
        x1={markerX}
        y1={0}
        x2={markerX}
        y2={height}
        stroke={color}
        strokeWidth={1.5}
        opacity={0.9}
      />
    </svg>
  );
}

/**
 * Compute the approximate percentile rank of a value within a distribution.
 * Returns an integer 0–100.
 */
export function percentileRank(dist: MetricDistribution, value: number): number {
  if (!dist || dist.n === 0) return 50;
  const { min: mn, max: mx, p5, p10, p25, p50, p75, p90, p95 } = dist;

  // Interpolate between known percentile breakpoints
  const breakpoints = [
    { p: 0,   v: mn },
    { p: 5,   v: p5 },
    { p: 10,  v: p10 },
    { p: 25,  v: p25 },
    { p: 50,  v: p50 },
    { p: 75,  v: p75 },
    { p: 90,  v: p90 },
    { p: 95,  v: p95 },
    { p: 100, v: mx },
  ];

  if (value <= mn) return 0;
  if (value >= mx) return 100;

  for (let i = 1; i < breakpoints.length; i++) {
    if (value <= breakpoints[i].v) {
      const lo = breakpoints[i - 1];
      const hi = breakpoints[i];
      const range = hi.v - lo.v;
      if (range === 0) return lo.p;
      const frac = (value - lo.v) / range;
      return Math.round(lo.p + frac * (hi.p - lo.p));
    }
  }
  return 100;
}
