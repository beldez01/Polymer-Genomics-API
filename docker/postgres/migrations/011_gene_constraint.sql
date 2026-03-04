-- 011_gene_constraint.sql
-- Gene Constraint Layer (gnomAD pLI/LOEUF/Z-scores): table, indexes, permissions.
-- Non-partitioned (~20K rows). Stored in conservation schema (created in 006).

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'constraint';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Ensure conservation schema exists (created in 006_conservation.sql)
CREATE SCHEMA IF NOT EXISTS conservation;
GRANT USAGE ON SCHEMA conservation TO api_reader, ingest_writer;

-- 3. Default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA conservation
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA conservation
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. Gene constraint table (non-partitioned, ~20K rows)
--    gnomAD gene-level constraint metrics: pLI, LOEUF, Z-scores.
CREATE TABLE IF NOT EXISTS conservation.gene_constraint (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,

    -- Identity
    gene_symbol     text NOT NULL,
    transcript      text,                   -- canonical transcript ID

    -- Genomic coordinates (0-based half-open internally)
    chr_id          smallint REFERENCES ref.chromosomes(chr_id),
    start_pos       int,
    end_pos         int,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    strand          char(1),

    -- Constraint metrics
    pli             real,                   -- probability of loss-of-function intolerance
    loeuf           real,                   -- loss-of-function observed/expected upper bound fraction (lower=more constrained)
    mis_z           real,                   -- missense Z-score (higher=more constrained)
    syn_z           real,                   -- synonymous Z-score

    -- Observed / expected variant counts
    obs_lof         int,                    -- observed loss-of-function variants
    exp_lof         real,                   -- expected loss-of-function variants
    obs_mis         int,                    -- observed missense variants
    exp_mis         real,                   -- expected missense variants
    obs_syn         int,                    -- observed synonymous variants
    exp_syn         real,                   -- expected synonymous variants

    -- Provenance
    gnomad_version  text                    -- e.g. 'v2.1.1', 'v4.1'
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_gene_constraint_range
    ON conservation.gene_constraint USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_gene_constraint_symbol
    ON conservation.gene_constraint (gene_symbol);

CREATE INDEX IF NOT EXISTS idx_gene_constraint_layer_build
    ON conservation.gene_constraint (layer_id, build);

-- 6. Explicit grants (belt + suspenders with default privileges)
GRANT SELECT ON conservation.gene_constraint TO api_reader;
GRANT SELECT, INSERT, UPDATE ON conservation.gene_constraint TO ingest_writer;

COMMIT;
