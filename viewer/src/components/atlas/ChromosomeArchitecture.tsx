'use client';

import { CYTOBANDS, GIEMSA_COLORS, type CytoBand } from '@/config/cytobands';
import type { GeneEntry } from '@/config/chromosomeFeatures';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, WEIGHT, SPACE } from '@/config/theme';

interface ChromosomeArchitectureProps {
  chrName: string;
  chrLength: number;
  centromereStart: number;
  centromereEnd: number;
  notableGenes: GeneEntry[];
}

const PLOT_H = 720;          // total svg height
const STRIP_TOP = 30;        // padding for top band label
const STRIP_BOT = 30;        // padding for bottom band label
const STRIP_X = 90;          // chromosome strip left edge in svg
const STRIP_W = 26;          // chromosome strip width
const CAP_FRAC = 0.55;       // telomere cap radius
const PINCH_RATIO = 0.40;    // centromere narrowness
const BAND_LABEL_X = STRIP_X - 8;  // band-label right edge
const GENE_X = STRIP_X + STRIP_W + 36;  // gene-label left edge
const SVG_W = 520;

/**
 * Resolve a gene's band string (e.g., '17p13.1', 'q21.31') to a midpoint
 * y-position on the chromosome. Tolerates leading 'chr', missing chr
 * prefix on the band, and approximate matches for compound bands like
 * '17q22-q24' (uses the first listed band).
 */
function bandYFor(
  band: string,
  chrName: string,
  bandIndex: Map<string, { start: number; end: number }>,
  yAt: (bp: number) => number,
): number | null {
  // Normalize: 'p13.1' -> '17p13.1', '17p13.1' -> '17p13.1'.
  const chrNum = chrName.replace('chr', '');
  let normalized = band.trim();
  if (normalized.startsWith(chrNum + 'p') || normalized.startsWith(chrNum + 'q')) {
    // already has chr prefix
  } else if (normalized.startsWith('p') || normalized.startsWith('q')) {
    normalized = chrNum + normalized;
  }
  // Compound band 'q22-q24' -> use first
  if (normalized.includes('-')) normalized = normalized.split('-')[0];
  // Try exact match, then progressively less specific (q21.31 → q21.3 → q21)
  const candidates = [normalized];
  for (let i = normalized.length - 1; i > chrNum.length; i--) {
    const trimmed = normalized.slice(0, i);
    if (trimmed.endsWith('.')) continue;
    candidates.push(trimmed);
  }
  for (const c of candidates) {
    // Find any band whose name starts with this string
    for (const [bandName, range] of bandIndex) {
      if (bandName === c || bandName.startsWith(c)) {
        return yAt((range.start + range.end) / 2);
      }
    }
  }
  return null;
}

