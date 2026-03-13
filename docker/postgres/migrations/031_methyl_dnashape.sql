-- 031_methyl_dnashape.sql
-- Methylation shape perturbation (methyl-DNAshapeR δ-shape tracks)
-- Source: Rao et al. 2018 Epigenetics & Chromatin (methyl-DNAshapeR)
--
-- Adds 4 δ-shape columns to biophysics.sequence_properties.
-- Values are the mean per-bp shape change (methylated − unmethylated)
-- at each 1kb window when ALL CpGs in the window are methylated.
-- This is the methylation shape CAPACITY — a sequence-determined property.
--
-- Evidence class: D (deterministic from pentamer lookup tables)
-- Tier: intrinsic (sequence-determined)

ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS delta_mgw  real,   -- δ minor groove width (Angstrom)
    ADD COLUMN IF NOT EXISTS delta_prot real,   -- δ propeller twist (degrees)
    ADD COLUMN IF NOT EXISTS delta_roll real,   -- δ roll angle (degrees), dominant perturbation ~+6°
    ADD COLUMN IF NOT EXISTS delta_helt real;   -- δ helix twist (degrees)

COMMENT ON COLUMN biophysics.sequence_properties.delta_mgw IS 'Methylation-induced δMGW: mean shape change per bp when all CpGs methylated (methyl-DNAshapeR, Rao 2018)';
COMMENT ON COLUMN biophysics.sequence_properties.delta_prot IS 'Methylation-induced δProT: mean propeller twist change per bp when all CpGs methylated';
COMMENT ON COLUMN biophysics.sequence_properties.delta_roll IS 'Methylation-induced δRoll: mean roll change per bp when all CpGs methylated (~+6° at CpG steps)';
COMMENT ON COLUMN biophysics.sequence_properties.delta_helt IS 'Methylation-induced δHelT: mean helix twist change per bp when all CpGs methylated';
