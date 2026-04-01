// src/lib/te-methylation/dmp-scoring.ts
// Score TE families from DMP (differential methylation) results.
// Groups DMP probes by TE family and aggregates delta_beta / significance.

import type { DMPRow } from '../dmp/types';
import type { TEProbeMapping } from './types';
import type { TEFamily, TEClass } from '../transposome-types';
import type { RiskLevel } from './types';

/** Per-family differential methylation score */
export interface TEFamilyDiffScore {
  familyName: string;
  displayName: string;
  teClass: TEClass;
  meanDeltaBeta: number;
  nProbes: number;
  nTotal: number;
  coverage: number;
  nSignificant: number;
  proportionSignificant: number;
  direction: 'hyper' | 'hypo' | 'mixed';
  minPValue: number;
  riskLevel: RiskLevel;
  biophysics: {
    gc_content: number;
    stacking_dg37: number;
    wrapping_energy: number;
  };
  clinicallyImplicated: boolean;
  reactivationContexts: string[];
}

/** Full TE/ERV differential analysis result */
export interface TEDiffAnalysis {
  totalDMPs: number;
  teDMPs: number;
  teFraction: number;
  familyScores: TEFamilyDiffScore[];
  summaryByClass: Record<
    string,
    {
      meanDeltaBeta: number;
      nProbes: number;
      nFamilies: number;
      nSignificant: number;
    }
  >;
}

/**
 * Compute per-family differential methylation from DMP rows.
 */
export function computeFamilyDiffScores(
  rows: DMPRow[],
  mapping: TEProbeMapping,
  families: TEFamily[],
  adjPCutoff = 0.05,
): TEFamilyDiffScore[] {
  // Index DMP rows by probe_id for fast lookup
  const rowMap = new Map<string, DMPRow>();
  for (const r of rows) {
    rowMap.set(r.probe_id, r);
  }

  // Index family metadata
  const familyMeta = new Map<string, TEFamily>();
  for (const f of families) {
    familyMeta.set(f.family, f);
  }

  const scores: TEFamilyDiffScore[] = [];

  for (const [famName, famInfo] of Object.entries(mapping.families)) {
    const probeIds = famInfo.probe_ids;
    let sumDelta = 0;
    let count = 0;
    let nSig = 0;
    let minP = 1;
    let nHyper = 0;
    let nHypo = 0;

    for (const pid of probeIds) {
      const row = rowMap.get(pid);
      if (!row) continue;

      sumDelta += row.delta_beta;
      count++;

      if (row.adj_p_value <= adjPCutoff) {
        nSig++;
        if (row.delta_beta > 0) nHyper++;
        else nHypo++;
      }
      if (row.p_value < minP) minP = row.p_value;
    }

    if (count === 0) continue;

    const meanDelta = sumDelta / count;
    const meta = familyMeta.get(famName);

    // Direction: among significant probes
    let direction: 'hyper' | 'hypo' | 'mixed' = 'mixed';
    if (nSig > 0) {
      if (nHypo === 0) direction = 'hyper';
      else if (nHyper === 0) direction = 'hypo';
    } else {
      direction = meanDelta >= 0 ? 'hyper' : 'hypo';
    }

    // Risk: hypomethylation of TEs → reactivation risk
    const hypoDegree = Math.max(0, -meanDelta) / 0.3; // scale: -0.3 delta = max risk
    const reactivation = meta?.reactivation_score ?? 0.3;
    const risk = Math.min(1, reactivation * hypoDegree * (1 + (nSig / Math.max(1, count))));
    let riskLevel: RiskLevel = 'low';
    if (risk >= 0.4) riskLevel = 'high';
    else if (risk >= 0.25) riskLevel = 'elevated';
    else if (risk >= 0.1) riskLevel = 'moderate';

    const validClasses = ['LINE', 'SINE', 'LTR', 'DNA', 'SVA'] as const;
    const teClass: TEClass = (validClasses as readonly string[]).includes(famInfo.class)
      ? (famInfo.class as TEClass)
      : 'Other';

    scores.push({
      familyName: famName,
      displayName: meta?.display_name ?? `${famName} (${famInfo.class})`,
      teClass,
      meanDeltaBeta: Math.round(meanDelta * 10000) / 10000,
      nProbes: count,
      nTotal: probeIds.length,
      coverage: Math.round((count / probeIds.length) * 1000) / 1000,
      nSignificant: nSig,
      proportionSignificant: Math.round((nSig / count) * 1000) / 1000,
      direction,
      minPValue: minP,
      riskLevel,
      biophysics: {
        gc_content: meta?.gc_content ?? 0.42,
        stacking_dg37: meta?.stacking_dg37 ?? -1.5,
        wrapping_energy: meta?.wrapping_energy ?? 17.0,
      },
      clinicallyImplicated: meta?.clinically_implicated ?? false,
      reactivationContexts: meta?.reactivation_contexts ?? [],
    });
  }

  // Sort by number of significant probes descending, then mean delta
  scores.sort((a, b) => b.nSignificant - a.nSignificant || Math.abs(b.meanDeltaBeta) - Math.abs(a.meanDeltaBeta));
  return scores;
}

/**
 * Build the full TE differential analysis.
 */
export function buildDiffAnalysis(
  rows: DMPRow[],
  mapping: TEProbeMapping,
  families: TEFamily[],
  adjPCutoff = 0.05,
): TEDiffAnalysis {
  const familyScores = computeFamilyDiffScores(rows, mapping, families, adjPCutoff);
  const teDMPs = familyScores.reduce((sum, f) => sum + f.nProbes, 0);

  // Summary by class
  const byClass: Record<string, { sumDelta: number; count: number; families: number; nSig: number }> = {};
  for (const s of familyScores) {
    const cls = s.teClass;
    if (!byClass[cls]) byClass[cls] = { sumDelta: 0, count: 0, families: 0, nSig: 0 };
    byClass[cls].sumDelta += s.meanDeltaBeta * s.nProbes;
    byClass[cls].count += s.nProbes;
    byClass[cls].families++;
    byClass[cls].nSig += s.nSignificant;
  }

  const summaryByClass: TEDiffAnalysis['summaryByClass'] = {};
  for (const [cls, data] of Object.entries(byClass)) {
    summaryByClass[cls] = {
      meanDeltaBeta: Math.round((data.sumDelta / Math.max(1, data.count)) * 10000) / 10000,
      nProbes: data.count,
      nFamilies: data.families,
      nSignificant: data.nSig,
    };
  }

  return {
    totalDMPs: rows.length,
    teDMPs,
    teFraction: Math.round((teDMPs / Math.max(1, rows.length)) * 10000) / 10000,
    familyScores,
    summaryByClass,
  };
}
