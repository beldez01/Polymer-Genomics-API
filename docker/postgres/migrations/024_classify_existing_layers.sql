-- 024_classify_existing_layers.sql
-- Backfill epistemic metadata on all existing registry.layers rows

-- Gene models (GENCODE)
UPDATE registry.layers SET
    evidence_class = 'K',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['M','S','K']::polymer_evidence_class[],
    source_count = 3,
    validation_status = 'externally_benchmarked',
    interpretability = 'direct'
WHERE layer_key LIKE 'gencode%';

-- CpG sites
UPDATE registry.layers SET
    evidence_class = 'D',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_benchmarked',
    interpretability = 'direct'
WHERE layer_key = 'cpg_sites';

-- Probes (all platforms)
UPDATE registry.layers SET
    evidence_class = 'D',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'internally_validated',
    interpretability = 'direct'
WHERE layer_key LIKE 'probe_%';

-- Isochores
UPDATE registry.layers SET
    evidence_class = 'D',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    derived_from_classes = ARRAY['D']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'internally_validated',
    interpretability = 'mechanistic'
WHERE layer_key LIKE 'isochore%';

-- Methylation reference (Salas)
UPDATE registry.layers SET
    evidence_class = 'M',
    tier = 'constrained',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key LIKE 'methylation%';

-- GTEx expression
UPDATE registry.layers SET
    evidence_class = 'M',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key LIKE 'gtex%';

-- ENCODE cCREs
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'semi_interpretable'
WHERE layer_key LIKE 'encode_ccre%';

-- PhyloP/PhastCons conservation
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_benchmarked',
    interpretability = 'semi_interpretable',
    context_conditions = '{"alignment": "100way_vertebrate", "method": "phyloFit_neutral_model"}'::jsonb
WHERE layer_key LIKE 'phylop%';

-- Gene costs (Akashi-Gojobori)
UPDATE registry.layers SET
    evidence_class = 'D',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['R','M']::polymer_evidence_class[],
    source_count = 2,
    validation_status = 'externally_validated',
    interpretability = 'mechanistic'
WHERE layer_key LIKE 'gene_cost%';

-- Gene constraint (gnomAD pLI/LOEUF)
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_benchmarked',
    interpretability = 'semi_interpretable'
WHERE layer_key LIKE 'gene_constraint%';

-- Protein abundance (PaxDb)
UPDATE registry.layers SET
    evidence_class = 'M',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key LIKE 'protein_abundance%';

-- Protein turnover (SILAC)
UPDATE registry.layers SET
    evidence_class = 'M',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key LIKE 'protein_turnover%';

-- Protein properties
UPDATE registry.layers SET
    evidence_class = 'D',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['M','R']::polymer_evidence_class[],
    source_count = 2,
    validation_status = 'externally_validated',
    interpretability = 'mechanistic'
WHERE layer_key LIKE 'protein_properties%';

-- Protein evolution (dN/dS)
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'semi_interpretable'
WHERE layer_key LIKE 'protein_evolution%';

-- Protein atlas (HPA)
UPDATE registry.layers SET
    evidence_class = 'M',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key LIKE 'protein_atlas%';

-- Chromatin state (ChromHMM)
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'sample_specific',
    is_composite = true,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'semi_interpretable',
    context_conditions = '{"model": "ChromHMM_15state", "marks": ["H3K4me3","H3K27ac","H3K27me3","H3K9me3","H3K36me3"]}'::jsonb
WHERE layer_key LIKE 'chromatin_state%';

-- Repeats (RepeatMasker)
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'semi_interpretable'
WHERE layer_key LIKE 'repeat%';

-- Biophysics tracks (L0)
UPDATE registry.layers SET
    evidence_class = 'D',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    derived_from_classes = ARRAY['R']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_benchmarked',
    interpretability = 'mechanistic',
    context_conditions = '{"temperature": "37C", "salt": "1M_NaCl", "species": "human", "window_size": "1kb"}'::jsonb
WHERE layer_key LIKE 'sequence_biophysics%' OR layer_key LIKE 'biophysics%';

-- Histone marks (ENCODE)
UPDATE registry.layers SET
    evidence_class = 'M',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'sample_specific',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key LIKE 'histone%';

-- GWAS catalog
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'mixed',
    equilibrium_regime = 'mixed',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'semi_interpretable'
WHERE layer_key LIKE 'gwas%';

-- Reactome pathways
UPDATE registry.layers SET
    evidence_class = 'K',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key LIKE 'reactome%';

-- MSigDB Hallmark gene sets
UPDATE registry.layers SET
    evidence_class = 'K',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key LIKE 'msigdb%';

-- Gene profiles
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'mixed',
    equilibrium_regime = 'mixed',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['M','D','S']::polymer_evidence_class[],
    source_count = 3,
    validation_status = 'unvalidated',
    interpretability = 'semi_interpretable'
WHERE layer_key LIKE 'gene_profile%';
