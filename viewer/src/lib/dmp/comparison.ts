/**
 * Multi-comparison utilities for DMP datasets.
 *
 * Overlap statistics, Venn data, and Spearman rank correlation.
 */

import type { DMPRow, ThresholdState } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudyDataset {
  name: string;
  color: string;
  rows: DMPRow[];
}

export interface OverlapStats {
  studyA: string;
  studyB: string;
  sigA: number;
  sigB: number;
  overlap: number;
  onlyA: number;
  onlyB: number;
  jaccardIndex: number;
  concordanceRate: number;  // % same direction among overlap
  spearmanRho: number;      // rank correlation of logFC
}

export interface VennData {
  sets: { name: string; size: number; color: string }[];
  intersections: { sets: number[]; size: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSig(row: DMPRow, t: ThresholdState): boolean {
  return row.adj_p_value < t.adjPValueCutoff && Math.abs(row.delta_beta) >= t.deltaBetaCutoff;
}

function sigProbeMap(study: StudyDataset, t: ThresholdState): Map<string, DMPRow> {
  const m = new Map<string, DMPRow>();
  for (const r of study.rows) {
    if (isSig(r, t)) m.set(r.probe_id, r);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Spearman rank correlation
// ---------------------------------------------------------------------------

function rankArray(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);

  let i = 0;
  while (i < indexed.length) {
    let j = i;
    // Find ties
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    // Average rank for ties
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    i = j;
  }

  return ranks;
}

export function computeSpearmanRho(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;

  const xRanks = rankArray(x);
  const yRanks = rankArray(y);

  // Pearson on ranks
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xRanks[i];
    sumY += yRanks[i];
    sumXY += xRanks[i] * yRanks[i];
    sumX2 += xRanks[i] * xRanks[i];
    sumY2 += yRanks[i] * yRanks[i];
  }

  const num = n * sumXY - sumX * sumY;
  const denA = Math.sqrt(n * sumX2 - sumX * sumX);
  const denB = Math.sqrt(n * sumY2 - sumY * sumY);

  if (denA === 0 || denB === 0) return 0;
  return num / (denA * denB);
}

// ---------------------------------------------------------------------------
// Overlap computation
// ---------------------------------------------------------------------------

export function computeOverlap(
  a: StudyDataset,
  b: StudyDataset,
  thresholds: ThresholdState,
): OverlapStats {
  const mapA = sigProbeMap(a, thresholds);
  const mapB = sigProbeMap(b, thresholds);

  let overlap = 0;
  let concordant = 0;
  const overlapDbA: number[] = [];
  const overlapDbB: number[] = [];

  for (const [probeId, rowA] of mapA) {
    const rowB = mapB.get(probeId);
    if (rowB) {
      overlap++;
      if ((rowA.delta_beta > 0) === (rowB.delta_beta > 0)) concordant++;
      overlapDbA.push(rowA.delta_beta);
      overlapDbB.push(rowB.delta_beta);
    }
  }

  const sigA = mapA.size;
  const sigB = mapB.size;
  const union = sigA + sigB - overlap;

  return {
    studyA: a.name,
    studyB: b.name,
    sigA,
    sigB,
    overlap,
    onlyA: sigA - overlap,
    onlyB: sigB - overlap,
    jaccardIndex: union > 0 ? overlap / union : 0,
    concordanceRate: overlap > 0 ? concordant / overlap : 0,
    spearmanRho: overlapDbA.length >= 3
      ? computeSpearmanRho(overlapDbA, overlapDbB)
      : 0,
  };
}

// ---------------------------------------------------------------------------
// Venn diagram data
// ---------------------------------------------------------------------------

export function computeVennData(
  studies: StudyDataset[],
  thresholds: ThresholdState,
): VennData {
  const sigSets = studies.map(s => {
    const set = new Set<string>();
    for (const r of s.rows) {
      if (isSig(r, thresholds)) set.add(r.probe_id);
    }
    return set;
  });

  const sets = studies.map((s, i) => ({
    name: s.name,
    size: sigSets[i].size,
    color: s.color,
  }));

  const intersections: { sets: number[]; size: number }[] = [];
  const n = studies.length;

  if (n >= 2) {
    // All 2-way intersections
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let count = 0;
        for (const p of sigSets[i]) {
          if (sigSets[j].has(p)) count++;
        }
        intersections.push({ sets: [i, j], size: count });
      }
    }
  }

  if (n >= 3) {
    // 3-way intersection
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          let count = 0;
          for (const p of sigSets[i]) {
            if (sigSets[j].has(p) && sigSets[k].has(p)) count++;
          }
          intersections.push({ sets: [i, j, k], size: count });
        }
      }
    }
  }

  return { sets, intersections };
}

// ---------------------------------------------------------------------------
// Find probes unique to one study
// ---------------------------------------------------------------------------

export function findUniqueProbes(
  study: StudyDataset,
  others: StudyDataset[],
  thresholds: ThresholdState,
): DMPRow[] {
  const otherSigs = new Set<string>();
  for (const other of others) {
    for (const r of other.rows) {
      if (isSig(r, thresholds)) otherSigs.add(r.probe_id);
    }
  }

  return study.rows.filter(
    r => isSig(r, thresholds) && !otherSigs.has(r.probe_id),
  );
}
