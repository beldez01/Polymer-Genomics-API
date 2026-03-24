-- 049_derived_densities.sql
-- Derived density tracks on biophysics.sequence_properties.
-- Source: derived from existing regulatory.ccre, regulatory.histone_peaks,
--         regulatory.chromatin_state tables.

ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS ccre_density real,
    ADD COLUMN IF NOT EXISTS histone_h3k4me3_gm12878 real,
    ADD COLUMN IF NOT EXISTS histone_h3k27me3_gm12878 real,
    ADD COLUMN IF NOT EXISTS histone_h3k4me1_gm12878 real,
    ADD COLUMN IF NOT EXISTS histone_h3k27ac_gm12878 real,
    ADD COLUMN IF NOT EXISTS chromhmm_active_frac_e029 real;

COMMENT ON COLUMN biophysics.sequence_properties.ccre_density IS 'Count of ENCODE cCREs overlapping 1kb window';
COMMENT ON COLUMN biophysics.sequence_properties.histone_h3k4me3_gm12878 IS 'H3K4me3 peak signal in GM12878 (max signalValue per 1kb)';
COMMENT ON COLUMN biophysics.sequence_properties.histone_h3k27me3_gm12878 IS 'H3K27me3 peak signal in GM12878 (max signalValue per 1kb)';
COMMENT ON COLUMN biophysics.sequence_properties.histone_h3k4me1_gm12878 IS 'H3K4me1 peak signal in GM12878 (max signalValue per 1kb)';
COMMENT ON COLUMN biophysics.sequence_properties.histone_h3k27ac_gm12878 IS 'H3K27ac peak signal in GM12878 (max signalValue per 1kb)';
COMMENT ON COLUMN biophysics.sequence_properties.chromhmm_active_frac_e029 IS 'Fraction of 1kb in active ChromHMM states (1-7) for monocyte E029';
