-- 041_tf_binding_signal.sql
-- TF Binding Signal Layer: ENCODE ChIP-seq fold-change-over-control, 1kb bins.
-- ~15 TF×cell_type columns, ~3.1M rows for hg38.
-- Source: ENCODE Consortium (CC BY 4.0).

BEGIN;

ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'tf_binding';

COMMIT;

BEGIN;

-- Table: columnar 1kb-binned TF ChIP-seq signal
CREATE TABLE IF NOT EXISTS regulatory.tf_binding_signal (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    layer_id          uuid NOT NULL REFERENCES registry.layers(id),
    build             genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open, 1kb bins)
    chr_id            smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos         int NOT NULL,
    end_pos           int NOT NULL,
    coord             int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- TF fold-change-over-control signal (mean over 1kb window)
    -- GM12878 cell line
    ctcf_gm12878     real,     -- CTCF (insulator)
    sp1_gm12878      real,     -- SP1 (ubiquitous activator)
    yy1_gm12878      real,     -- YY1 (Polycomb/activator)
    polr2a_gm12878   real,     -- RNA Pol II (transcription)
    ezh2_gm12878     real,     -- EZH2 (Polycomb repressor)
    suz12_gm12878    real,     -- SUZ12 (Polycomb repressor)
    rest_gm12878     real,     -- REST (neuronal repressor)

    -- K562 cell line
    ctcf_k562        real,     -- CTCF (insulator)
    spi1_k562        real,     -- SPI1/PU.1 (myeloid TF)
    gata2_k562       real,     -- GATA2 (hematopoietic)
    runx1_k562       real,     -- RUNX1 (hematopoietic)
    tal1_k562        real,     -- TAL1 (hematopoietic)
    sp1_k562         real,     -- SP1 (ubiquitous activator)
    polr2a_k562      real,     -- RNA Pol II (transcription)
    ezh2_k562        real,     -- EZH2 (Polycomb repressor)

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

-- hg38 partition with 4 hash sub-partitions
CREATE TABLE IF NOT EXISTS regulatory.tf_binding_signal_hg38
    PARTITION OF regulatory.tf_binding_signal
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS regulatory.tf_binding_signal_hg38_p0
    PARTITION OF regulatory.tf_binding_signal_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS regulatory.tf_binding_signal_hg38_p1
    PARTITION OF regulatory.tf_binding_signal_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS regulatory.tf_binding_signal_hg38_p2
    PARTITION OF regulatory.tf_binding_signal_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS regulatory.tf_binding_signal_hg38_p3
    PARTITION OF regulatory.tf_binding_signal_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tf_binding_range
    ON regulatory.tf_binding_signal USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_tf_binding_layer_build
    ON regulatory.tf_binding_signal (layer_id, build);

-- Grants
GRANT SELECT ON regulatory.tf_binding_signal TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tf_binding_signal TO ingest_writer;
GRANT SELECT ON regulatory.tf_binding_signal_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tf_binding_signal_hg38 TO ingest_writer;
GRANT SELECT ON regulatory.tf_binding_signal_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tf_binding_signal_hg38_p0 TO ingest_writer;
GRANT SELECT ON regulatory.tf_binding_signal_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tf_binding_signal_hg38_p1 TO ingest_writer;
GRANT SELECT ON regulatory.tf_binding_signal_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tf_binding_signal_hg38_p2 TO ingest_writer;
GRANT SELECT ON regulatory.tf_binding_signal_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tf_binding_signal_hg38_p3 TO ingest_writer;

COMMIT;
