// src/lib/te-methylation/scoring.ts
// Pure scoring functions for TE methylation analysis.
// No API calls — all computation is client-side from pre-fetched data.

import type { TEFamily } from '../transposome-types';
import type {
  TEProbeMapping,
  TEFamilyScore,
  TEMethylationAnalysis,
  RetroAgeResult,
  ClockProbe,
  RiskLevel,
} from './types';
import type { TEClass } from '../transposome-types';

/**
 * Compute per-family methylation scores from user beta values.
 */
export function computeFamilyScores(
  betas: Map<string, number>,
  mapping: TEProbeMapping,
  families: TEFamily[],
): TEFamilyScore[] {
  const familyMeta = new Map<string, TEFamily>();
  for (const f of families) {
    familyMeta.set(f.family, f);
  }

  const scores: TEFamilyScore[] = [];

  for (const [famName, famInfo] of Object.entries(mapping.families)) {
    const probeIds = famInfo.probe_ids;
    let sum = 0;
    let count = 0;
    for (const pid of probeIds) {
      const b = betas.get(pid);
      if (b !== undefined) {
        sum += b;
        count++;
      }
    }
    if (count === 0) continue;

    const meanBeta = sum / count;
    const meta = familyMeta.get(famName);
    const refRange: [number, number] = (meta as any)?.reference_beta_range ?? [0.55, 0.80];
    const refMid = (refRange[0] + refRange[1]) / 2;
    const delta = meanBeta - refMid;
    const reactivation = meta?.reactivation_score ?? 0.3;
    const hypoDegree = Math.max(0, (refMid - meanBeta) / refMid);
    const risk = Math.round(reactivation * hypoDegree * 1000) / 1000;

    let riskLevel: RiskLevel = 'low';
    if (risk >= 0.4) riskLevel = 'high';
    else if (risk >= 0.25) riskLevel = 'elevated';
    else if (risk >= 0.1) riskLevel = 'moderate';

    const validClasses = ['LINE', 'SINE', 'LTR', 'DNA', 'SVA'] as const;
    const teClass: TEClass = (validClasses as readonly string[]).includes(famInfo.class)
      ? (famInfo.class as TEClass)
      : 'Other';

    scores.push({
      familyId: meta?.id ?? famName,
      displayName: meta?.display_name ?? `${famName} (${famInfo.class})`,
      teClass,
      familyName: famName,
      meanBeta: Math.round(meanBeta * 10000) / 10000,
      nProbes: count,
      nTotal: probeIds.length,
      coverage: Math.round((count / probeIds.length) * 1000) / 1000,
      referenceRange: refRange,
      referenceMidpoint: Math.round(refMid * 1000) / 1000,
      delta: Math.round(delta * 10000) / 10000,
      reactivationScore: reactivation,
      reactivationRisk: risk,
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

  // Sort by reactivation risk descending
  scores.sort((a, b) => b.reactivationRisk - a.reactivationRisk);
  return scores;
}

/**
 * Compute Retro-Age from beta values and clock coefficients.
 */
export function computeRetroAge(
  betas: Map<string, number>,
  clockProbes: ClockProbe[],
  intercept: number,
  chronologicalAge?: number,
): RetroAgeResult | null {
  if (clockProbes.length === 0) return null;

  let sum = intercept;
  let nUsed = 0;
  for (const cp of clockProbes) {
    const b = betas.get(cp.probe_id);
    if (b !== undefined) {
      sum += b * cp.coefficient;
      nUsed++;
    }
  }

  if (nUsed === 0) return null;

  const result: RetroAgeResult = {
    age: Math.round(sum * 100) / 100,
    probesUsed: nUsed,
    probesTotal: clockProbes.length,
    coverage: Math.round((nUsed / clockProbes.length) * 1000) / 1000,
  };

  if (chronologicalAge !== undefined) {
    result.chronologicalAge = chronologicalAge;
    result.acceleration = Math.round((sum - chronologicalAge) * 100) / 100;
  }

  return result;
}

/**
 * Compute summary by TE class.
 */
export function summarizeByClass(
  scores: TEFamilyScore[],
): Record<string, { meanBeta: number; nProbes: number; nFamilies: number }> {
  const byClass: Record<string, { sum: number; count: number; families: number }> = {};

  for (const s of scores) {
    const cls = s.teClass;
    if (!byClass[cls]) byClass[cls] = { sum: 0, count: 0, families: 0 };
    byClass[cls].sum += s.meanBeta * s.nProbes;
    byClass[cls].count += s.nProbes;
    byClass[cls].families++;
  }

  const result: Record<string, { meanBeta: number; nProbes: number; nFamilies: number }> = {};
  for (const [cls, data] of Object.entries(byClass)) {
    result[cls] = {
      meanBeta: Math.round((data.sum / Math.max(1, data.count)) * 10000) / 10000,
      nProbes: data.count,
      nFamilies: data.families,
    };
  }
  return result;
}

/**
 * Build the full analysis result.
 */
export function buildAnalysis(
  betas: Map<string, number>,
  mapping: TEProbeMapping,
  families: TEFamily[],
  platform: string,
  filename: string,
  retroAge: RetroAgeResult | null,
): TEMethylationAnalysis {
  const familyScores = computeFamilyScores(betas, mapping, families);
  const teProbesScored = familyScores.reduce((sum, f) => sum + f.nProbes, 0);

  return {
    platform,
    filename,
    totalInputProbes: betas.size,
    teProbesScored,
    teFraction: Math.round((teProbesScored / Math.max(1, betas.size)) * 10000) / 10000,
    familyScores,
    retroAge,
    summaryByClass: summarizeByClass(familyScores),
  };
}
