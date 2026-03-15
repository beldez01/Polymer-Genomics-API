-- 036_melting_mutation_columns.sql
-- Phase 1C: Melting domain profiles + per-position mutation dG tracks

-- Melting domain columns (Poland-Scheraga stitch profiles)
ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS melting_cooperativity real,
    ADD COLUMN IF NOT EXISTS bubble_propensity real,
    ADD COLUMN IF NOT EXISTS melting_width real;

-- Per-position mutation dG columns (4 SBS-type tracks)
-- Each is the mean |delta-delta-G| for that SBS class across positions in the 1kb window
ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS sbs_c_to_a_ddg real,
    ADD COLUMN IF NOT EXISTS sbs_c_to_g_ddg real,
    ADD COLUMN IF NOT EXISTS sbs_c_to_t_ddg real,
    ADD COLUMN IF NOT EXISTS sbs_t_to_a_ddg real;