export function ChromosomeArchitecture({
  chrName,
  chrLength,
  centromereStart,
  centromereEnd,
  notableGenes,
}: ChromosomeArchitectureProps) {
  const bands = CYTOBANDS.filter((b) => b.chrom === chrName);
  if (bands.length === 0 || chrLength === 0) {
    return null;
  }

  const PLOT_INNER_H = PLOT_H - STRIP_TOP - STRIP_BOT;
  const yAt = (bp: number) => STRIP_TOP + (bp / chrLength) * PLOT_INNER_H;

  // Band index for gene-to-band resolution
  const bandIndex = new Map<string, { start: number; end: number }>();
  for (const b of bands) {
    bandIndex.set(b.name, { start: b.start, end: b.end });
  }

  // Build chromosome silhouette path (centromere pinch + telomere caps)
  const halfW = STRIP_W / 2;
  const capR = halfW * CAP_FRAC;
  const pinchHalfW = halfW * PINCH_RATIO;
  const xL = STRIP_X;
  const xR = STRIP_X + STRIP_W;
  const xMid = STRIP_X + halfW;
  const yTop = STRIP_TOP;
  const yBot = STRIP_TOP + PLOT_INNER_H;
  const cenStartY = yAt(centromereStart);
  const cenEndY = yAt(centromereEnd);
  const cenMidY = (cenStartY + cenEndY) / 2;

  const outlinePath = [
    `M ${xL} ${yTop + capR}`,
    `A ${halfW} ${capR} 0 0 1 ${xR} ${yTop + capR}`,
    `L ${xR} ${cenStartY}`,
    `Q ${xMid + pinchHalfW} ${cenMidY} ${xR} ${cenEndY}`,
    `L ${xR} ${yBot - capR}`,
    `A ${halfW} ${capR} 0 0 1 ${xL} ${yBot - capR}`,
    `L ${xL} ${cenEndY}`,
    `Q ${xMid - pinchHalfW} ${cenMidY} ${xL} ${cenStartY}`,
    'Z',
  ].join(' ');

  const clipId = `chr-arch-clip-${chrName}`;

  // Label-collision avoidance for cytoband names: only show every Nth
  // when bands are dense, but always show the first/last and band edges
  // that match a notable-gene band.
  const minLabelSpacing = 10;
  const visibleBandLabels: typeof bands = [];
  let lastLabelY = -Infinity;
  for (const b of bands) {
    const midY = yAt((b.start + b.end) / 2);
    if (midY - lastLabelY >= minLabelSpacing || b === bands[0] || b === bands[bands.length - 1]) {
      visibleBandLabels.push(b);
      lastLabelY = midY;
    }
  }

  // Resolve gene positions
  const placedGenes = notableGenes
    .map((g) => ({ gene: g, y: bandYFor(g.band, chrName, bandIndex, yAt) }))
    .filter((g): g is { gene: GeneEntry; y: number } => g.y !== null)
    .sort((a, b) => a.y - b.y);

  // De-collide gene labels: maintain min spacing between rows
  const minGeneSpacing = 28;
  const adjusted: Array<{ gene: GeneEntry; y: number; targetY: number }> = [];
  for (const p of placedGenes) {
    let y = p.y;
    if (adjusted.length > 0) {
      const prev = adjusted[adjusted.length - 1];
      if (y - prev.y < minGeneSpacing) y = prev.y + minGeneSpacing;
    }
    adjusted.push({ gene: p.gene, y, targetY: p.y });
  }

  // Compute SVG height to fit the deepest gene label
  const svgHeight = Math.max(PLOT_H, (adjusted[adjusted.length - 1]?.y ?? 0) + 60);

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      padding: SPACE[4],
      overflow: 'auto',
    }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${svgHeight}`}
        width="100%"
        style={{ display: 'block', minWidth: SVG_W }}
        role="img"
        aria-label={`${chrName} architecture: cytobands and notable genes`}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={outlinePath} />
          </clipPath>
        </defs>

        {/* Cytobands clipped to silhouette */}
        <g clipPath={`url(#${clipId})`}>
          <rect x={xL} y={yTop} width={STRIP_W} height={PLOT_INNER_H} fill={COLOR.bg.elevated} />
          {bands.map((b, i) => (
            <rect
              key={i}
              x={xL}
              y={yAt(b.start)}
              width={STRIP_W}
              height={Math.max(yAt(b.end) - yAt(b.start), 0.5)}
              fill={GIEMSA_COLORS[b.gieStain] ?? GIEMSA_COLORS.gneg}
            />
          ))}
          {/* Centromere subtle overlay */}
          <rect
            x={xL}
            y={cenStartY}
            width={STRIP_W}
            height={Math.max(cenEndY - cenStartY, 1)}
            fill={GIEMSA_COLORS.acen}
            fillOpacity={0.85}
          />
        </g>

        {/* Outline */}
        <path d={outlinePath} fill="none" stroke={COLOR.border.strong} strokeWidth={0.85} />

        {/* Band labels (left side) */}
        {visibleBandLabels.map((b, i) => {
          const midY = yAt((b.start + b.end) / 2);
          return (
            <text
              key={`bl-${i}`}
              x={BAND_LABEL_X}
              y={midY + 3}
              textAnchor="end"
              fontFamily="var(--font-jetbrains-mono), monospace"
              fontSize={9}
              fill={COLOR.text.tertiary}
              letterSpacing="0.02em"
            >
              {b.name}
            </text>
          );
        })}

        {/* Top arm label (p) */}
        <text
          x={xMid}
          y={yTop - 14}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={11}
          fontWeight={600}
          fill={COLOR.text.secondary}
          letterSpacing="0.08em"
        >
          p
        </text>
        {/* Bottom arm label (q) */}
        <text
          x={xMid}
          y={yBot + 18}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={11}
          fontWeight={600}
          fill={COLOR.text.secondary}
          letterSpacing="0.08em"
        >
          q
        </text>

        {/* Gene labels with connector lines */}
        {adjusted.map(({ gene, y, targetY }, i) => {
          const connectorX1 = xR;
          const connectorX2 = GENE_X - 8;
          return (
            <g key={`gene-${i}`}>
              {/* Anchor dot at the real band Y */}
              <circle
                cx={xR + 2}
                cy={targetY}
                r={2}
                fill={COLOR.primary.base}
              />
              {/* Connector — kinked line from band to label */}
              <path
                d={`M ${connectorX1 + 4} ${targetY} L ${connectorX1 + 14} ${targetY} L ${connectorX2 - 4} ${y} L ${connectorX2} ${y}`}
                fill="none"
                stroke={COLOR.border.strong}
                strokeWidth={0.6}
              />
              {/* Gene symbol */}
              <text
                x={GENE_X}
                y={y - 2}
                textAnchor="start"
                fontFamily="var(--font-jetbrains-mono), monospace"
                fontSize={12}
                fontWeight={600}
                fill={COLOR.primary.base}
                letterSpacing="0.02em"
              >
                {gene.symbol}
              </text>
              {/* Band */}
              <text
                x={GENE_X}
                y={y + 10}
                textAnchor="start"
                fontFamily="var(--font-jetbrains-mono), monospace"
                fontSize={9}
                fill={COLOR.text.tertiary}
                letterSpacing="0.04em"
              >
                {gene.band}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
