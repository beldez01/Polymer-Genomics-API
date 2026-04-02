-- 058_te_age_columns.sql
-- Adds TE insertion age columns to annotation.repeats.
-- Derived from existing divergence_pct using neutral substitution rate.

ALTER TABLE annotation.repeats
    ADD COLUMN IF NOT EXISTS estimated_age_mya real,
    ADD COLUMN IF NOT EXISTS age_class text;
