-- 067_tcga_pan_cancer.sql
-- TCGA Pan-Cancer methylation summaries.
-- Pre-computed tumor vs normal delta-betas per probe per cancer type.
-- ~485K probes × 33 cancer types = ~16M rows.
-- Source: GDC / UCSC Xena (Goldman et al. 2020 Nature Biotechnology).

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'tcga_methylation';
COMMIT;

BEGIN;

CREATE SCHEMA IF NOT EXISTS methylation;
GRANT USAGE ON SCHEMA methylation TO api_reader, ingest_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA methylation
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA methylation
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

CREATE TABLE IF NOT EXISTS methylation.tcga_pan_cancer (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    probe_id        text NOT NULL,
    cancer_type     text NOT NULL,
    n_tumor         smallint,
    n_normal        smallint,
    mean_tumor      real,
    mean_normal     real,
    delta_beta      real NOT NULL,
    p_value         real,
    fdr             real,
    direction       text NOT NULL,
    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS methylation.tcga_pan_cancer_hg38
    PARTITION OF methylation.tcga_pan_cancer FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS methylation.tcga_pan_cancer_hg38_p0
    PARTITION OF methylation.tcga_pan_cancer_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS methylation.tcga_pan_cancer_hg38_p1
    PARTITION OF methylation.tcga_pan_cancer_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS methylation.tcga_pan_cancer_hg38_p2
    PARTITION OF methylation.tcga_pan_cancer_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS methylation.tcga_pan_cancer_hg38_p3
    PARTITION OF methylation.tcga_pan_cancer_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

CREATE INDEX IF NOT EXISTS idx_tcga_pancan_range
    ON methylation.tcga_pan_cancer USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_tcga_pancan_probe
    ON methylation.tcga_pan_cancer (probe_id);
CREATE INDEX IF NOT EXISTS idx_tcga_pancan_cancer
    ON methylation.tcga_pan_cancer (cancer_type);
CREATE INDEX IF NOT EXISTS idx_tcga_pancan_layer_build
    ON methylation.tcga_pan_cancer (layer_id, build);

GRANT SELECT ON ALL TABLES IN SCHEMA methylation TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA methylation TO ingest_writer;

COMMIT;
