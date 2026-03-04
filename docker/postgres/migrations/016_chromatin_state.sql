-- 016_chromatin_state.sql
-- Chromatin State Layer (ChromHMM 15-state model): table, indexes, permissions.
-- Stores ChromHMM segmentation from Roadmap Epigenomics (Nature 2015).
-- ~300K intervals per epigenome, multiple epigenomes.

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'chromatin_state';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Schema already exists from 005_regulatory.sql
CREATE SCHEMA IF NOT EXISTS regulatory;
GRANT USAGE ON SCHEMA regulatory TO api_reader, ingest_writer;

-- 3. Default privileges for future tables in the schema
ALTER DEFAULT PRIVILEGES IN SCHEMA regulatory
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA regulatory
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. Chromatin state table (partitioned, ~300K intervals x multiple epigenomes)
--    ChromHMM 15-state model from Roadmap Epigenomics (Kundaje et al. Nature 2015).
CREATE TABLE IF NOT EXISTS regulatory.chromatin_state (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open internally)
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- Epigenome identity
    epigenome_id    text NOT NULL,           -- e.g. 'E001', 'E003'
    epigenome_name  text,                    -- e.g. 'ES-I3', 'H1 Cell Line'

    -- Chromatin state (1-15)
    state_id        smallint NOT NULL,       -- ChromHMM state number (1-15)
    state_name      text NOT NULL,           -- e.g. 'TssA', 'TssAFlnk', 'TxFlnk', 'Tx', 'TxWk',
                                             --       'EnhG', 'Enh', 'ZNF/Rpts', 'Het', 'TssBiv',
                                             --       'BivFlnk', 'EnhBiv', 'ReprPC', 'ReprPCWk', 'Quies'

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

-- hg38 partition, sub-partitioned by chromosome hash
CREATE TABLE IF NOT EXISTS regulatory.chromatin_state_hg38
    PARTITION OF regulatory.chromatin_state
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

-- 4 hash sub-partitions
CREATE TABLE IF NOT EXISTS regulatory.chromatin_state_hg38_p0
    PARTITION OF regulatory.chromatin_state_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS regulatory.chromatin_state_hg38_p1
    PARTITION OF regulatory.chromatin_state_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS regulatory.chromatin_state_hg38_p2
    PARTITION OF regulatory.chromatin_state_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS regulatory.chromatin_state_hg38_p3
    PARTITION OF regulatory.chromatin_state_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_chromatin_state_range
    ON regulatory.chromatin_state USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_chromatin_state_epigenome
    ON regulatory.chromatin_state (epigenome_id);

CREATE INDEX IF NOT EXISTS idx_chromatin_state_layer_build
    ON regulatory.chromatin_state (layer_id, build);

-- 6. Explicit grants
GRANT SELECT ON regulatory.chromatin_state TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.chromatin_state TO ingest_writer;
GRANT SELECT ON regulatory.chromatin_state_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.chromatin_state_hg38 TO ingest_writer;
GRANT SELECT ON regulatory.chromatin_state_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.chromatin_state_hg38_p0 TO ingest_writer;
GRANT SELECT ON regulatory.chromatin_state_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.chromatin_state_hg38_p1 TO ingest_writer;
GRANT SELECT ON regulatory.chromatin_state_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.chromatin_state_hg38_p2 TO ingest_writer;
GRANT SELECT ON regulatory.chromatin_state_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.chromatin_state_hg38_p3 TO ingest_writer;

COMMIT;
