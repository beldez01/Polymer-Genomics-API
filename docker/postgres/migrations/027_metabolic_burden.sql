-- 027_metabolic_burden.sql
-- Metabolic Burden: adds tissue-specific metabolic burden columns to
-- bioenergetics.gene_costs. Burden = biosynthetic_cost × expression × turnover.

BEGIN;

-- 1. Add summary burden columns
ALTER TABLE bioenergetics.gene_costs
    ADD COLUMN IF NOT EXISTS half_life_hours real,          -- protein half-life (hours), from SILAC/pulsed SILAC
    ADD COLUMN IF NOT EXISTS turnover_rate   real,          -- ln(2) / half_life_hours
    ADD COLUMN IF NOT EXISTS burden_total    real;          -- summary: ecpa × protein_length × mean_tpm × turnover_rate

-- 2. Add per-tissue burden columns (cost × tpm × turnover, ATP·TPM/hour)
ALTER TABLE bioenergetics.gene_costs
    ADD COLUMN IF NOT EXISTS burden_brain           real,
    ADD COLUMN IF NOT EXISTS burden_heart           real,
    ADD COLUMN IF NOT EXISTS burden_kidney          real,
    ADD COLUMN IF NOT EXISTS burden_liver           real,
    ADD COLUMN IF NOT EXISTS burden_muscle          real,
    ADD COLUMN IF NOT EXISTS burden_adipose         real,
    ADD COLUMN IF NOT EXISTS burden_whole_blood     real,
    ADD COLUMN IF NOT EXISTS burden_lung            real,
    ADD COLUMN IF NOT EXISTS burden_pancreas        real,
    ADD COLUMN IF NOT EXISTS burden_stomach         real,
    ADD COLUMN IF NOT EXISTS burden_small_intestine real,
    ADD COLUMN IF NOT EXISTS burden_skin            real,
    ADD COLUMN IF NOT EXISTS burden_testis          real,
    ADD COLUMN IF NOT EXISTS burden_ovary           real,
    ADD COLUMN IF NOT EXISTS burden_thyroid         real,
    ADD COLUMN IF NOT EXISTS burden_spleen          real,
    ADD COLUMN IF NOT EXISTS burden_nerve           real,
    ADD COLUMN IF NOT EXISTS burden_artery          real,
    ADD COLUMN IF NOT EXISTS burden_colon           real,
    ADD COLUMN IF NOT EXISTS burden_esophagus       real,
    ADD COLUMN IF NOT EXISTS burden_prostate        real,
    ADD COLUMN IF NOT EXISTS burden_pituitary       real,
    ADD COLUMN IF NOT EXISTS burden_breast          real,
    ADD COLUMN IF NOT EXISTS burden_uterus          real;

COMMIT;
