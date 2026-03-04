-- 017_repeats.sql
-- Repeat Elements Layer (RepeatMasker): table, indexes, permissions.
-- Stores genome-wide repeat element annotations (LINE, SINE/Alu, LTR, DNA transposons, satellites).
-- ~5.5M rows for hg38.

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'repeat';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Schema already exists from 013_gene_pathways.sql
CREATE SCHEMA IF NOT EXISTS annotation;
GRANT USAGE ON SCHEMA annotation TO api_reader, ingest_writer;

-- 3. Default privileges for future tables in the schema
ALTER DEFAULT PRIVILEGES IN SCHEMA annotation
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA annotation
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. Repeats table (partitioned, ~5.5M rows for hg38)
--    RepeatMasker genome-wide repeat element annotations.
CREATE TABLE IF NOT EXISTS annotation.repeats (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open internally)
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- Strand
    strand          char(1),                 -- '+' or '-'

    -- Repeat identity
    repeat_name     text NOT NULL,           -- e.g. 'AluSx1', 'L1HS', 'THE1B'
    repeat_class    text NOT NULL,           -- e.g. 'SINE', 'LINE', 'LTR', 'DNA', 'Satellite', 'Simple_repeat'
    repeat_family   text,                    -- e.g. 'Alu', 'L1', 'ERV1', 'hAT-Charlie'

    -- Alignment quality metrics
    sw_score        int,                     -- Smith-Waterman alignment score
    divergence_pct  real,                    -- % divergence from consensus
    deletion_pct    real,                    -- % deletions
    insertion_pct   real,                    -- % insertions

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

-- hg38 partition, sub-partitioned by chromosome hash
CREATE TABLE IF NOT EXISTS annotation.repeats_hg38
    PARTITION OF annotation.repeats
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

-- 4 hash sub-partitions
CREATE TABLE IF NOT EXISTS annotation.repeats_hg38_p0
    PARTITION OF annotation.repeats_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS annotation.repeats_hg38_p1
    PARTITION OF annotation.repeats_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS annotation.repeats_hg38_p2
    PARTITION OF annotation.repeats_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS annotation.repeats_hg38_p3
    PARTITION OF annotation.repeats_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_repeats_range
    ON annotation.repeats USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_repeats_class
    ON annotation.repeats (repeat_class);

CREATE INDEX IF NOT EXISTS idx_repeats_layer_build
    ON annotation.repeats (layer_id, build);

-- 6. Explicit grants
GRANT SELECT ON annotation.repeats TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.repeats TO ingest_writer;
GRANT SELECT ON annotation.repeats_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.repeats_hg38 TO ingest_writer;
GRANT SELECT ON annotation.repeats_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.repeats_hg38_p0 TO ingest_writer;
GRANT SELECT ON annotation.repeats_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.repeats_hg38_p1 TO ingest_writer;
GRANT SELECT ON annotation.repeats_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.repeats_hg38_p2 TO ingest_writer;
GRANT SELECT ON annotation.repeats_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.repeats_hg38_p3 TO ingest_writer;

COMMIT;
