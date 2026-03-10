-- 025_sbs_spectrum.sql
-- SBS Thermodynamic Spectrum: 96 COSMIC trinucleotide mutation channels with
-- nearest-neighbor stacking energy perturbation computed from SantaLucia 1998.
-- Small reference table (96 rows, build-independent, no layer_id FK).

BEGIN;

-- 1. Create mutation schema
CREATE SCHEMA IF NOT EXISTS mutation;
GRANT USAGE ON SCHEMA mutation TO api_reader, ingest_writer;

ALTER DEFAULT PRIVILEGES IN SCHEMA mutation
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA mutation
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 2. SBS spectrum table (96 rows — 6 mutation types × 16 trinucleotide contexts)
CREATE TABLE IF NOT EXISTS mutation.sbs_spectrum (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    channel         text NOT NULL UNIQUE,     -- e.g. 'A[C>A]A' (COSMIC SBS format)
    mutation_type   text NOT NULL,            -- e.g. 'C>A' (pyrimidine convention)
    ref_base        char(1) NOT NULL,         -- reference base (C or T)
    alt_base        char(1) NOT NULL,         -- alternate base
    flanking_5      char(1) NOT NULL,         -- 5' flanking base
    flanking_3      char(1) NOT NULL,         -- 3' flanking base
    trinuc_ref      text NOT NULL,            -- reference trinucleotide (e.g. 'ACA')
    trinuc_alt      text NOT NULL,            -- mutant trinucleotide (e.g. 'AAA')
    dg_wt           real NOT NULL,            -- ΔG₃₇ wildtype stacking (kcal/mol, sum of 2 NN steps)
    dg_mut          real NOT NULL,            -- ΔG₃₇ mutant stacking (kcal/mol)
    delta_dg        real NOT NULL,            -- δΔG = dg_mut - dg_wt (positive = destabilizing)
    source_citation text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sbs_mutation_type
    ON mutation.sbs_spectrum (mutation_type);

-- 3. Catalog entry
INSERT INTO reference.catalog
    (table_name, display_name, description, source_citation, row_count)
VALUES
    ('sbs_spectrum', 'SBS Thermodynamic Spectrum',
     '96-channel COSMIC SBS trinucleotide mutation spectrum with nearest-neighbor stacking energy perturbation',
     'SantaLucia 1998 PNAS 95:1460-1465; COSMIC SBS v3.4',
     96)
ON CONFLICT (table_name) DO NOTHING;

-- 4. Explicit grants
GRANT SELECT ON mutation.sbs_spectrum TO api_reader;
GRANT SELECT, INSERT, UPDATE ON mutation.sbs_spectrum TO ingest_writer;

COMMIT;
