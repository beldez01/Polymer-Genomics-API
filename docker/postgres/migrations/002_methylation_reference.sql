-- Migration 002: ref.methylation_reference
-- Cell-type reference beta values (Salas 2018 FlowSorted.Blood.EPIC)
-- for fast coordinate-range queries from the viewer.
--
-- This is separate from methylation.atlas_layers (which holds S3/Parquet bulk data).
-- This table is for API region queries: given a genomic window, return all probes
-- with their 6 cell-type reference betas.
--
-- Run:  psql "$DATABASE_URL" < docker/postgres/migrations/002_methylation_reference.sql

CREATE TABLE IF NOT EXISTS ref.methylation_reference (
    id          bigint GENERATED ALWAYS AS IDENTITY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    probe_id    text NOT NULL,
    pos         int NOT NULL,                          -- 0-based (internal)
    coord       int4range GENERATED ALWAYS AS (int4range(pos, pos + 1)) STORED,
    gran        real CHECK (gran  BETWEEN 0 AND 1),
    mono        real CHECK (mono  BETWEEN 0 AND 1),
    nk          real CHECK (nk    BETWEEN 0 AND 1),
    bcell       real CHECK (bcell BETWEEN 0 AND 1),
    cd4t        real CHECK (cd4t  BETWEEN 0 AND 1),
    cd8t        real CHECK (cd8t  BETWEEN 0 AND 1),
    PRIMARY KEY (id, build),
    UNIQUE (layer_id, build, probe_id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS ref.methylation_reference_hg38
    PARTITION OF ref.methylation_reference FOR VALUES IN ('hg38');
CREATE TABLE IF NOT EXISTS ref.methylation_reference_hg37
    PARTITION OF ref.methylation_reference FOR VALUES IN ('hg37');

CREATE INDEX IF NOT EXISTS idx_methref_range_hg38
    ON ref.methylation_reference_hg38 USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_methref_range_hg37
    ON ref.methylation_reference_hg37 USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_methref_probe_id
    ON ref.methylation_reference (probe_id);

-- Grants
GRANT SELECT ON ref.methylation_reference TO api_reader;
GRANT SELECT ON ref.methylation_reference_hg38 TO api_reader;
GRANT SELECT ON ref.methylation_reference_hg37 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ref.methylation_reference TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ref.methylation_reference_hg38 TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ref.methylation_reference_hg37 TO ingest_writer;
