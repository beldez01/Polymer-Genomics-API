// src/lib/transposome-types.ts
// Type definitions for the Transposome Explorer feature.

export type TEClass = 'LINE' | 'SINE' | 'LTR' | 'DNA' | 'SVA' | 'Other';

export type SilencingPrimary = 'methylation' | 'h3k9me3' | 'h3k27me3' | 'mixed' | 'none';

export type Lens = 'material' | 'evolution' | 'silencing' | 'reactivation' | 'probe' | 'disease';

export type YAxis = 'cpg_density' | 'gc_content' | 'stacking_dg37' | 'wrapping_energy' | 'ndr_score';

export type ReactivationContext = 'aging' | 'dnmti' | 'tet2_lof' | 'setdb1_lof';

export type EvidenceLevel = 'STRONG' | 'MODERATE' | 'PREDICTED' | 'UNKNOWN';

export interface TEFamily {
  id: string;
  display_name: string;
  class: TEClass;
  family: string;
  divergence_pct: number;
  copy_count: number;
  total_bp: number;
  consensus_length: number;
  cpg_density: number;
  gc_content: number;
  stacking_dg37: number;
  wrapping_energy: number;
  ndr_score: number;
  periodicity_power: number;
  silencing_primary: SilencingPrimary;
  silencing_confidence: number;
  reactivation_score: number;
  reactivation_contexts: ReactivationContext[];
  epic_v2_probes: number;
  retro_age_probes: number;
  has_intact_orfs: boolean;
  is_active: boolean;
  clinically_implicated: boolean;
}

export interface SilencingBreakdown {
  mechanism: string;
  proportion: number;
  color: string;
  evidence: 'curated' | 'heuristic';
}

export interface ChrDensity {
  chr: string;
  density: number;
}

export interface ProbeInfo {
  probe_id: string;
  gene: string | null;
  position: string;
  is_retro_age: boolean;
}

export interface ReactivationDetail {
  context: string;
  evidence: EvidenceLevel;
  notes: string;
}

export interface RepresentativeLocus {
  label: string;
  region: string;
  notes: string;
}

export interface TEFamilyReference {
  citation: string;
  journal: string;
  summary: string;
}

export interface TEFamilyDetail extends TEFamily {
  silencing_breakdown: SilencingBreakdown[];
  chr_density: ChrDensity[];
  top_probes: ProbeInfo[];
  probe_coverage_fraction: number;
  reactivation_detail: ReactivationDetail[];
  viral_mimicry: string | null;
  representative_loci: RepresentativeLocus[];
  references: TEFamilyReference[];
}

// Y-axis display config
export const Y_AXIS_OPTIONS: { value: YAxis; label: string }[] = [
  { value: 'cpg_density', label: 'CpG Density (obs/exp)' },
  { value: 'gc_content', label: 'GC Content (%)' },
  { value: 'stacking_dg37', label: 'Stacking Energy (kcal/mol)' },
  { value: 'wrapping_energy', label: 'Wrapping Energy' },
  { value: 'ndr_score', label: 'NDR Score' },
];

// Lens display config
export const LENS_OPTIONS: { value: Lens; label: string; icon: string; mvp: boolean }[] = [
  { value: 'material', label: 'Material Lens', icon: 'M', mvp: true },
  { value: 'evolution', label: 'Evolution Lens', icon: 'E', mvp: true },
  { value: 'silencing', label: 'Silencing Lens', icon: 'S', mvp: true },
  { value: 'reactivation', label: 'Reactivation Lens', icon: 'R', mvp: true },
  { value: 'probe', label: 'Probe Lens', icon: 'P', mvp: false },
  { value: 'disease', label: 'Disease Lens', icon: 'D', mvp: false },
];

// Silencing color map (unified across lens + inspector)
export const SILENCING_COLORS: Record<SilencingPrimary, string> = {
  methylation: '#4ECDC4',
  h3k9me3: '#F0A500',
  h3k27me3: '#8B5CF6',
  mixed: '#F43F5E',
  none: '#555555',
};
