'use client';

import { useMemo } from 'react';
import { getBandsForChromosome, CytoBand } from '@/config/cytobands';
import { CHROMOSOME_FACTS, GeneFact } from '@/config/chromosomeFacts';
import { ChromosomeInfo } from '@/config/chromosomes';
import { ChromosomeSVG } from './ChromosomeSVG';
import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE } from '@/config/theme';

interface HighResChromosomeProps {
  chr: ChromosomeInfo;
}

const CHR_WIDTH = 64;
const CHR_HEIGHT = 680;
const LABEL_AREA_WIDTH = 220;
const LEFT_LABEL_AREA = 120;
const CHR_LEFT_OFFSET = LEFT_LABEL_AREA;
const TOTAL_WIDTH = LEFT_LABEL_AREA + CHR_WIDTH + LABEL_AREA_WIDTH + 24;
const LEADER_GAP = 10;
const LABEL_HEIGHT = 24;
const MIN_LABEL_GAP = 6;

/**
 * Map a gene's band name (e.g. "7q34") to a y-position on the chromosome SVG.
 */
function bandToY(bandName: string, bands: CytoBand[], chrLength: number, height: number): number | null {
  const cleanBand = bandName.replace(/^(chr)?(\d+|X|Y)/i, '');
  const band = bands.find(b => b.name === cleanBand || b.name === bandName);
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
      if (positions[i] > maxAllowed) {
        positions[i] = maxAllowed;
      }
    }
    // Re-clamp top if chain was pushed too far up
    if (positions[0] < 0) {
      positions[0] = 0;
      for (let i = 1; i < positions.length; i++) {
        const minAllowed = positions[i - 1] + step;
        if (positions[i] < minAllowed) {
          positions[i] = minAllowed;
        }
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

/**
 * Collapse sub-bands into major band regions.
 * e.g. p13.3, p13.2, p13.11 → one "p13" region spanning their full extent.
 * Excludes centromere bands (acen).
 */
interface MajorBand {
  name: string;
  start: number;
  end: number;
}

function getMajorBands(bands: CytoBand[]): MajorBand[] {
  const majorMap = new Map<string, { start: number; end: number }>();

  for (const b of bands) {
    if (b.gieStain === 'acen') continue;
    // Extract major band prefix: p13.3 → p13, q22.1 → q22, p11 → p11
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

  return Array.from(majorMap.entries()).map(([name, range]) => ({
    name,
    start: range.start,
    end: range.end,
  }));
}

export function HighResChromosome({ chr }: HighResChromosomeProps) {
  const bands = getBandsForChromosome(chr.name);
  const facts = CHROMOSOME_FACTS[chr.name];
  const genes = facts?.notableGenes || [];

  // Calculate height proportional to chromosome length (chr1 = CHR_HEIGHT)
  const maxLen = 248956422; // chr1
  const height = chr.name === 'chrM' ? 80 : Math.max(120, Math.round((chr.length / maxLen) * CHR_HEIGHT));

  // Map genes to y-positions
  const genePositions = useMemo(() => {
    const positioned: { gene: GeneFact; idealY: number; idx: number }[] = [];

    genes.forEach((gene, idx) => {
      if (!gene.band) return;
      const y = bandToY(gene.band, bands, chr.length, height);
      if (y !== null) {
        positioned.push({ gene, idealY: y, idx });
      }
    });

    const idealYs = positioned.map(p => ({ y: p.idealY, idx: p.idx }));
    const distributedYs = distributeLabels(idealYs, LABEL_HEIGHT, MIN_LABEL_GAP, height);

    return positioned.map(p => ({
      ...p,
      labelY: distributedYs[p.idx] ?? p.idealY,
    }));
  }, [genes, bands, chr.length, height]);

  // Left-side cytoband label positions — collapsed major bands
  const bandPositions = useMemo(() => {
    const majorBands = getMajorBands(bands);
    const positioned = majorBands.map((band, idx) => {
      const idealY = ((band.start + band.end) / 2 / chr.length) * height;
      return { band, idealY, idx };
    });

    const idealYs = positioned.map(p => ({ y: p.idealY, idx: p.idx }));
    const distributedYs = distributeLabels(idealYs, LABEL_HEIGHT, MIN_LABEL_GAP, height);

    return positioned.map(p => ({
      ...p,
      labelY: distributedYs[p.idx] ?? p.idealY,
    }));
  }, [bands, chr.length, height]);

  if (chr.name === 'chrM') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height }}>
        <ChromosomeSVG
          chrName={chr.name}
          bands={bands}
          chrLength={chr.length}
          centromereStart={chr.centromereStart}
          centromereEnd={chr.centromereEnd}
          width={60}
          height={60}
          detail="high"
        />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: TOTAL_WIDTH, height }}>
      {/* Chromosome SVG */}
      <div style={{ position: 'absolute', left: CHR_LEFT_OFFSET, top: 0 }}>
        <ChromosomeSVG
          chrName={chr.name}
          bands={bands}
          chrLength={chr.length}
          centromereStart={chr.centromereStart}
          centromereEnd={chr.centromereEnd}
          width={CHR_WIDTH}
          height={height}
          detail="high"
        />
      </div>

      {/* Leader lines + labels overlay */}
      <svg
        width={TOTAL_WIDTH}
        height={height}
        style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      >
        {/* Left-side cytoband labels */}
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
                fill={COLOR.text.muted} fontSize={TYPE.xs.fontSize}
                fontFamily={FONT_FAMILY} textAnchor="end" dominantBaseline="central"
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
            <g key={gene.symbol}>
              <line
                x1={lineStartX} y1={idealY}
                x2={lineEndX} y2={labelY + LABEL_HEIGHT / 2}
                stroke={COLOR.text.faint} strokeWidth={0.75} strokeDasharray="2,2"
              />
              <circle cx={lineStartX - 2} cy={idealY} r={2.5} fill={COLOR.accent.teal} />
              <text
                x={textX} y={labelY + 8}
                fill={COLOR.accent.teal} fontSize={TYPE.sm.fontSize}
                fontFamily={FONT_FAMILY} fontWeight={WEIGHT.medium}
              >
                {gene.symbol}
              </text>
              <text
                x={textX} y={labelY + 20}
                fill={COLOR.text.faint} fontSize={TYPE.xs.fontSize}
                fontFamily={FONT_FAMILY}
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
