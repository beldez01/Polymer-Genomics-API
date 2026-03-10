-- 026_epigenetic_clocks.sql
-- Epigenetic Clock Coefficients: probe weights for Horvath, Hannum, PhenoAge,
-- GrimAge, and DunedinPACE clocks. Reference parameter tables (R-class),
-- build-independent, no layer_id FK.

BEGIN;

-- 1. Clock metadata table (one row per clock)
CREATE TABLE IF NOT EXISTS ref.clock_metadata (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clock_name      text NOT NULL UNIQUE,      -- e.g. 'horvath_2013'
    display_name    text NOT NULL,             -- e.g. 'Horvath Multi-tissue Clock'
    n_probes        int NOT NULL,              -- number of CpG probes
    tissue          text NOT NULL,             -- 'pan_tissue', 'blood', etc.
    outcome         text NOT NULL,             -- 'chronological_age', 'phenotypic_age', etc.
    intercept       real,                      -- model intercept
    age_transform   text,                      -- 'anti_log_linear', 'linear', 'none'
    platform        text,                      -- '450k', 'epic_v1', 'epic_v2'
    pmid            text,                      -- PubMed ID
    source_citation text NOT NULL
);

-- 2. Clock coefficients table (one row per probe per clock)
CREATE TABLE IF NOT EXISTS ref.clock_coefficients (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clock_name      text NOT NULL REFERENCES ref.clock_metadata(clock_name),
    probe_id        text NOT NULL,             -- e.g. 'cg16867657'
    coefficient     real NOT NULL,             -- regression coefficient
    source_citation text NOT NULL,
    UNIQUE (clock_name, probe_id)
);

CREATE INDEX IF NOT EXISTS idx_clock_coeff_probe
    ON ref.clock_coefficients (probe_id);

CREATE INDEX IF NOT EXISTS idx_clock_coeff_clock
    ON ref.clock_coefficients (clock_name);

-- 3. Catalog entries
INSERT INTO reference.catalog
    (table_name, display_name, description, source_citation, row_count)
VALUES
    ('clock_metadata', 'Epigenetic Clock Metadata',
     'Clock definitions: Horvath, Hannum, PhenoAge, GrimAge, DunedinPACE',
     'Horvath 2013; Hannum 2013; Levine 2018; Lu 2019; Belsky 2022',
     5),
    ('clock_coefficients', 'Epigenetic Clock Coefficients',
     'Per-probe regression coefficients for epigenetic age clocks',
     'Horvath 2013; Hannum 2013; Levine 2018; Lu 2019; Belsky 2022',
     NULL)
ON CONFLICT (table_name) DO NOTHING;

-- 4. Explicit grants
GRANT SELECT ON ref.clock_metadata TO api_reader;
GRANT SELECT ON ref.clock_coefficients TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ref.clock_metadata TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ref.clock_coefficients TO ingest_writer;

COMMIT;
