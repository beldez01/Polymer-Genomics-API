-- 013_gene_pathways.sql
-- Gene Pathway Layer (Reactome): gene-to-pathway memberships.
-- Non-partitioned (~100K rows: ~2,700 pathways x avg 37 genes).

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'pathway';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Create annotation schema
CREATE SCHEMA IF NOT EXISTS annotation;
GRANT USAGE ON SCHEMA annotation TO api_reader, ingest_writer;

-- 3. Default privileges for future tables in the schema
ALTER DEFAULT PRIVILEGES IN SCHEMA annotation
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA annotation
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. Gene pathways table (non-partitioned, ~100K rows)
CREATE TABLE IF NOT EXISTS annotation.gene_pathways (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id            uuid NOT NULL REFERENCES registry.layers(id),
    build               genome_build NOT NULL,

    -- Gene identity
    gene_symbol         text NOT NULL,
    gene_id             text,                   -- Entrez gene ID or ENSG

    -- Pathway identity
    pathway_id          text NOT NULL,          -- Reactome stable ID (e.g. 'R-HSA-109582')
    pathway_name        text NOT NULL,
    pathway_hierarchy   text,                   -- top-level category (e.g. 'Signal Transduction')

    -- Evidence
    evidence_code       text,                   -- e.g. 'IEA', 'TAS'
    source              text DEFAULT 'Reactome'
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_gene_pathways_symbol
    ON annotation.gene_pathways (gene_symbol);

CREATE INDEX IF NOT EXISTS idx_gene_pathways_pathway_id
    ON annotation.gene_pathways (pathway_id);

CREATE INDEX IF NOT EXISTS idx_gene_pathways_layer_build
    ON annotation.gene_pathways (layer_id, build);

-- 6. Explicit grants (belt + suspenders with default privileges)
GRANT SELECT ON annotation.gene_pathways TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.gene_pathways TO ingest_writer;

COMMIT;
