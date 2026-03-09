-- 021_histone_marks.sql
-- Histone Modification Peaks (ENCODE): table, indexes, permissions.
-- Stores ENCODE narrowPeak/broadPeak histone ChIP-seq data.
-- ~100K-500K peaks per mark/cell-type combination.

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'histone_mark';

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

-- 4. Histone peaks table (partitioned, ~100K-500K peaks x multiple marks/cell types)
--    ENCODE narrowPeak/broadPeak histone ChIP-seq data.
CREATE TABLE IF NOT EXISTS regulatory.histone_peaks (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open internally)
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- Histone mark identity
    mark            text NOT NULL,              -- e.g. 'H3K4me3', 'H3K27ac', 'H3K27me3'
    cell_type       text NOT NULL,              -- e.g. 'GM12878', 'K562', 'H1-hESC'

    -- Peak statistics
    signal_value    real,                       -- overall enrichment (column 7)
    p_value         real,                       -- -log10(p-value) (column 8)
    q_value         real,                       -- -log10(q-value) (column 9)
    peak_offset     int,                        -- offset from start to peak summit (narrowPeak only, NULL for broadPeak)

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

-- hg38 partition, sub-partitioned by chromosome hash
CREATE TABLE IF NOT EXISTS regulatory.histone_peaks_hg38
    PARTITION OF regulatory.histone_peaks
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

-- 4 hash sub-partitions
CREATE TABLE IF NOT EXISTS regulatory.histone_peaks_hg38_p0
    PARTITION OF regulatory.histone_peaks_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS regulatory.histone_peaks_hg38_p1
    PARTITION OF regulatory.histone_peaks_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS regulatory.histone_peaks_hg38_p2
    PARTITION OF regulatory.histone_peaks_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS regulatory.histone_peaks_hg38_p3
    PARTITION OF regulatory.histone_peaks_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_histone_peaks_range
    ON regulatory.histone_peaks USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_histone_peaks_mark_cell
    ON regulatory.histone_peaks (mark, cell_type);

CREATE INDEX IF NOT EXISTS idx_histone_peaks_layer_build
    ON regulatory.histone_peaks (layer_id, build);

-- 6. Explicit grants
GRANT SELECT ON regulatory.histone_peaks TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.histone_peaks TO ingest_writer;
GRANT SELECT ON regulatory.histone_peaks_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.histone_peaks_hg38 TO ingest_writer;
GRANT SELECT ON regulatory.histone_peaks_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.histone_peaks_hg38_p0 TO ingest_writer;
GRANT SELECT ON regulatory.histone_peaks_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.histone_peaks_hg38_p1 TO ingest_writer;
GRANT SELECT ON regulatory.histone_peaks_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.histone_peaks_hg38_p2 TO ingest_writer;
GRANT SELECT ON regulatory.histone_peaks_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.histone_peaks_hg38_p3 TO ingest_writer;

COMMIT;
