-- 007_protein_abundance.sql
-- Protein Abundance Layer (PaxDb v6.0): tissue-specific protein abundance in PPM
-- from mass spectrometry. Non-partitioned (~260K rows: ~20K genes × 13 tissues).

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'protein_abundance';

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

-- 4. Protein abundance table (non-partitioned, ~260K rows)
CREATE TABLE IF NOT EXISTS bioenergetics.protein_abundance (
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

    -- Tissue context
    tissue          text NOT NULL,
    organ_group     text,

    -- Abundance measurements
    abundance_ppm   real,               -- parts per million (protein copies)
    coverage        real,               -- sequence coverage (%)
    spectral_count  int,                -- number of spectra matched

    -- Provenance
    data_source     text                -- e.g. 'PaxDb_v6.0'
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_protein_abundance_range
    ON bioenergetics.protein_abundance USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_protein_abundance_symbol
    ON bioenergetics.protein_abundance (gene_symbol);

CREATE INDEX IF NOT EXISTS idx_protein_abundance_layer_build
    ON bioenergetics.protein_abundance (layer_id, build);

CREATE INDEX IF NOT EXISTS idx_protein_abundance_tissue
    ON bioenergetics.protein_abundance (tissue);

-- 6. Explicit grants (belt + suspenders with default privileges)
GRANT SELECT ON bioenergetics.protein_abundance TO api_reader;
GRANT SELECT, INSERT, UPDATE ON bioenergetics.protein_abundance TO ingest_writer;

COMMIT;
