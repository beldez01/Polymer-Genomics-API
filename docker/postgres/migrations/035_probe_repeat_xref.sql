-- 035_probe_repeat_xref.sql
-- Probe-repeat cross-reference table: spatial join of methylation probes
-- with RepeatMasker repeat elements. ~250K rows (probes overlapping repeats).

BEGIN;

-- 1. Create schema if needed
CREATE SCHEMA IF NOT EXISTS probe;
GRANT USAGE ON SCHEMA probe TO api_reader, ingest_writer;

ALTER DEFAULT PRIVILEGES IN SCHEMA probe
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA probe
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 2. Cross-reference table
CREATE TABLE IF NOT EXISTS probe.repeat_xref (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    probe_id        text NOT NULL,
    platform        text NOT NULL,            -- 'epic_v2', 'epic_v1', '450k'
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    pos             int NOT NULL,             -- probe position (0-based)

    -- Repeat annotation (from best-scoring overlap)
    repeat_class    text NOT NULL,
    repeat_family   text,
    repeat_name     text NOT NULL,
    repeat_age      repeat_age_class,         -- from D1 enrichment
    divergence_pct  real,

    UNIQUE (platform, build, probe_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_probe_repeat_xref_class
    ON probe.repeat_xref (repeat_class);

CREATE INDEX IF NOT EXISTS idx_probe_repeat_xref_age
    ON probe.repeat_xref (repeat_age);

CREATE INDEX IF NOT EXISTS idx_probe_repeat_xref_probe
    ON probe.repeat_xref (probe_id);

CREATE INDEX IF NOT EXISTS idx_probe_repeat_xref_platform
    ON probe.repeat_xref (platform, build);

-- 4. Explicit grants
GRANT SELECT ON probe.repeat_xref TO api_reader;
GRANT SELECT, INSERT, UPDATE ON probe.repeat_xref TO ingest_writer;

COMMIT;
