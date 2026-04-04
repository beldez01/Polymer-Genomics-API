-- 065_tfbs_peaks.sql
-- ENCODE TF binding site (TFBS) ChIP-seq peaks.
-- ~5-15M peaks across ~700 experiments.
-- Source: ENCODE portal (encodeproject.org), CC BY 4.0.

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'tfbs';
COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS regulatory.tfbs_peaks (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    tf_name         text NOT NULL,
    cell_type       text NOT NULL,
    signal_value    real,
    p_value         real,
    q_value         real,
    peak_offset     int,
    experiment_id   text,
    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS regulatory.tfbs_peaks_hg38
    PARTITION OF regulatory.tfbs_peaks FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS regulatory.tfbs_peaks_hg38_p0
    PARTITION OF regulatory.tfbs_peaks_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS regulatory.tfbs_peaks_hg38_p1
    PARTITION OF regulatory.tfbs_peaks_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS regulatory.tfbs_peaks_hg38_p2
    PARTITION OF regulatory.tfbs_peaks_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS regulatory.tfbs_peaks_hg38_p3
    PARTITION OF regulatory.tfbs_peaks_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

CREATE INDEX IF NOT EXISTS idx_tfbs_range
    ON regulatory.tfbs_peaks USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_tfbs_tf_cell
    ON regulatory.tfbs_peaks (tf_name, cell_type);
CREATE INDEX IF NOT EXISTS idx_tfbs_layer_build
    ON regulatory.tfbs_peaks (layer_id, build);

GRANT SELECT ON regulatory.tfbs_peaks TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tfbs_peaks TO ingest_writer;
GRANT SELECT ON regulatory.tfbs_peaks_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tfbs_peaks_hg38 TO ingest_writer;
GRANT SELECT ON regulatory.tfbs_peaks_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tfbs_peaks_hg38_p0 TO ingest_writer;
GRANT SELECT ON regulatory.tfbs_peaks_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tfbs_peaks_hg38_p1 TO ingest_writer;
GRANT SELECT ON regulatory.tfbs_peaks_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tfbs_peaks_hg38_p2 TO ingest_writer;
GRANT SELECT ON regulatory.tfbs_peaks_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tfbs_peaks_hg38_p3 TO ingest_writer;

COMMIT;
