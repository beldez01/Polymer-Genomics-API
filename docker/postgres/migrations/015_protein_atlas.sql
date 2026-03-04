-- 015_protein_atlas.sql
-- Human Protein Atlas Layer: tissue expression (antibody-based) and subcellular localization.
-- Two tables:
--   proteomics.tissue_expression   (~1M rows: ~20K genes x ~50 tissues)
--   proteomics.subcellular_location (~60K rows: ~20K genes x avg 3 locations)

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'protein_atlas';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Create proteomics schema
CREATE SCHEMA IF NOT EXISTS proteomics;
GRANT USAGE ON SCHEMA proteomics TO api_reader, ingest_writer;

-- 3. Default privileges for future tables in the schema
ALTER DEFAULT PRIVILEGES IN SCHEMA proteomics
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA proteomics
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4a. Tissue expression table (non-partitioned, ~1M rows)
CREATE TABLE IF NOT EXISTS proteomics.tissue_expression (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id            uuid NOT NULL REFERENCES registry.layers(id),
    build               genome_build NOT NULL,

    -- Gene identity
    gene_symbol         text NOT NULL,
    ensembl_gene_id     text,

    -- Genomic coordinates (0-based half-open internally)
    chr_id              smallint REFERENCES ref.chromosomes(chr_id),
    start_pos           int,
    end_pos             int,
    coord               int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    strand              char(1),

    -- Tissue context
    tissue              text NOT NULL,
    cell_type           text,

    -- Expression
    expression_level    text NOT NULL CHECK (expression_level IN ('Not detected', 'Low', 'Medium', 'High')),
    reliability         text CHECK (reliability IN ('Enhanced', 'Supported', 'Approved', 'Uncertain'))
);

-- 4b. Subcellular location table (non-partitioned, ~60K rows)
CREATE TABLE IF NOT EXISTS proteomics.subcellular_location (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id            uuid NOT NULL REFERENCES registry.layers(id),
    build               genome_build NOT NULL,

    -- Gene identity
    gene_symbol         text NOT NULL,
    ensembl_gene_id     text,

    -- Localization
    location            text NOT NULL,          -- e.g. 'Nucleus', 'Cytosol', 'Mitochondria'
    reliability         text CHECK (reliability IN ('Enhanced', 'Supported', 'Approved', 'Uncertain')),
    go_id               text                    -- Gene Ontology cellular component ID
);

-- 5. Indexes — tissue_expression
CREATE INDEX IF NOT EXISTS idx_tissue_expression_range
    ON proteomics.tissue_expression USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_tissue_expression_symbol
    ON proteomics.tissue_expression (gene_symbol);

CREATE INDEX IF NOT EXISTS idx_tissue_expression_tissue
    ON proteomics.tissue_expression (tissue);

CREATE INDEX IF NOT EXISTS idx_tissue_expression_layer_build
    ON proteomics.tissue_expression (layer_id, build);

-- 5. Indexes — subcellular_location
CREATE INDEX IF NOT EXISTS idx_subcellular_location_symbol
    ON proteomics.subcellular_location (gene_symbol);

CREATE INDEX IF NOT EXISTS idx_subcellular_location_location
    ON proteomics.subcellular_location (location);

CREATE INDEX IF NOT EXISTS idx_subcellular_location_layer_build
    ON proteomics.subcellular_location (layer_id, build);

-- 6. Explicit grants (belt + suspenders with default privileges)
GRANT SELECT ON proteomics.tissue_expression TO api_reader;
GRANT SELECT, INSERT, UPDATE ON proteomics.tissue_expression TO ingest_writer;

GRANT SELECT ON proteomics.subcellular_location TO api_reader;
GRANT SELECT, INSERT, UPDATE ON proteomics.subcellular_location TO ingest_writer;

COMMIT;
