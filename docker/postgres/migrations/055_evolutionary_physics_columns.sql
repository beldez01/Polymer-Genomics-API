-- 055_evolutionary_physics_columns.sql
-- Adds 5 evolutionary physics columns to the biophysics backbone.
-- Source: Zoonomia 241-way (phyloP/phastCons), McVicker B-scores,
--         deCODE recombination rate, Roulette mutation rate.

ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS phylop_241way_mean    real,
    ADD COLUMN IF NOT EXISTS phastcons_241way_mean real,
    ADD COLUMN IF NOT EXISTS b_score_mean          real,
    ADD COLUMN IF NOT EXISTS recomb_rate_cmmb      real,
    ADD COLUMN IF NOT EXISTS mutation_rate_mean    real;
