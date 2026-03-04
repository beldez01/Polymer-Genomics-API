-- 005_regulatory.sql
-- Regulatory Elements Layer (ENCODE cCREs V4): schema, table, indexes, permissions.

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'regulatory';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Create regulatory schema
CREATE SCHEMA IF NOT EXISTS regulatory;
GRANT USAGE ON SCHEMA regulatory TO api_reader, ingest_writer;

-- 3. Default privileges for future tables in the schema
ALTER DEFAULT PRIVILEGES IN SCHEMA regulatory
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA regulatory
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. cCRE table (partitioned by build + chr_id, ~926K rows for hg38)
--    ENCODE candidate cis-Regulatory Elements V4.
CREATE TABLE IF NOT EXISTS regulatory.ccre (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open internally)
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- cCRE identity
    accession       text NOT NULL,          -- EH38E1310153
    score           smallint,               -- ENCODE signal score (0-1000)

    -- Classification
    encode_label    text NOT NULL,          -- PLS, pELS, dELS, CTCF-only, DNase-H3K4me3
    ccre_class      text,                   -- full class string (e.g. "PLS,CTCF-bound")
    z_score         real,                   -- signal strength z-score
    description     text,                   -- human-readable description

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

-- hg38 partition, sub-partitioned by chromosome
CREATE TABLE IF NOT EXISTS regulatory.ccre_hg38
    PARTITION OF regulatory.ccre
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

-- Create 4 hash sub-partitions (sufficient for ~926K rows)
CREATE TABLE IF NOT EXISTS regulatory.ccre_hg38_p0
    PARTITION OF regulatory.ccre_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS regulatory.ccre_hg38_p1
    PARTITION OF regulatory.ccre_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS regulatory.ccre_hg38_p2
    PARTITION OF regulatory.ccre_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS regulatory.ccre_hg38_p3
    PARTITION OF regulatory.ccre_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 5. Indexes (on parent; auto-propagated to partitions)
CREATE INDEX IF NOT EXISTS idx_ccre_range
    ON regulatory.ccre USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_ccre_accession
    ON regulatory.ccre (accession);

CREATE INDEX IF NOT EXISTS idx_ccre_label
    ON regulatory.ccre (encode_label);

CREATE INDEX IF NOT EXISTS idx_ccre_layer_build
    ON regulatory.ccre (layer_id, build);

-- 6. Explicit grants
GRANT SELECT ON regulatory.ccre TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.ccre TO ingest_writer;
GRANT SELECT ON regulatory.ccre_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.ccre_hg38 TO ingest_writer;
GRANT SELECT ON regulatory.ccre_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.ccre_hg38_p0 TO ingest_writer;
GRANT SELECT ON regulatory.ccre_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.ccre_hg38_p1 TO ingest_writer;
GRANT SELECT ON regulatory.ccre_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.ccre_hg38_p2 TO ingest_writer;
GRANT SELECT ON regulatory.ccre_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.ccre_hg38_p3 TO ingest_writer;

COMMIT;
