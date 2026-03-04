-- 008_protein_turnover.sql
-- Protein Turnover Layer (Mathieson et al. 2018): protein half-life from dynamic SILAC.
-- Non-partitioned (~30K rows: ~6K genes × 5 cell types).

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'protein_turnover';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Ensure bioenergetics schema exists
CREATE SCHEMA IF NOT EXISTS bioenergetics;
GRANT USAGE ON SCHEMA bioenergetics TO api_reader, ingest_writer;

-- 3. Default privileges for future tables in the schema
ALTER DEFAULT PRIVILEGES IN SCHEMA bioenergetics
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA bioenergetics
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. Protein turnover table (non-partitioned, ~30K rows)
CREATE TABLE IF NOT EXISTS bioenergetics.protein_turnover (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,

    -- Identity
    gene_symbol     text NOT NULL,
    uniprot_id      text,

    -- Genomic coordinates (0-based half-open internally)
    chr_id          smallint REFERENCES ref.chromosomes(chr_id),
    start_pos       int,
    end_pos         int,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    strand          char(1),

    -- Cell type context
    cell_type       text NOT NULL,          -- B_cell, NK_cell, monocyte, hepatocyte, neuron

    -- Turnover measurements
    half_life_hours real,                   -- protein half-life (hours)
    k_degradation   real,                   -- degradation rate constant, ln(2)/half_life
    r_squared       real,                   -- fit quality of decay curve
    n_peptides      int,                    -- number of peptides quantified

    -- Provenance
    measurement_method text DEFAULT 'dynamic_SILAC'
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_protein_turnover_range
    ON bioenergetics.protein_turnover USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_protein_turnover_symbol
    ON bioenergetics.protein_turnover (gene_symbol);

CREATE INDEX IF NOT EXISTS idx_protein_turnover_layer_build
    ON bioenergetics.protein_turnover (layer_id, build);

CREATE INDEX IF NOT EXISTS idx_protein_turnover_cell_type
    ON bioenergetics.protein_turnover (cell_type);

-- 6. Explicit grants (belt + suspenders with default privileges)
GRANT SELECT ON bioenergetics.protein_turnover TO api_reader;
GRANT SELECT, INSERT, UPDATE ON bioenergetics.protein_turnover TO ingest_writer;

COMMIT;
