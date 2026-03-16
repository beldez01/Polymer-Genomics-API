-- Phase 1 extended biophysics tracks
-- 6 columns added to biophysics.sequence_properties

ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS deformability real,
    ADD COLUMN IF NOT EXISTS g4_density real,
    ADD COLUMN IF NOT EXISTS g4_max_score real,
    ADD COLUMN IF NOT EXISTS kmer_complexity real,
    ADD COLUMN IF NOT EXISTS dinucleotide_entropy real,
    ADD COLUMN IF NOT EXISTS dominant_period real;

COMMENT ON COLUMN biophysics.sequence_properties.deformability IS 'DNA deformability/flexibility score';
COMMENT ON COLUMN biophysics.sequence_properties.g4_density IS 'G-quadruplex density per window';
COMMENT ON COLUMN biophysics.sequence_properties.g4_max_score IS 'G-quadruplex maximum score per window';
COMMENT ON COLUMN biophysics.sequence_properties.kmer_complexity IS 'k-mer / linguistic complexity';
COMMENT ON COLUMN biophysics.sequence_properties.dinucleotide_entropy IS 'Shannon entropy of dinucleotide frequencies';
COMMENT ON COLUMN biophysics.sequence_properties.dominant_period IS 'Periodicity periodogram dominant frequency';
