-- 014_gene_sets.sql
-- Gene Set Layer (MSigDB Hallmark): curated gene set memberships.
-- Non-partitioned (~10K rows: 50 hallmark sets x ~200 genes each).

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'gene_set';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Ensure annotation schema exists (created in 013)
CREATE SCHEMA IF NOT EXISTS annotation;
GRANT USAGE ON SCHEMA annotation TO api_reader, ingest_writer;

-- 3. Default privileges for future tables in the schema
ALTER DEFAULT PRIVILEGES IN SCHEMA annotation
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA annotation
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. Gene sets table (non-partitioned, ~10K rows)
CREATE TABLE IF NOT EXISTS annotation.gene_sets (
    id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id                uuid NOT NULL REFERENCES registry.layers(id),
    build                   genome_build NOT NULL,

    -- Gene identity
    gene_symbol             text NOT NULL,

    -- Gene set identity
    collection              text NOT NULL DEFAULT 'H',  -- MSigDB collection: H=hallmark
    gene_set_name           text NOT NULL,              -- e.g. 'HALLMARK_OXIDATIVE_PHOSPHORYLATION'
    gene_set_description    text,

    -- Provenance
    source                  text DEFAULT 'MSigDB'
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_gene_sets_symbol
    ON annotation.gene_sets (gene_symbol);

CREATE INDEX IF NOT EXISTS idx_gene_sets_name
    ON annotation.gene_sets (gene_set_name);

CREATE INDEX IF NOT EXISTS idx_gene_sets_layer_build
    ON annotation.gene_sets (layer_id, build);

-- 6. Explicit grants (belt + suspenders with default privileges)
GRANT SELECT ON annotation.gene_sets TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.gene_sets TO ingest_writer;

COMMIT;
