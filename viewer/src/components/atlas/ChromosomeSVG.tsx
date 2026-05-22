'use client';

import { useMemo } from 'react';
import { COLOR } from '@/config/theme';
import { type IsochoreBin } from '@/config/karyotypeData';

interface ChromosomeSVGProps {
  chrName: string;
  width: number;
  height: number;
  centromereStart: number;   // normalized [0,1]
  centromereEnd: number;
  isochoreBins?: IsochoreBin[];
  hovered?: boolean;
  onClick?: () => void;
}

// Visual constants for the chromosome silhouette
const PINCH_RATIO = 0.40;  // how narrow the centromere constriction gets
const CAP_FRAC = 0.55;     // semicircular telomere cap radius as fraction of half-width

/**
 * D2 vertical chromosome — p-arm at top, q-arm at bottom, semicircular
 * telomere caps, quadratic-bezier centromere pinch, isochore-coloured
 * interior. Light-mode styled (light-gray background, hairline outline,
 * electric-blue hover). Drops the dark-mode teal glow and Giemsa fallback.
 */
export function ChromosomeSVG({
  chrName,
  width,
  height,
  centromereStart,
  centromereEnd,
  isochoreBins,
  hovered,
  onClick,
}: ChromosomeSVGProps) {
  // chrM — small electric-blue ring
  if (chrName === 'chrM') {
    const r = Math.min(width, height) * 0.40;
    const cx = width / 2;
    const cy = height / 2;
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default', display: 'block' }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={`${COLOR.primary.base}1F`}  // ~12% opacity
          stroke={hovered ? COLOR.primary.base : COLOR.border.strong}
          strokeWidth={hovered ? 1.5 : 1}
        />
      </svg>
    );
  }

  const halfW = width / 2;
  const capR = halfW * CAP_FRAC;
  const pinchHalfW = halfW * PINCH_RATIO;

  // Convert normalized position to y coord
  const yAt = (t: number) => t * height;
  const cenStartY = yAt(centromereStart);
  const cenEndY   = yAt(centromereEnd);
  const cenMidY   = (cenStartY + cenEndY) / 2;

  const clipId = `chr-clip-${chrName}`;

  const outlinePath = useMemo(() => {
    const parts: string[] = [];
    // Top cap
    parts.push(`M 0 ${capR}`);
    parts.push(`A ${halfW} ${capR} 0 0 1 ${width} ${capR}`);
    // Right side down to centromere
    parts.push(`L ${width} ${cenStartY}`);
    parts.push(`Q ${halfW + pinchHalfW} ${cenMidY} ${width} ${cenEndY}`);
    // Right side down to bottom cap
    parts.push(`L ${width} ${height - capR}`);
    parts.push(`A ${halfW} ${capR} 0 0 1 0 ${height - capR}`);
    // Left side up through centromere
    parts.push(`L 0 ${cenEndY}`);
    parts.push(`Q ${halfW - pinchHalfW} ${cenMidY} 0 ${cenStartY}`);
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

      {/* Interior — light background + isochore bands */}
      <g clipPath={`url(#${clipId})`}>
        <rect x={0} y={0} width={width} height={height} fill={COLOR.bg.elevated} />

        {isochoreBins && isochoreBins.map((b, i) => (
          <rect
            key={i}
            x={0}
            y={yAt(b.start)}
            width={width}
            height={Math.max(yAt(b.end) - yAt(b.start), 0.5)}
            fill={COLOR.isochore[b.klass]}
            fillOpacity={0.88}
          />
        ))}

        {/* Centromere overlay — slight desaturate */}
        <rect
          x={0}
          y={cenStartY}
          width={width}
          height={Math.max(cenEndY - cenStartY, 1)}
          fill={COLOR.text.muted}
          fillOpacity={0.55}
        />
      </g>

      {/* Outline — hairline strong on idle, electric blue on hover */}
      <path
        d={outlinePath}
        fill="none"
        stroke={hovered ? COLOR.primary.base : COLOR.border.strong}
        strokeWidth={hovered ? 1.5 : 0.75}
        style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
      />

      {/* Hover halo — very faint electric blue */}
      {hovered && (
        <path
          d={outlinePath}
          fill="none"
          stroke={COLOR.primary.base}
          strokeWidth={3}
          opacity={0.12}
        />
      )}
    </svg>
  );
}
