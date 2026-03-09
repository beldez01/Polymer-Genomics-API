'use client';

import { useMemo } from 'react';
import { CytoBand, GIEMSA_COLORS } from '@/config/cytobands';
import { COLOR } from '@/config/theme';

export type DetailLevel = 'low' | 'minimal' | 'high';

interface ChromosomeSVGProps {
  chrName: string;
  bands: CytoBand[];
  chrLength: number;
  centromereStart: number;
  centromereEnd: number;
  width: number;
  height: number;
  detail: DetailLevel;
  onClick?: () => void;
  hovered?: boolean;
}

// Centromere pinch ratio — how narrow the constriction gets
const PINCH_RATIO = 0.4;
// Radius for arm caps
const CAP_FRAC = 0.5; // semicircle = half the width

/**
 * SVG-based vertical chromosome renderer with cytobands and centromere constriction.
 * p-arm at top, q-arm at bottom. Height is proportional to chromosome length.
 */
export function ChromosomeSVG({
  chrName,
  bands,
  chrLength,
  centromereStart,
  centromereEnd,
  width,
  height,
  detail,
  onClick,
  hovered,
}: ChromosomeSVGProps) {
  // chrM: draw a small teal circle
  if (chrName === 'chrM') {
    const r = Math.min(width, height) * 0.35;
    const cx = width / 2;
    const cy = height / 2;
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={`${COLOR.accent.teal}33`}
          stroke={COLOR.accent.teal}
          strokeWidth={1.5}
        />
        {hovered && (
          <circle
            cx={cx}
            cy={cy}
            r={r + 3}
            fill="none"
            stroke={COLOR.accent.teal}
            strokeWidth={0.5}
            opacity={0.5}
          />
        )}
      </svg>
    );
  }

  const halfW = width / 2;
  const capR = halfW * CAP_FRAC;
  const pinchHalfW = halfW * PINCH_RATIO;

  // Convert genomic position to y coordinate
  const bpToY = (bp: number) => (bp / chrLength) * height;

  const cenStartY = bpToY(centromereStart);
  const cenEndY = bpToY(centromereEnd);
  const cenMidY = (cenStartY + cenEndY) / 2;

  // Build the chromosome outline clip path
  const clipId = `chr-clip-${chrName}`;

  // Merge small bands based on detail level
  // low: aggressive merge (< 8px) — overview thumbnails
  // minimal: moderate merge (< 2px) — detail page mini chr
  // high: no merge — full resolution
  const visibleBands = useMemo(() => {
    if (detail === 'high') return bands;

    const threshold = detail === 'low' ? 8 : 2;
    const merged: CytoBand[] = [];
    let acc: CytoBand | null = null;

    for (const band of bands) {
      const bandH = bpToY(band.end) - bpToY(band.start);
      if (bandH < threshold) {
        if (acc !== null) {
          acc = { chrom: acc.chrom, start: acc.start, end: band.end, name: acc.name, gieStain: acc.gieStain };
        } else {
          acc = { chrom: band.chrom, start: band.start, end: band.end, name: band.name, gieStain: band.gieStain };
        }
      } else {
        if (acc !== null) {
          merged.push(acc);
          acc = null;
        }
        merged.push(band);
      }
    }
    if (acc !== null) merged.push(acc);
    return merged;
  }, [bands, detail, height, chrLength]);

  // Build outline path with semicircular caps and centromere constriction
  // Path goes: top cap (left to right), right side down through centromere, bottom cap (right to left), left side up through centromere
  const outlinePath = useMemo(() => {
    const parts: string[] = [];

    // Start at top-left, after the cap
    // Top semicircular cap: arc from left to right
    parts.push(`M ${halfW - halfW} ${capR}`);
    parts.push(`A ${halfW} ${capR} 0 0 1 ${halfW + halfW} ${capR}`);

    // Right side: down to centromere
    parts.push(`L ${width} ${cenStartY}`);
    // Centromere pinch (right side): quadratic bezier inward
    parts.push(`Q ${halfW + pinchHalfW} ${cenMidY} ${width} ${cenEndY}`);

    // Continue right side down to bottom cap
    parts.push(`L ${width} ${height - capR}`);
    // Bottom semicircular cap: arc from right to left
    parts.push(`A ${halfW} ${capR} 0 0 1 0 ${height - capR}`);

    // Left side: up to centromere
    parts.push(`L 0 ${cenEndY}`);
    // Centromere pinch (left side): quadratic bezier inward
    parts.push(`Q ${halfW - pinchHalfW} ${cenMidY} 0 ${cenStartY}`);

    // Left side up to top
    parts.push(`L 0 ${capR}`);
    parts.push('Z');

    return parts.join(' ');
  }, [width, height, halfW, capR, pinchHalfW, cenStartY, cenEndY, cenMidY]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', display: 'block' }}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={outlinePath} />
        </clipPath>
      </defs>

      {/* Band fills clipped to chromosome shape */}
      <g clipPath={`url(#${clipId})`}>
        {/* Background fill */}
        <rect x={0} y={0} width={width} height={height} fill={GIEMSA_COLORS.gneg} />

        {/* Cytoband rects */}
        {visibleBands.map((band, i) => {
          const y = bpToY(band.start);
          const h = Math.max(bpToY(band.end) - y, 0.5);
          const fill = GIEMSA_COLORS[band.gieStain] || GIEMSA_COLORS.gneg;
          return (
            <rect
              key={`${band.name}-${i}`}
              x={0}
              y={y}
              width={width}
              height={h}
              fill={fill}
            />
          );
        })}

        {/* Telomere caps — teal tint at chromosome tips */}
        {bands.length > 0 && (
          <>
            <rect
              x={0}
              y={0}
              width={width}
              height={Math.max(bpToY(bands[0].end), 1)}
              fill={COLOR.accent.teal}
              opacity={0.4}
            />
            <rect
              x={0}
              y={bpToY(bands[bands.length - 1].start)}
              width={width}
              height={Math.max(height - bpToY(bands[bands.length - 1].start), 1)}
              fill={COLOR.accent.teal}
              opacity={0.4}
            />
          </>
        )}
      </g>

      {/* Chromosome outline */}
      <path
        d={outlinePath}
        fill="none"
        stroke={hovered ? COLOR.accent.teal : COLOR.border.strong}
        strokeWidth={hovered ? 1.5 : 0.75}
        style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
      />

      {/* Hover glow */}
      {hovered && (
        <path
          d={outlinePath}
          fill="none"
          stroke={COLOR.accent.teal}
          strokeWidth={3}
          opacity={0.15}
        />
      )}
    </svg>
  );
}
