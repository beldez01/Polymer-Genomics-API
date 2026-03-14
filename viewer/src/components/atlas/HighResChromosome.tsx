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
const LEADER_GAP = 10; // gap between chr edge and leader line start
const LABEL_HEIGHT = 24; // vertical space per label
const MIN_LABEL_GAP = 6; // minimum gap between labels

/**
 * Map a gene's band name (e.g. "7q34") to a y-position on the chromosome SVG.
 * Finds the band in the cytoband data and returns its midpoint.
 */
function bandToY(bandName: string, bands: CytoBand[], chrLength: number, height: number): number | null {
  // Strip the chromosome prefix if present (e.g. "Xp21.2" → look for "p21.2" in chrX bands)
  const cleanBand = bandName.replace(/^(chr)?(\d+|X|Y)/i, '');
  const band = bands.find(b => b.name === cleanBand || b.name === bandName);
  if (!band) return null;
  const midBp = (band.start + band.end) / 2;
  return (midBp / chrLength) * height;
}

/**
 * Greedy vertical distribution to prevent label overlap.
 * Pushes labels apart while staying close to their ideal positions.
 */
function distributeLabels(
  idealYs: { y: number; idx: number }[],
  labelH: number,
  minGap: number,
  maxH: number,
): number[] {
  if (idealYs.length === 0) return [];

  // Sort by ideal y position
  const sorted = [...idealYs].sort((a, b) => a.y - b.y);
  const result = new Array<number>(idealYs.length);

  // Place labels greedily, pushing down when overlapping
  let lastBottom = -Infinity;
  for (const item of sorted) {
    const y = Math.max(item.y, lastBottom + minGap);
    const clamped = Math.min(y, maxH - labelH);
    result[item.idx] = Math.max(0, clamped);
    lastBottom = result[item.idx] + labelH;
  }

  return result;
}

/**
 * Filter to major cytobands (e.g. p11, q21) excluding sub-bands and centromere.
 */
function getMajorBands(bands: CytoBand[]): CytoBand[] {
  return bands.filter(b => /^[pq]\d{1,2}$/.test(b.name) && b.gieStain !== 'acen');
}

export function HighResChromosome({ chr }: HighResChromosomeProps) {
  const bands = getBandsForChromosome(chr.name);
  const facts = CHROMOSOME_FACTS[chr.name];
  const genes = facts?.notableGenes || [];

  // Calculate height proportional to chromosome length (chr1 = CHR_HEIGHT)
  const maxLen = 248956422; // chr1
  const height = chr.name === 'chrM' ? 80 : Math.max(80, Math.round((chr.length / maxLen) * CHR_HEIGHT));

  // Map genes to y-positions
  const genePositions = useMemo(() => {
    const positioned: { gene: GeneFact; idealY: number; idx: number }[] = [];

    genes.forEach((gene, idx) => {
      if (!gene.band) return; // chrM genes have no band
      const y = bandToY(gene.band, bands, chr.length, height);
      if (y !== null) {
        positioned.push({ gene, idealY: y, idx });
      }
    });

    // Distribute labels to avoid overlap
    const idealYs = positioned.map(p => ({ y: p.idealY, idx: p.idx }));
    const distributedYs = distributeLabels(idealYs, LABEL_HEIGHT, MIN_LABEL_GAP, height);

    return positioned.map(p => ({
      ...p,
      labelY: distributedYs[p.idx] ?? p.idealY,
    }));
  }, [genes, bands, chr.length, height]);

  // Left-side cytoband label positions
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
              {/* Dot on chromosome left edge */}
              <circle
                cx={dotX}
                cy={idealY}
                r={2}
                fill={COLOR.border.strong}
              />
              {/* Dashed leader line from dot leftward to label */}
              <line
                x1={dotX - 2}
                y1={idealY}
                x2={lineEndX}
                y2={labelY + LABEL_HEIGHT / 2}
                stroke={COLOR.border.strong}
                strokeWidth={0.75}
                strokeDasharray="2,2"
              />
              {/* Band name text */}
              <text
                x={textX}
                y={labelY + LABEL_HEIGHT / 2}
                fill={COLOR.text.muted}
                fontSize={TYPE.xs.fontSize}
                fontFamily={FONT_FAMILY}
                textAnchor="end"
                dominantBaseline="central"
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
              {/* Horizontal leader line from chromosome edge */}
              <line
                x1={lineStartX}
                y1={idealY}
                x2={lineEndX}
                y2={labelY + LABEL_HEIGHT / 2}
                stroke={COLOR.text.faint}
                strokeWidth={0.75}
                strokeDasharray="2,2"
              />
              {/* Small dot on chromosome edge */}
              <circle
                cx={lineStartX - 2}
                cy={idealY}
                r={2.5}
                fill={COLOR.accent.teal}
              />
              {/* Gene symbol */}
              <text
                x={textX}
                y={labelY + 8}
                fill={COLOR.accent.teal}
                fontSize={TYPE.sm.fontSize}
                fontFamily={FONT_FAMILY}
                fontWeight={WEIGHT.medium}
              >
                {gene.symbol}
              </text>
              {/* Band location */}
              <text
                x={textX}
                y={labelY + 20}
                fill={COLOR.text.faint}
                fontSize={TYPE.xs.fontSize}
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
