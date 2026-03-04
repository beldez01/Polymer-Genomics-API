-- 012_protein_evolution.sql
-- Protein Evolution Layer (dN/dS from Ensembl Compara human-mouse orthologs):
-- table, indexes, permissions. Non-partitioned (~17K rows).
-- Stored in conservation schema (created in 006).

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'protein_evolution';

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

-- 4. Protein evolution table (non-partitioned, ~17K rows)
--    dN/dS ratios from Ensembl Compara (human-mouse orthologs).
CREATE TABLE IF NOT EXISTS conservation.protein_evolution (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id            uuid NOT NULL REFERENCES registry.layers(id),
    build               genome_build NOT NULL,

    -- Identity
    gene_symbol         text NOT NULL,
    ensembl_gene_id     text,

    -- Genomic coordinates (0-based half-open internally)
    chr_id              smallint REFERENCES ref.chromosomes(chr_id),
    start_pos           int,
    end_pos             int,
    coord               int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    strand              char(1),

    -- Mouse ortholog
    mouse_gene_symbol       text,
    mouse_ensembl_gene_id   text,

    -- Evolutionary rates
    dn                  real,               -- nonsynonymous substitution rate
    ds                  real,               -- synonymous substitution rate
    omega               real,               -- dN/dS ratio (<1 purifying, =1 neutral, >1 positive selection)

    -- Orthology metadata
    orthology_type      text,               -- e.g. 'one2one', 'one2many'
    homology_id         text,

    -- Sequence identity
    perc_id_human       real,               -- percent identity, human protein
    perc_id_mouse       real                -- percent identity, mouse protein
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_protein_evolution_range
    ON conservation.protein_evolution USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_protein_evolution_symbol
    ON conservation.protein_evolution (gene_symbol);

CREATE INDEX IF NOT EXISTS idx_protein_evolution_layer_build
    ON conservation.protein_evolution (layer_id, build);

-- 6. Explicit grants (belt + suspenders with default privileges)
GRANT SELECT ON conservation.protein_evolution TO api_reader;
GRANT SELECT, INSERT, UPDATE ON conservation.protein_evolution TO ingest_writer;

COMMIT;
