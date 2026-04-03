-- 062_qtl_schema.sql
-- QTL tables: eQTLs (GTEx) and meQTLs (GoDMC)

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'eqtl';
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'meqtl';
COMMIT;

BEGIN;

CREATE SCHEMA IF NOT EXISTS qtl;
GRANT USAGE ON SCHEMA qtl TO api_reader, ingest_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA qtl
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA qtl
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- Expression QTLs (GTEx v8)
CREATE TABLE IF NOT EXISTS qtl.eqtls (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    variant_id      text,       -- chr_pos_ref_alt_b38
    gene_id         text,       -- ENSG ID
    gene_symbol     text,
    tissue          text,
    tss_distance    int,
    effect_size     real,       -- slope (beta)
    p_value         double precision,
    q_value         real,
    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS qtl.eqtls_hg38
    PARTITION OF qtl.eqtls FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

-- 4 hash partitions
CREATE TABLE IF NOT EXISTS qtl.eqtls_hg38_p0
    PARTITION OF qtl.eqtls_hg38 FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS qtl.eqtls_hg38_p1
    PARTITION OF qtl.eqtls_hg38 FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS qtl.eqtls_hg38_p2
    PARTITION OF qtl.eqtls_hg38 FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS qtl.eqtls_hg38_p3
    PARTITION OF qtl.eqtls_hg38 FOR VALUES WITH (MODULUS 4, REMAINDER 3);

CREATE INDEX IF NOT EXISTS idx_eqtl_range ON qtl.eqtls USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_eqtl_gene ON qtl.eqtls (gene_symbol);
CREATE INDEX IF NOT EXISTS idx_eqtl_tissue ON qtl.eqtls (tissue);
CREATE INDEX IF NOT EXISTS idx_eqtl_layer ON qtl.eqtls (layer_id, build);

-- Methylation QTLs (GoDMC)
CREATE TABLE IF NOT EXISTS qtl.meqtls (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    snp_rsid        text,
    cpg_probe_id    text,
    beta            real,
    se              real,
    p_value         double precision,
    allele_freq     real,
    cis_trans       text,       -- cis, trans
    distance        int,
    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS qtl.meqtls_hg38
    PARTITION OF qtl.meqtls FOR VALUES IN ('hg38');

CREATE INDEX IF NOT EXISTS idx_meqtl_range ON qtl.meqtls USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_meqtl_probe ON qtl.meqtls (cpg_probe_id);
CREATE INDEX IF NOT EXISTS idx_meqtl_layer ON qtl.meqtls (layer_id, build);

GRANT SELECT ON ALL TABLES IN SCHEMA qtl TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA qtl TO ingest_writer;

COMMIT;
