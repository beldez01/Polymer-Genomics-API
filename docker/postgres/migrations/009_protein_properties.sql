-- 009_protein_properties.sql
-- Protein Properties Layer (UniProt/ProtParam): CHNOPS elemental composition
-- and physicochemical properties. Non-partitioned (~20K rows).

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'protein_properties';

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

-- 4. Protein properties table (non-partitioned, ~20K rows)
--    Completes CHNOPS (C, N, S already in gene_costs; adds H, O, P + total).
CREATE TABLE IF NOT EXISTS bioenergetics.protein_properties (
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

    -- Elemental composition (completing CHNOPS)
    h_atoms         int,                    -- hydrogen
    o_atoms         int,                    -- oxygen
    p_atoms         int,                    -- phosphorus
    total_atoms     int,                    -- sum of all CHNOPS atoms

    -- Physicochemical properties
    pi              real,                   -- isoelectric point
    instability_index real,                 -- Guruprasad et al.
    aliphatic_index real,                   -- relative volume of aliphatic side chains
    gravy           real,                   -- grand average of hydropathicity (GRAVY)
    molecular_formula text,                 -- e.g. 'C2148H3381N585O648S17'

    -- Extinction coefficients
    extinction_coeff_reduced  int,          -- extinction coefficient, all Cys reduced
    extinction_coeff_oxidized int           -- extinction coefficient, all cystines formed
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_protein_properties_range
    ON bioenergetics.protein_properties USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_protein_properties_symbol
    ON bioenergetics.protein_properties (gene_symbol);

CREATE INDEX IF NOT EXISTS idx_protein_properties_layer_build
    ON bioenergetics.protein_properties (layer_id, build);

-- 6. Explicit grants (belt + suspenders with default privileges)
GRANT SELECT ON bioenergetics.protein_properties TO api_reader;
GRANT SELECT, INSERT, UPDATE ON bioenergetics.protein_properties TO ingest_writer;

COMMIT;
