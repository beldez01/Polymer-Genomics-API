/**
 * Polymer-3 data sources mock — 50 layers across the platform.
 * Mirrors the live /data-sources surface shape: id, version, source,
 * license, evidence class, count.
 */

export type EvidenceClass = 'M' | 'K' | 'D' | 'S' | 'H';
export type LayerGroup =
  | 'Reference'
  | 'Biophysics'
  | 'CpG / methylation'
  | 'Structural'
  | 'Repeats'
  | 'Variants'
  | 'Clinical'
  | 'Compute';

export interface DataLayer {
  id: string;
  name: string;
  group: LayerGroup;
  description: string;
  version: string;
  source: string;
  license: string;
  evidence: EvidenceClass;
  count: string;          // human-readable
  build: 'hg38' | 'hg38+hg37';
}

export const LAYERS: DataLayer[] = [
  // Reference
  { id: 'gencode_v44',       name: 'GENCODE v44 genes',       group: 'Reference',         description: 'Comprehensive gene annotation — transcripts, exons, CDS, UTRs.',     version: 'v44 · 2023-10',  source: 'GENCODE',           license: 'CC BY 4.0',      evidence: 'K', count: '63,086 transcripts',  build: 'hg38+hg37' },
  { id: 'refseq_v224',       name: 'RefSeq v224',             group: 'Reference',         description: 'NCBI reference annotations · clinical-grade.',                       version: 'v224 · 2024-08', source: 'NCBI',              license: 'Public domain',  evidence: 'K', count: '54,212 transcripts',  build: 'hg38+hg37' },
  { id: 'gtex_v8',           name: 'GTEx v8 expression',      group: 'Reference',         description: 'Cross-tissue gene expression for 54 tissues.',                       version: 'v8 · 2019',      source: 'GTEx',              license: 'dbGaP DUC',      evidence: 'M', count: '54 tissues',          build: 'hg38' },
  { id: 'gnomad_v4',         name: 'gnomAD v4 constraint',    group: 'Reference',         description: 'Loss-of-function intolerance metrics — pLI, LOEUF, oe-syn.',         version: 'v4 · 2024',      source: 'gnomAD',            license: 'CC BY 4.0',      evidence: 'D', count: '730K exomes',         build: 'hg38' },

  // Biophysics
  { id: 'stacking_dg37',     name: 'Stacking ΔG₃₇',           group: 'Biophysics',        description: 'Nearest-neighbor stacking free energy at 37 °C, base-pair resolution.', version: 'v3.0 · 2026-02', source: 'SantaLucia 2004 + curated', license: 'CC BY 4.0', evidence: 'D', count: '3.20 Gb @ 1 bp',       build: 'hg38+hg37' },
  { id: 'melting_tm',        name: 'Melting temperature',     group: 'Biophysics',        description: 'Predicted Tm at 50 mM Na⁺, 1 kb sliding window.',                    version: 'v3.0 · 2026-02', source: 'SantaLucia',        license: 'CC BY 4.0',      evidence: 'D', count: '3.20 Gb @ 1 kb',       build: 'hg38+hg37' },
  { id: 'curvature',         name: 'Intrinsic curvature',     group: 'Biophysics',        description: 'Calladine-style curvature predictions, 30 bp window.',               version: 'v2.4 · 2026-01', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'D', count: '3.20 Gb @ 1 bp',       build: 'hg38' },
  { id: 'groove_width',      name: 'Major/minor groove',      group: 'Biophysics',        description: 'Major and minor groove width + depth from DNA shape models.',        version: 'v2.4 · 2026-01', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'D', count: '3.20 Gb @ 1 bp',       build: 'hg38' },
  { id: 'a_form_prop',       name: 'A-form propensity',       group: 'Biophysics',        description: 'Sequence-encoded propensity to adopt A-form duplex.',                version: 'v2.4 · 2026-01', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'D', count: '3.20 Gb @ 1 bp',       build: 'hg38' },
  { id: 'z_form_prop',       name: 'Z-form propensity',       group: 'Biophysics',        description: 'Z-DNA propensity tied to alternating purine-pyrimidine.',            version: 'v2.4 · 2026-01', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'D', count: '3.20 Gb @ 1 bp',       build: 'hg38' },
  { id: 'extinction_e260',   name: 'Molar extinction (E₂₆₀)', group: 'Biophysics',        description: 'Per-base ε₂₆₀ for quantification calculations.',                     version: 'v1.0 · 2026-02', source: 'Cantor & Warshaw',  license: 'CC BY 4.0',      evidence: 'D', count: '3.20 Gb @ 1 bp',       build: 'hg38+hg37' },
  { id: 'gene_costs_v1',     name: 'Biosynthetic cost',       group: 'Biophysics',        description: 'Per-amino-acid ATP-equivalent biosynthetic cost rolled up per gene.', version: 'v1.0 · 2025-11', source: 'Polymer + Akashi',  license: 'CC BY 4.0',      evidence: 'D', count: '19,427 genes',         build: 'hg38' },

  // CpG / methylation
  { id: 'cpg_sites',         name: 'CpG sites',               group: 'CpG / methylation', description: 'All CpG dinucleotide positions genome-wide.',                        version: '2024-08',        source: 'GRCh38 / GRCh37',   license: 'Public domain',  evidence: 'M', count: '29,439,827',           build: 'hg38+hg37' },
  { id: 'cpg_islands',       name: 'CpG islands',             group: 'CpG / methylation', description: 'Gardiner-Garden + Frommer CpG island calls.',                        version: '2024-08',        source: 'UCSC',              license: 'Public domain',  evidence: 'K', count: '235,847',              build: 'hg38+hg37' },
  { id: 'probe_epic_v2',     name: 'EPIC v2 probes',          group: 'CpG / methylation', description: 'Illumina EPIC v2 array manifest with probe context.',                version: 'v1.0 · 2023',    source: 'Illumina',          license: 'Illumina',       evidence: 'M', count: '937,690',              build: 'hg38' },
  { id: 'probe_epic_v1',     name: 'EPIC v1 probes',          group: 'CpG / methylation', description: 'Illumina EPIC v1 array manifest.',                                   version: 'v1.0 · 2016',    source: 'Illumina',          license: 'Illumina',       evidence: 'M', count: '865,918',              build: 'hg38+hg37' },
  { id: 'probe_450k',        name: '450K probes',             group: 'CpG / methylation', description: 'Illumina HumanMethylation450 BeadChip.',                             version: 'v1.0 · 2011',    source: 'Illumina',          license: 'Illumina',       evidence: 'M', count: '485,577',              build: 'hg38+hg37' },
  { id: 'methylation_atlas', name: 'Methylation atlas',       group: 'CpG / methylation', description: 'Reference WGBS methylation across 12 tissues.',                      version: 'v2.1 · 2024',    source: 'NIH Roadmap',       license: 'CC BY 4.0',      evidence: 'M', count: '12 tissues',           build: 'hg38' },
  { id: 'clocks_v1',         name: 'Epigenetic clocks',       group: 'CpG / methylation', description: '6 clocks: Horvath, Hannum, PhenoAge, GrimAge, Retro-Age, DunedinPACE.', version: 'v1.2 · 2026-01', source: 'Curated · Polymer', license: 'CC BY-SA 4.0',   evidence: 'D', count: '6 clocks · 2,488 probes', build: 'hg38' },

  // Structural
  { id: 'isochores',         name: 'Isochores',               group: 'Structural',        description: 'L1/L2/H1/H2/H3 isochore class per 100 kb bin.',                     version: 'v1.4 · 2025-09', source: 'Polymer Genomics',  license: 'CC BY-SA 4.0',   evidence: 'D', count: '34,000 bins',          build: 'hg38' },
  { id: 'tads_encode',       name: 'TAD domains',             group: 'Structural',        description: 'TAD calls across 108 ENCODE cell types.',                            version: '2024',          source: 'ENCODE',            license: 'CC BY 4.0',      evidence: 'M', count: '347,914 TADs',         build: 'hg38' },
  { id: 'histone_h3k4me3',   name: 'H3K4me3',                 group: 'Structural',        description: 'Active promoter mark, ENCODE consolidated.',                         version: 'v3 · 2024',     source: 'ENCODE',            license: 'CC BY 4.0',      evidence: 'M', count: '78 cell types',        build: 'hg38' },
  { id: 'histone_h3k27ac',   name: 'H3K27ac',                 group: 'Structural',        description: 'Active enhancer mark.',                                              version: 'v3 · 2024',     source: 'ENCODE',            license: 'CC BY 4.0',      evidence: 'M', count: '92 cell types',        build: 'hg38' },
  { id: 'histone_h3k27me3',  name: 'H3K27me3',                group: 'Structural',        description: 'Polycomb repressive mark.',                                          version: 'v3 · 2024',     source: 'ENCODE',            license: 'CC BY 4.0',      evidence: 'M', count: '64 cell types',        build: 'hg38' },
  { id: 'g4_predicted',      name: 'G-quadruplex predictions',group: 'Structural',        description: 'pqsfinder G4 motif predictions, per-strand.',                        version: 'v1.0 · 2024',   source: 'pqsfinder',         license: 'CC BY 4.0',      evidence: 'D', count: '739,201 G4s',          build: 'hg38' },
  { id: 'rloop_predicted',   name: 'R-loop forming sequences',group: 'Structural',        description: 'QmRLFS R-loop prediction.',                                          version: 'v1.0 · 2024',   source: 'QmRLFS',            license: 'CC BY 4.0',      evidence: 'D', count: '212,488 RLFS',         build: 'hg38' },

  // Repeats
  { id: 'repeatmasker_v419', name: 'RepeatMasker v4.1.9',     group: 'Repeats',           description: 'All annotated repeats (SINE/LINE/LTR/DNA/Satellite/Simple).',         version: 'v4.1.9 · 2024',  source: 'Smit, Hubley & Green', license: 'Open',         evidence: 'K', count: '5,632,191',            build: 'hg38+hg37' },
  { id: 'sine_alu',          name: 'SINE / Alu',              group: 'Repeats',           description: 'Alu family subset with subfamily call (AluY/AluS/AluJ).',            version: '2024',          source: 'RepeatMasker',      license: 'Open',           evidence: 'K', count: '1,094,000 Alus',       build: 'hg38' },
  { id: 'line_l1',           name: 'LINE-1',                  group: 'Repeats',           description: 'L1 family with subfamily age (L1HS, L1PA2-7, L2).',                  version: '2024',          source: 'RepeatMasker',      license: 'Open',           evidence: 'K', count: '569,000 L1s',          build: 'hg38' },
  { id: 'ltr_erv',           name: 'LTR / ERV',               group: 'Repeats',           description: 'Endogenous retroviruses with subfamily annotation.',                 version: '2024',          source: 'RepeatMasker + curated', license: 'Open',     evidence: 'K', count: '567,000 ERVs',         build: 'hg38' },
  { id: 'herv_subfamilies',  name: 'HERV subfamily curation', group: 'Repeats',           description: 'Manual subfamily refinement (HERV-K/H/W/E/L).',                      version: 'v1.2 · 2025-08', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'K', count: '6,464 ERVs',           build: 'hg38' },
  { id: 'te_age',            name: 'TE age (MYA)',            group: 'Repeats',           description: 'Per-element evolutionary age from divergence.',                      version: 'v1.0 · 2025-10', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'D', count: '5.6M elements',        build: 'hg38' },
  { id: 'te_awakening',      name: 'TE awakening score',      group: 'Repeats',           description: 'Reactivation propensity score per TE family.',                       version: 'v1.0 · 2026-02', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'S', count: '17 families',          build: 'hg38' },

  // Variants
  { id: 'clinvar',           name: 'ClinVar',                 group: 'Variants',          description: 'Clinically reported variants with assertions.',                       version: '2024-09',       source: 'NCBI',              license: 'Public domain',  evidence: 'K', count: '2,847,212',            build: 'hg38+hg37' },
  { id: 'gwas_catalog',      name: 'GWAS Catalog',            group: 'Variants',          description: 'EBI GWAS Catalog SNP-trait associations.',                           version: '2024-08',       source: 'EBI',               license: 'CC0',            evidence: 'M', count: '658,124',              build: 'hg38' },
  { id: 'dbsnp_b156',        name: 'dbSNP build 156',         group: 'Variants',          description: 'Reference SNPs for variant annotation.',                             version: 'b156 · 2024',   source: 'NCBI',              license: 'Public domain',  evidence: 'K', count: '~1 B',                 build: 'hg38+hg37' },

  // Clinical
  { id: 'imgt_hla',          name: 'IMGT/HLA',                group: 'Clinical',          description: 'Curated HLA allele sequences (32,867 alleles across 6 loci).',       version: 'v3.55 · 2024',  source: 'IMGT/HLA',          license: 'CC BY-ND 3.0',   evidence: 'K', count: '32,867 alleles',       build: 'hg38' },
  { id: 'hla_ncds',          name: 'HLA non-coding divergence',group: 'Clinical',         description: 'Per-allele NCDS score derived from non-coding biophysics.',           version: 'v1.0 · 2026-03', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'D', count: '32,867 alleles',       build: 'hg38' },
  { id: 'tcga',              name: 'TCGA',                    group: 'Clinical',          description: 'Cancer methylation + RNA-seq, planned ingestion.',                   version: 'Pending',       source: 'TCGA',              license: 'dbGaP DUC',      evidence: 'M', count: '11,000 samples',       build: 'hg38' },

  // Compute
  { id: 'biophysics_compute',name: 'Contextual biophysics',   group: 'Compute',           description: '8 property groups computable on-demand for any region ≤1 Mb.',       version: 'v3.0 · 2026-02', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'D', count: '8 property groups',    build: 'hg38+hg37' },
  { id: 'evaluate_compute',  name: 'Sequence evaluator',      group: 'Compute',           description: 'Physics linter with 13 flag codes for ≤100 kb sequences.',           version: 'v2.4 · 2026-01', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'D', count: '13 flag codes',        build: '—' as any },
  { id: 'aggregation',       name: 'Aggregation service',     group: 'Compute',           description: 'Pre-binned layer counts, 1 kb–10 Mb resolution.',                    version: 'v1.0 · 2026-01', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'D', count: 'all layers',           build: 'hg38+hg37' },
  { id: 'clocks_predict',    name: 'Clock prediction',        group: 'Compute',           description: 'Apply DNAm clock coefficients to beta matrices.',                    version: 'v1.0 · 2026-02', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'D', count: '6 clocks',             build: 'hg38' },
  { id: 'exp17_recomb',      name: 'Exp 17 · recombination',  group: 'Compute',           description: 'Per-region crossover-hotspot score (AUROC 0.827).',                  version: 'v1.0 · 2026-04', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'S', count: '1 score per region',   build: 'hg38' },
  { id: 'exp03_te',          name: 'Exp 03 · TE silencing',    group: 'Compute',           description: 'Per-TE silencing score with biophysical feature attribution.',      version: 'v1.0 · 2026-02', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'S', count: '5.6M scores',          build: 'hg38' },
  { id: 'exp22_age',         name: 'Exp 22 · CpG erosion',    group: 'Compute',           description: 'TE-age estimate from CpG erosion chronometer.',                      version: 'v1.0 · 2026-05', source: 'Polymer Genomics',  license: 'Polymer EULA',   evidence: 'S', count: '17 TE families',       build: 'hg38' },
];

export const LAYER_GROUPS: LayerGroup[] = [
  'Reference', 'Biophysics', 'CpG / methylation', 'Structural', 'Repeats', 'Variants', 'Clinical', 'Compute',
];

export const EVIDENCE_LABELS: Record<EvidenceClass, { label: string; description: string }> = {
  M: { label: 'Measured',     description: 'Direct experimental measurement.' },
  K: { label: 'Curated',      description: 'Manually curated annotation.' },
  D: { label: 'Derived',      description: 'Computed from underlying measurements or models.' },
  S: { label: 'Statistical',  description: 'Statistical prediction with uncertainty.' },
  H: { label: 'Hypothetical', description: 'Hypothesis or model-only assertion.' },
};
