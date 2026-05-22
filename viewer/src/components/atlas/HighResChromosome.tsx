'use client';

import { useMemo } from 'react';
import { CYTOBANDS, type CytoBand } from '@/config/cytobands';
import { CHROMOSOME_FACTS, type GeneFact } from '@/config/chromosomeFacts';
import { type ChromosomeInfo } from '@/config/chromosomes';
import { getIsochoreBins } from '@/config/karyotypeData';
import { COLOR, TYPE, FONT_FAMILY, FONT_FAMILY_MONO, WEIGHT } from '@/config/theme';

interface HighResChromosomeProps {
  chr: ChromosomeInfo;
}

const CHR_WIDTH = 64;
const CHR_HEIGHT = 680;
const LEFT_LABEL_AREA = 120;
const RIGHT_LABEL_AREA = 240;
const CHR_LEFT_OFFSET = LEFT_LABEL_AREA;
const TOTAL_WIDTH = LEFT_LABEL_AREA + CHR_WIDTH + RIGHT_LABEL_AREA + 24;
const LEADER_GAP = 10;
const LABEL_HEIGHT = 26;
const MIN_LABEL_GAP = 6;
const CAP_FRAC = 0.55;
const PINCH_RATIO = 0.42;

/** Map a band name (e.g. '17q21.31') to a y-position on the rendered chromosome. */
function bandToY(bandName: string, bands: CytoBand[], chrLength: number, height: number): number | null {
  const cleanBand = bandName.replace(/^(chr)?(\d+|X|Y|M)/i, '');
  const band = bands.find((b) => b.name === cleanBand || b.name === bandName);
  if (!band) return null;
  const midBp = (band.start + band.end) / 2;
  return (midBp / chrLength) * height;
}

/**
 * Two-pass label distribution: push down, then push back up if overflow.
 * Guarantees no overlap and respects both top and bottom bounds.
 */
function distributeLabels(
  idealYs: { y: number; idx: number }[],
  labelH: number,
  minGap: number,
  maxH: number,
): number[] {
  if (idealYs.length === 0) return [];
  const sorted = [...idealYs].sort((a, b) => a.y - b.y);
  const positions = new Array<number>(sorted.length);
  const step = labelH + minGap;
  const maxY = Math.max(0, maxH - labelH);

  // Pass 1: greedy push-down from top
  let lastBottom = -Infinity;
  for (let i = 0; i < sorted.length; i++) {
    positions[i] = Math.max(sorted[i].y, lastBottom + minGap);
    lastBottom = positions[i] + labelH;
  }
  // Pass 2: if bottom labels overflow, push chain back up
  if (positions[positions.length - 1] > maxY) {
    positions[positions.length - 1] = maxY;
    for (let i = positions.length - 2; i >= 0; i--) {
      const maxAllowed = positions[i + 1] - step;
      if (positions[i] > maxAllowed) positions[i] = maxAllowed;
    }
    if (positions[0] < 0) {
      positions[0] = 0;
      for (let i = 1; i < positions.length; i++) {
        const minAllowed = positions[i - 1] + step;
        if (positions[i] < minAllowed) positions[i] = minAllowed;
      }
    }
  }
  // Map back to original indices
  const result = new Array<number>(idealYs.length);
  for (let i = 0; i < sorted.length; i++) {
    result[sorted[i].idx] = Math.max(0, Math.min(positions[i], maxY));
  }
  return result;
}

/** Collapse sub-bands (p13.3, p13.2, p13.11) into major regions (p13). */
interface MajorBand { name: string; start: number; end: number }
function getMajorBands(bands: CytoBand[]): MajorBand[] {
  const majorMap = new Map<string, { start: number; end: number }>();
  for (const b of bands) {
    if (b.gieStain === 'acen') continue;
    const match = b.name.match(/^([pq]\d{1,2})/);
    if (!match) continue;
    const major = match[1];
    const existing = majorMap.get(major);
    if (existing) {
      existing.start = Math.min(existing.start, b.start);
      existing.end = Math.max(existing.end, b.end);
    } else {
      majorMap.set(major, { start: b.start, end: b.end });
    }
  }
  return Array.from(majorMap.entries()).map(([name, range]) => ({ name, start: range.start, end: range.end }));
}

