-- 043_accessibility_signal.sql
-- Chromatin Accessibility Signal Layer: ENCODE DNase-seq / ATAC-seq, 1kb bins.
-- Source: ENCODE Consortium (CC BY 4.0).

BEGIN;

ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'accessibility';

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS regulatory.accessibility_signal (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    layer_id          uuid NOT NULL REFERENCES registry.layers(id),
    build             genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open, 1kb bins)
    chr_id            smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos         int NOT NULL,
    end_pos           int NOT NULL,
    coord             int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- DNase-seq signal (read-depth normalized)
    dnase_gm12878    real,     -- GM12878 (lymphoblastoid)
    dnase_k562       real,     -- K562 (CML)

    -- ATAC-seq signal (if available from primary hematopoietic)
    atac_hsc         real,     -- Hematopoietic stem cell (Corces 2016)
    atac_monocyte    real,     -- Monocyte (Corces 2016)

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS regulatory.accessibility_signal_hg38
    PARTITION OF regulatory.accessibility_signal
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS regulatory.accessibility_signal_hg38_p0
    PARTITION OF regulatory.accessibility_signal_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS regulatory.accessibility_signal_hg38_p1
    PARTITION OF regulatory.accessibility_signal_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS regulatory.accessibility_signal_hg38_p2
    PARTITION OF regulatory.accessibility_signal_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS regulatory.accessibility_signal_hg38_p3
    PARTITION OF regulatory.accessibility_signal_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accessibility_range
    ON regulatory.accessibility_signal USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_accessibility_layer_build
    ON regulatory.accessibility_signal (layer_id, build);

-- Grants
GRANT SELECT ON regulatory.accessibility_signal TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.accessibility_signal TO ingest_writer;
GRANT SELECT ON regulatory.accessibility_signal_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.accessibility_signal_hg38 TO ingest_writer;
GRANT SELECT ON regulatory.accessibility_signal_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.accessibility_signal_hg38_p0 TO ingest_writer;
GRANT SELECT ON regulatory.accessibility_signal_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.accessibility_signal_hg38_p1 TO ingest_writer;
GRANT SELECT ON regulatory.accessibility_signal_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.accessibility_signal_hg38_p2 TO ingest_writer;
GRANT SELECT ON regulatory.accessibility_signal_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.accessibility_signal_hg38_p3 TO ingest_writer;

COMMIT;
