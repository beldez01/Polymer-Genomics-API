-- 057_variation_schema.sql
-- Creates the variation schema for human genetic variation layers.
-- First table: ClinVar pathogenic/likely pathogenic variants.

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'clinvar';
COMMIT;

BEGIN;

CREATE SCHEMA IF NOT EXISTS variation;
GRANT USAGE ON SCHEMA variation TO api_reader, ingest_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA variation
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA variation
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

CREATE TABLE IF NOT EXISTS variation.clinvar_variants (
    id                      bigint GENERATED ALWAYS AS IDENTITY,
    layer_id                uuid NOT NULL REFERENCES registry.layers(id),
    build                   genome_build NOT NULL,
    chr_id                  smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos               int NOT NULL,
    end_pos                 int NOT NULL,
    coord                   int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    variation_id            int,
    rsid                    text,
    ref_allele              text,
    alt_allele              text,
    clinical_significance   text NOT NULL,
    review_status           text,
    disease                 text,
    gene_symbol             text,
    molecular_consequence   text,
    origin                  text,
    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

-- hg38 partition with per-chromosome sub-partitions
CREATE TABLE IF NOT EXISTS variation.clinvar_variants_hg38
    PARTITION OF variation.clinvar_variants FOR VALUES IN ('hg38')
    PARTITION BY LIST (chr_id);

DO $$ BEGIN
FOR i IN 1..25 LOOP
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS variation.clinvar_variants_hg38_chr%s
         PARTITION OF variation.clinvar_variants_hg38 FOR VALUES IN (%s)',
        i, i
    );
END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinvar_range
    ON variation.clinvar_variants USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_clinvar_gene
    ON variation.clinvar_variants (gene_symbol);
CREATE INDEX IF NOT EXISTS idx_clinvar_layer_build
    ON variation.clinvar_variants (layer_id, build);

-- Explicit grants on all tables (including partitions)
GRANT SELECT ON ALL TABLES IN SCHEMA variation TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA variation TO ingest_writer;

COMMIT;
