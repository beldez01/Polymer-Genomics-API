-- 006_conservation.sql
-- Conservation Scores Layer (PhyloP/PhastCons 100-way): schema, table, indexes, permissions.
-- Stores 1kb-binned mean conservation scores (~3.1M rows for hg38).

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'conservation';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Create conservation schema
CREATE SCHEMA IF NOT EXISTS conservation;
GRANT USAGE ON SCHEMA conservation TO api_reader, ingest_writer;

-- 3. Default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA conservation
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA conservation
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. Conservation scores table (partitioned, ~3.1M rows for hg38)
--    1kb-binned mean PhyloP and PhastCons from UCSC 100-way vertebrate alignment.
CREATE TABLE IF NOT EXISTS conservation.scores (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open, 1kb bins)
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- Conservation scores (mean over 1kb window)
    phylop_mean     real,       -- PhyloP 100-way mean (positive=conserved, negative=fast-evolving)
    phylop_max      real,       -- PhyloP 100-way max in window
    phastcons_mean  real,       -- PhastCons 100-way mean (0-1 probability of conservation)
    phastcons_max   real,       -- PhastCons 100-way max in window

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

-- hg38 partition, sub-partitioned by chromosome hash
CREATE TABLE IF NOT EXISTS conservation.scores_hg38
    PARTITION OF conservation.scores
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

-- 4 hash sub-partitions
CREATE TABLE IF NOT EXISTS conservation.scores_hg38_p0
    PARTITION OF conservation.scores_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS conservation.scores_hg38_p1
    PARTITION OF conservation.scores_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS conservation.scores_hg38_p2
    PARTITION OF conservation.scores_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS conservation.scores_hg38_p3
    PARTITION OF conservation.scores_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_conservation_range
    ON conservation.scores USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_conservation_layer_build
    ON conservation.scores (layer_id, build);

-- 6. Explicit grants
GRANT SELECT ON conservation.scores TO api_reader;
GRANT SELECT, INSERT, UPDATE ON conservation.scores TO ingest_writer;
GRANT SELECT ON conservation.scores_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON conservation.scores_hg38 TO ingest_writer;
GRANT SELECT ON conservation.scores_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON conservation.scores_hg38_p0 TO ingest_writer;
GRANT SELECT ON conservation.scores_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON conservation.scores_hg38_p1 TO ingest_writer;
GRANT SELECT ON conservation.scores_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON conservation.scores_hg38_p2 TO ingest_writer;
GRANT SELECT ON conservation.scores_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON conservation.scores_hg38_p3 TO ingest_writer;

COMMIT;
