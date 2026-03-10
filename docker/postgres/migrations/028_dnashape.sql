-- 028_dnashape.sql
-- DNA shape features (DNAshapeR pentamer predictions) at 1kb resolution
-- Source: Zhou et al. 2013 NAR (DNAshapeR), Rohs et al. 2009 Nature
--
-- Adds 4 columns to existing biophysics.sequence_properties table.
-- Values are window-averaged pentamer lookup predictions.
-- Evidence class: D (deterministic from pentamer lookup tables)

ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS mgw_mean  real,   -- minor groove width (Angstrom)
    ADD COLUMN IF NOT EXISTS prot_mean real,   -- propeller twist (degrees)
    ADD COLUMN IF NOT EXISTS roll_mean real,   -- roll angle (degrees)
    ADD COLUMN IF NOT EXISTS helt_mean real;   -- helix twist (degrees)