export function HighResChromosome({ chr }: HighResChromosomeProps) {
  const bands = useMemo(() => CYTOBANDS.filter((b) => b.chrom === chr.name), [chr.name]);
  const isochoreBins = useMemo(() => getIsochoreBins(chr.name), [chr.name]);
  const facts = CHROMOSOME_FACTS[chr.name];
  const features = facts;
  const genes: GeneFact[] = features?.notableGenes ?? [];

  const maxLen = 248_956_422; // chr1 reference
  const height = chr.name === 'chrM'
    ? 80
    : Math.max(160, Math.round((chr.length / maxLen) * CHR_HEIGHT));

  // Right-side gene labels
  const genePositions = useMemo(() => {
    const positioned: { gene: GeneFact; idealY: number; idx: number }[] = [];
    genes.forEach((gene, idx) => {
      if (!gene.band) return;
      const y = bandToY(gene.band, bands, chr.length, height);
      if (y !== null) positioned.push({ gene, idealY: y, idx });
    });
    const idealYs = positioned.map((p) => ({ y: p.idealY, idx: p.idx }));
    const distributedYs = distributeLabels(idealYs, LABEL_HEIGHT, MIN_LABEL_GAP, height);
    return positioned.map((p) => ({ ...p, labelY: distributedYs[p.idx] ?? p.idealY }));
  }, [genes, bands, chr.length, height]);

  // Left-side major-band labels (collapsed sub-bands)
  const bandPositions = useMemo(() => {
    const majorBands = getMajorBands(bands);
    const positioned = majorBands.map((band, idx) => ({
      band,
      idealY: ((band.start + band.end) / 2 / chr.length) * height,
      idx,
    }));
    const idealYs = positioned.map((p) => ({ y: p.idealY, idx: p.idx }));
    const distributedYs = distributeLabels(idealYs, LABEL_HEIGHT, MIN_LABEL_GAP, height);
    return positioned.map((p) => ({ ...p, labelY: distributedYs[p.idx] ?? p.idealY }));
  }, [bands, chr.length, height]);

  // chrM is circular — render as small electric-blue ring with a "M" label.
  if (chr.name === 'chrM') {
    const size = 80;
    const r = size * 0.35;
    return (
      <div style={{ width: TOTAL_WIDTH, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size + 60} height={size + 60} viewBox={`0 0 ${size + 60} ${size + 60}`}>
          <circle
            cx={(size + 60) / 2}
            cy={(size + 60) / 2}
            r={r}
            fill={`${COLOR.primary.base}1F`}
            stroke={COLOR.primary.base}
            strokeWidth={1.5}
          />
          <text
            x={(size + 60) / 2}
            y={(size + 60) / 2 + 5}
            textAnchor="middle"
            fontFamily="var(--font-jetbrains-mono), monospace"
            fontSize={14}
            fontWeight={700}
            fill={COLOR.primary.base}
          >
            M
          </text>
        </svg>
      </div>
    );
  }

  // ── Chromosome silhouette path ──
  const halfW = CHR_WIDTH / 2;
  const capR = halfW * CAP_FRAC;
  const pinchHalfW = halfW * PINCH_RATIO;
  const xL = 0;
  const xR = CHR_WIDTH;
  const xMid = halfW;
  const yTop = 0;
  const yBot = height;
  const cenStartY = (chr.centromereStart / chr.length) * height;
  const cenEndY = (chr.centromereEnd / chr.length) * height;
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
  const clipId = `hires-chr-clip-${chr.name}`;

  return (
    <div style={{ position: 'relative', width: TOTAL_WIDTH, height }}>
      {/* Chromosome silhouette + cytoband fills */}
      <svg
        width={CHR_WIDTH}
        height={height}
        viewBox={`0 0 ${CHR_WIDTH} ${height}`}
        style={{ position: 'absolute', left: CHR_LEFT_OFFSET, top: 0 }}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={outlinePath} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {/* Background — light surface */}
          <rect x={0} y={0} width={CHR_WIDTH} height={height} fill={COLOR.bg.elevated} />

          {/* Isochore-coloured bins — same cool-warm AT→GC gradient as the
              /atlas overview. Bins are normalised [0,1] across chr length. */}
          {isochoreBins.map((b, i) => (
            <rect
              key={`iso-${i}`}
              x={0}
              y={b.start * height}
              width={CHR_WIDTH}
              height={Math.max((b.end - b.start) * height, 0.5)}
              fill={COLOR.isochore[b.klass]}
              fillOpacity={0.88}
            />
          ))}

          {/* Centromere — desaturated overlay */}
          <rect
            x={0}
            y={cenStartY}
            width={CHR_WIDTH}
            height={Math.max(cenEndY - cenStartY, 1)}
            fill={COLOR.text.muted}
            fillOpacity={0.6}
          />
        </g>
        {/* Outline */}
        <path
          d={outlinePath}
          fill="none"
          stroke={COLOR.border.strong}
          strokeWidth={0.85}
        />
      </svg>

      {/* Leader lines + labels overlay */}
      <svg
        width={TOTAL_WIDTH}
        height={height}
        style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      >
        {/* Left-side cytoband labels — major-band collapsed */}
        {bandPositions.map(({ band, idealY, labelY }) => {
          const dotX = CHR_LEFT_OFFSET - 2;
          const lineEndX = LEFT_LABEL_AREA - 12;
          const textX = lineEndX - 4;
          return (
            <g key={band.name}>
              <circle cx={dotX} cy={idealY} r={2} fill={COLOR.border.strong} />
              <line
                x1={dotX - 2} y1={idealY}
                x2={lineEndX} y2={labelY + LABEL_HEIGHT / 2}
                stroke={COLOR.border.strong} strokeWidth={0.75} strokeDasharray="2,2"
              />
              <text
                x={textX} y={labelY + LABEL_HEIGHT / 2}
                fill={COLOR.text.tertiary}
                fontSize={TYPE.xs.fontSize}
                fontFamily={FONT_FAMILY_MONO}
                textAnchor="end" dominantBaseline="central"
                letterSpacing="0.02em"
              >
                {band.name}
              </text>
            </g>
          );
        })}

        {/* Right-side gene labels */}
        {genePositions.map(({ gene, idealY, labelY }) => {
          const lineStartX = CHR_LEFT_OFFSET + CHR_WIDTH + LEADER_GAP;
          const lineEndX = CHR_LEFT_OFFSET + CHR_WIDTH + LEADER_GAP + 36;
          const textX = lineEndX + 8;
          return (
            <g key={`${gene.symbol}-${gene.band}`}>
              <line
                x1={lineStartX} y1={idealY}
                x2={lineEndX} y2={labelY + LABEL_HEIGHT / 2}
                stroke={COLOR.border.strong} strokeWidth={0.75} strokeDasharray="2,2"
              />
              <circle cx={lineStartX - 2} cy={idealY} r={2.5} fill={COLOR.primary.base} />
              <text
                x={textX} y={labelY + 9}
                fill={COLOR.primary.base}
                fontSize={TYPE.sm.fontSize}
                fontFamily={FONT_FAMILY_MONO}
                fontWeight={WEIGHT.semibold}
                letterSpacing="0.01em"
              >
                {gene.symbol}
              </text>
              <text
                x={textX} y={labelY + 22}
                fill={COLOR.text.tertiary}
                fontSize={10}
                fontFamily={FONT_FAMILY_MONO}
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
