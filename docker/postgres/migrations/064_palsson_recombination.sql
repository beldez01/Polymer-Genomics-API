-- 064_palsson_recombination.sql
-- Add Palsson et al. 2025 recombination columns + oNCO events table
-- Source: Nature 639:700-707 (2025), DOI: 10.1038/s41586-024-08450-5

-- New columns on biophysics.sequence_properties (1 Mb rates broadcast to 1 kb bins)
ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS co_rate_cmmb real,      -- Crossover rate (Halldorsson 2019), cM/Mb
    ADD COLUMN IF NOT EXISTS nco_rate real,           -- NCO rate (Palsson 2025), NCOs/Mb/offspring
    ADD COLUMN IF NOT EXISTS dsb_rate real,           -- DSB rate, DSBs/Mb/meiosis
    ADD COLUMN IF NOT EXISTS mat_co_rate real,        -- Maternal crossover rate
    ADD COLUMN IF NOT EXISTS mat_nco_rate real,       -- Maternal NCO rate
    ADD COLUMN IF NOT EXISTS pat_co_rate real,        -- Paternal crossover rate
    ADD COLUMN IF NOT EXISTS pat_nco_rate real;       -- Paternal NCO rate

-- Also populate recomb_rate_cmmb (from Tier 10 migration) with average CO rate
-- UPDATE biophysics.sequence_properties SET recomb_rate_cmmb = (mat_co_rate + pat_co_rate) / 2
--   WHERE recomb_rate_cmmb IS NULL AND co_rate_cmmb IS NOT NULL;

-- Individual oNCO events table
CREATE SCHEMA IF NOT EXISTS recombination;

CREATE TABLE IF NOT EXISTS recombination.onco_events (
    id serial PRIMARY KEY,
    build text NOT NULL DEFAULT 'hg38',
    chr_id smallint NOT NULL,
    start_pos int NOT NULL,       -- 0-based half-open (internal)
    end_pos int NOT NULL,         -- 0-based half-open (internal)
    parent_type char(1) NOT NULL, -- P or M
    event_id text NOT NULL,
    n_mpps smallint,
    n_gc_mpps smallint,
    event_width int GENERATED ALWAYS AS (end_pos - start_pos) STORED,
    UNIQUE (build, event_id)
);

CREATE INDEX IF NOT EXISTS idx_onco_events_pos
    ON recombination.onco_events (build, chr_id, start_pos, end_pos);

CREATE INDEX IF NOT EXISTS idx_onco_events_parent
    ON recombination.onco_events (build, parent_type);
