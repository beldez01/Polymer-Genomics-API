-- Phase 2 Layer 1: Methylation perturbation field tracks
-- 10 columns added to biophysics.sequence_properties

ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS cpg_count real,
    ADD COLUMN IF NOT EXISTS cpg_density real,
    ADD COLUMN IF NOT EXISTS cpg_obs_exp real,
    ADD COLUMN IF NOT EXISTS meth_delta_g real,
    ADD COLUMN IF NOT EXISTS meth_delta_tm real,
    ADD COLUMN IF NOT EXISTS meth_sensitivity real,
    ADD COLUMN IF NOT EXISTS methylation_capacity real,
    ADD COLUMN IF NOT EXISTS demethylation_cost real,
    ADD COLUMN IF NOT EXISTS oxidation_depth real,
    ADD COLUMN IF NOT EXISTS taut_relaxed real;

COMMENT ON COLUMN biophysics.sequence_properties.cpg_count IS 'CpG dinucleotide count per window';
COMMENT ON COLUMN biophysics.sequence_properties.cpg_density IS 'CpG fraction (count / window_size)';
COMMENT ON COLUMN biophysics.sequence_properties.cpg_obs_exp IS 'Observed/Expected CpG ratio';
COMMENT ON COLUMN biophysics.sequence_properties.meth_delta_g IS 'Methylation stacking dG37 perturbation (kcal/mol)';
COMMENT ON COLUMN biophysics.sequence_properties.meth_delta_tm IS 'Methylation Tm shift per window';
COMMENT ON COLUMN biophysics.sequence_properties.meth_sensitivity IS 'Contextual energy response to methylation';
COMMENT ON COLUMN biophysics.sequence_properties.methylation_capacity IS 'Total methylation potential (CpG count * 0.5 kcal/mol)';
COMMENT ON COLUMN biophysics.sequence_properties.demethylation_cost IS 'TET oxidation cascade cost (5mC -> 5caC)';
COMMENT ON COLUMN biophysics.sequence_properties.oxidation_depth IS 'Depth of 5mC oxidation cascade';
COMMENT ON COLUMN biophysics.sequence_properties.taut_relaxed IS 'CGI bistability: taut-relaxed transition threshold';
