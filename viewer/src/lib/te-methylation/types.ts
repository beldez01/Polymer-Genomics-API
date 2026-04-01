// src/lib/te-methylation/types.ts
// Types for the TE/ERV Methylation State Analyzer module.

import type { TEClass } from '../transposome-types';

export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high';

/** Probe-TE family mapping returned by /v1/transposome/probe-te-mapping */
export interface TEProbeMapping {
  platform: string;
  build: string;
  families: Record<
    string,
    {
      class: string;
      repeat_family: string;
      probe_ids: string[];
      divergence_pct: number | null;
      repeat_age: string | null;
    }
  >;
  total_probes: number;
  n_families: number;
}

/** Per-family methylation score (computed client-side) */
export interface TEFamilyScore {
  familyId: string;
  displayName: string;
  teClass: TEClass;
  familyName: string;
  meanBeta: number;
  nProbes: number;
  nTotal: number;
  coverage: number;
  referenceRange: [number, number];
  referenceMidpoint: number;
  delta: number;
  reactivationScore: number;
  reactivationRisk: number;
  riskLevel: RiskLevel;
  biophysics: {
    gc_content: number;
    stacking_dg37: number;
    wrapping_energy: number;
  };
  clinicallyImplicated: boolean;
  reactivationContexts: string[];
}

/** Retro-Age clock result */
export interface RetroAgeResult {
  age: number;
  probesUsed: number;
  probesTotal: number;
  coverage: number;
  chronologicalAge?: number;
  acceleration?: number;
}

/** Full analysis result */
export interface TEMethylationAnalysis {
  platform: string;
  filename: string;
  totalInputProbes: number;
  teProbesScored: number;
  teFraction: number;
  familyScores: TEFamilyScore[];
  retroAge: RetroAgeResult | null;
  summaryByClass: Record<
    string,
    { meanBeta: number; nProbes: number; nFamilies: number }
  >;
}

/** Clock probe coefficient */
export interface ClockProbe {
  probe_id: string;
  coefficient: number;
}
