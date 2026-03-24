-- 042_wgbs_hematopoietic.sql
-- Hematopoietic WGBS Methylation Layer: Loyfer et al. 2023 (Nature), 1kb bins.
-- 12 sorted cell types + summary stats, ~3.1M rows for hg38.
-- Source: GEO GSE186458 (open access).

BEGIN;

-- Create methylation schema if not exists (may already be in init.sql)
CREATE SCHEMA IF NOT EXISTS methylation;
GRANT USAGE ON SCHEMA methylation TO api_reader, ingest_writer;

ALTER DEFAULT PRIVILEGES IN SCHEMA methylation
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA methylation
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- Table: 1kb-binned WGBS methylation across hematopoietic cell types
CREATE TABLE IF NOT EXISTS methylation.wgbs_1kb (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    layer_id          uuid NOT NULL REFERENCES registry.layers(id),
    build             genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open, 1kb bins)
    chr_id            smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos         int NOT NULL,
    end_pos           int NOT NULL,
    coord             int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- CpG count in window
    n_cpgs            smallint,

    -- Per-cell-type mean beta (sorted WGBS, Loyfer 2023)
    hsc               real,     -- Hematopoietic stem cell
    cmp               real,     -- Common myeloid progenitor
    gmp               real,     -- Granulocyte-monocyte progenitor
    monocyte          real,     -- Monocyte
    neutrophil        real,     -- Neutrophil
    eosinophil        real,     -- Eosinophil
    b_naive           real,     -- B cell (naive)
    b_memory          real,     -- B cell (memory)
    t_naive           real,     -- T cell (naive)
    t_memory          real,     -- T cell (memory)
    nk                real,     -- Natural killer cell
    erythroid         real,     -- Erythroid progenitor

    -- Summary statistics across cell types
    mean_beta         real,     -- Mean across all cell types
    beta_variance     real,     -- Variance across cell types (cell-type specificity)
    beta_range        real,     -- Max - min across cell types

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS methylation.wgbs_1kb_hg38
    PARTITION OF methylation.wgbs_1kb
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS methylation.wgbs_1kb_hg38_p0
    PARTITION OF methylation.wgbs_1kb_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS methylation.wgbs_1kb_hg38_p1
    PARTITION OF methylation.wgbs_1kb_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS methylation.wgbs_1kb_hg38_p2
    PARTITION OF methylation.wgbs_1kb_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS methylation.wgbs_1kb_hg38_p3
    PARTITION OF methylation.wgbs_1kb_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wgbs_1kb_range
    ON methylation.wgbs_1kb USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_wgbs_1kb_layer_build
    ON methylation.wgbs_1kb (layer_id, build);

-- Grants
GRANT SELECT ON methylation.wgbs_1kb TO api_reader;
GRANT SELECT, INSERT, UPDATE ON methylation.wgbs_1kb TO ingest_writer;
GRANT SELECT ON methylation.wgbs_1kb_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON methylation.wgbs_1kb_hg38 TO ingest_writer;
GRANT SELECT ON methylation.wgbs_1kb_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON methylation.wgbs_1kb_hg38_p0 TO ingest_writer;
GRANT SELECT ON methylation.wgbs_1kb_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON methylation.wgbs_1kb_hg38_p1 TO ingest_writer;
GRANT SELECT ON methylation.wgbs_1kb_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON methylation.wgbs_1kb_hg38_p2 TO ingest_writer;
GRANT SELECT ON methylation.wgbs_1kb_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON methylation.wgbs_1kb_hg38_p3 TO ingest_writer;

COMMIT;
