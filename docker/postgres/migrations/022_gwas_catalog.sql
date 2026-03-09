-- 022_gwas_catalog.sql
-- GWAS Catalog Layer (EBI): table, indexes, permissions.
-- Stores genome-wide significant associations from the EBI GWAS Catalog.
-- ~300K associations (p < 5e-8) with trait, rsid, effect size, study metadata.

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'gwas';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Schema
CREATE SCHEMA IF NOT EXISTS annotation;
GRANT USAGE ON SCHEMA annotation TO api_reader, ingest_writer;

-- 3. Default privileges for future tables in the schema
ALTER DEFAULT PRIVILEGES IN SCHEMA annotation
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA annotation
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. Trigram extension for full-text trait search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 5. GWAS associations table (partitioned, ~300K genome-wide significant hits)
--    EBI GWAS Catalog (Buniello et al. Nucleic Acids Res 2019).
CREATE TABLE IF NOT EXISTS annotation.gwas_associations (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open internally)
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- Variant identity
    rsid            text,                          -- e.g. 'rs12345'

    -- Association statistics
    p_value         double precision,              -- extremely small values need double precision
    or_beta         real,                          -- odds ratio or beta coefficient
    ci_95           text,                          -- 95% confidence interval as string

    -- Trait and study metadata
    trait           text NOT NULL,                 -- DISEASE/TRAIT from catalog
    mapped_gene     text,                          -- mapped gene symbol(s)
    study_accession text,                          -- e.g. 'GCST000001'
    pubmed_id       text,                          -- PubMed ID

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

-- hg38 partition, sub-partitioned by chromosome hash
CREATE TABLE IF NOT EXISTS annotation.gwas_associations_hg38
    PARTITION OF annotation.gwas_associations
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

-- 4 hash sub-partitions
CREATE TABLE IF NOT EXISTS annotation.gwas_associations_hg38_p0
    PARTITION OF annotation.gwas_associations_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS annotation.gwas_associations_hg38_p1
    PARTITION OF annotation.gwas_associations_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS annotation.gwas_associations_hg38_p2
    PARTITION OF annotation.gwas_associations_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS annotation.gwas_associations_hg38_p3
    PARTITION OF annotation.gwas_associations_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_gwas_associations_range
    ON annotation.gwas_associations USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_gwas_associations_rsid
    ON annotation.gwas_associations (rsid);

CREATE INDEX IF NOT EXISTS idx_gwas_associations_trait
    ON annotation.gwas_associations USING GIN (trait gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_gwas_associations_layer_build
    ON annotation.gwas_associations (layer_id, build);

-- 7. Explicit grants
GRANT SELECT ON annotation.gwas_associations TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.gwas_associations TO ingest_writer;
GRANT SELECT ON annotation.gwas_associations_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.gwas_associations_hg38 TO ingest_writer;
GRANT SELECT ON annotation.gwas_associations_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.gwas_associations_hg38_p0 TO ingest_writer;
GRANT SELECT ON annotation.gwas_associations_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.gwas_associations_hg38_p1 TO ingest_writer;
GRANT SELECT ON annotation.gwas_associations_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.gwas_associations_hg38_p2 TO ingest_writer;
GRANT SELECT ON annotation.gwas_associations_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.gwas_associations_hg38_p3 TO ingest_writer;

COMMIT;
