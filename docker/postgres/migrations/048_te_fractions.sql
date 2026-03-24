-- 048_te_fractions.sql
-- TE Family Fractions: derived from RepeatMasker (annotation.repeats).
-- Fraction of each 1kb window occupied by major TE families.

ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS te_line_fraction real,
    ADD COLUMN IF NOT EXISTS te_sine_fraction real,
    ADD COLUMN IF NOT EXISTS te_ltr_fraction real,
    ADD COLUMN IF NOT EXISTS te_dna_fraction real,
    ADD COLUMN IF NOT EXISTS te_simple_fraction real,
    ADD COLUMN IF NOT EXISTS te_total_fraction real;

COMMENT ON COLUMN biophysics.sequence_properties.te_line_fraction IS 'Fraction of window in LINE elements (RepeatMasker)';
COMMENT ON COLUMN biophysics.sequence_properties.te_sine_fraction IS 'Fraction of window in SINE elements (RepeatMasker)';
COMMENT ON COLUMN biophysics.sequence_properties.te_ltr_fraction IS 'Fraction of window in LTR elements (RepeatMasker)';
COMMENT ON COLUMN biophysics.sequence_properties.te_dna_fraction IS 'Fraction of window in DNA transposon elements (RepeatMasker)';
COMMENT ON COLUMN biophysics.sequence_properties.te_simple_fraction IS 'Fraction of window in simple repeats (RepeatMasker)';
COMMENT ON COLUMN biophysics.sequence_properties.te_total_fraction IS 'Total fraction of window in any repeat element (RepeatMasker)';
