-- 029_breakpoints.sql
-- Curated breakpoint and fragile site catalog.
-- Common fragile sites (HumCFS) + recurrent hematologic translocations.
-- Evidence class: K (curated knowledge), Tier: intrinsic.

BEGIN;

-- 1. Create fragility schema
CREATE SCHEMA IF NOT EXISTS fragility;
GRANT USAGE ON SCHEMA fragility TO api_reader, ingest_writer;

ALTER DEFAULT PRIVILEGES IN SCHEMA fragility
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA fragility
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 2. Breakpoints table — partitioned by build, sub-partitioned by chr_id hash
CREATE TABLE IF NOT EXISTS fragility.breakpoints (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    breakpoint_type text NOT NULL,   -- 'fragile_site', 'translocation', 'constitutional'
    name            text,            -- e.g. 'FRA3B', 'BCR-ABL'
    gene_a          text,            -- gene on one side
    gene_b          text,            -- gene on other side (translocations)
    source          text NOT NULL,   -- 'HumCFS', 'COSMIC_SV', 'Mitelman'
    source_id       text,
    PRIMARY KEY (id, build, chr_id)
) PARTITION BY LIST (build);

-- hg38 partition, sub-partitioned by chr_id hash(4)
CREATE TABLE IF NOT EXISTS fragility.breakpoints_hg38
    PARTITION OF fragility.breakpoints FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS fragility.breakpoints_hg38_p0
    PARTITION OF fragility.breakpoints_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS fragility.breakpoints_hg38_p1
    PARTITION OF fragility.breakpoints_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS fragility.breakpoints_hg38_p2
    PARTITION OF fragility.breakpoints_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS fragility.breakpoints_hg38_p3
    PARTITION OF fragility.breakpoints_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- hg37 partition (for future use)
CREATE TABLE IF NOT EXISTS fragility.breakpoints_hg37
    PARTITION OF fragility.breakpoints FOR VALUES IN ('hg37')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS fragility.breakpoints_hg37_p0
    PARTITION OF fragility.breakpoints_hg37
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS fragility.breakpoints_hg37_p1
    PARTITION OF fragility.breakpoints_hg37
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS fragility.breakpoints_hg37_p2
    PARTITION OF fragility.breakpoints_hg37
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS fragility.breakpoints_hg37_p3
    PARTITION OF fragility.breakpoints_hg37
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_breakpoints_coord
    ON fragility.breakpoints USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_breakpoints_type
    ON fragility.breakpoints (breakpoint_type);
CREATE INDEX IF NOT EXISTS idx_breakpoints_name
    ON fragility.breakpoints (name) WHERE name IS NOT NULL;

-- 4. Catalog entry
INSERT INTO reference.catalog
    (table_name, display_name, description, source_citation, row_count)
VALUES
    ('breakpoints', 'Breakpoint / Fragile Site Catalog',
     'Curated common fragile sites (HumCFS) and recurrent hematologic translocation breakpoints',
     'HumCFS (Mrasek 2010); COSMIC Structural Variants; Mitelman Database',
     0)
ON CONFLICT (table_name) DO NOTHING;

-- 5. Explicit grants
GRANT SELECT ON fragility.breakpoints TO api_reader;
GRANT SELECT, INSERT, UPDATE ON fragility.breakpoints TO ingest_writer;

COMMIT;
