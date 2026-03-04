-- 018_reference_constants.sql
-- Biophysical Reference Constants: canonical published values for nucleic acid
-- and protein biophysics. Small lookup tables (10-64 rows each), build-independent.
-- NOT managed by registry.layers (no layer_id FK, no genome_build column).

BEGIN;

-- 1. Extend the layer_type enum (for list_layers integration)
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'reference';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Create reference schema
CREATE SCHEMA IF NOT EXISTS reference;
GRANT USAGE ON SCHEMA reference TO api_reader, ingest_writer;

ALTER DEFAULT PRIVILEGES IN SCHEMA reference
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA reference
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 3. Catalog: one row per reference table (lightweight registry for discoverability)
CREATE TABLE IF NOT EXISTS reference.catalog (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name      text NOT NULL UNIQUE,
    display_name    text NOT NULL,
    description     text,
    source_citation text NOT NULL,
    row_count       int,
    created_at      timestamptz DEFAULT now()
);

-- 4. Nearest-neighbor thermodynamic parameters
--    SantaLucia 1998 (DNA/DNA), Xia/Turner 1998 (RNA/RNA), Sugimoto 1995 (RNA/DNA)
--    One row per dinucleotide per duplex_type. ~48 rows total.
CREATE TABLE IF NOT EXISTS reference.nn_thermodynamics (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    duplex_type     text NOT NULL,          -- 'dna_dna', 'rna_rna', 'rna_dna'
    dinucleotide    text NOT NULL,           -- e.g. 'AA', 'AC', ... (5'→3' on sense strand)
    delta_h         real NOT NULL,           -- kcal/mol
    delta_s         real NOT NULL,           -- cal/mol/K
    delta_g_37      real NOT NULL,           -- kcal/mol at 37°C in 1M NaCl
    source_citation text NOT NULL,
    UNIQUE (duplex_type, dinucleotide)
);
CREATE INDEX IF NOT EXISTS idx_nn_thermo_duplex
    ON reference.nn_thermodynamics (duplex_type);

-- 5. Per-dinucleotide structural and optical properties
--    Extinction coefficients (Tataurov 2008), form propensity, groove geometry
--    16 rows (one per unique dinucleotide step).
CREATE TABLE IF NOT EXISTS reference.dinucleotide_properties (
    id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dinucleotide            text NOT NULL UNIQUE,
    -- Tataurov 2008 (Biophys Chem 133:66-70)
    extinction_coeff_260    real,               -- L/(mol·cm) at 260 nm, nearest-neighbor
    -- El Hassan & Calladine 1997 / Basham 1995 A-form propensity
    a_form_propensity       real,               -- dimensionless; higher = more A-like
    -- Ho 1994 Z-form propensity
    z_form_propensity       real,               -- kcal/mol B→Z penalty; negative = favors Z
    -- Calladine / El Hassan groove geometry (average from crystal structures)
    major_groove_width      real,               -- Angstrom
    major_groove_depth      real,               -- Angstrom
    minor_groove_width      real,               -- Angstrom
    minor_groove_depth      real,               -- Angstrom
    source_citation         text NOT NULL
);

-- 6. Amino acid biophysical reference properties
--    Per-residue constants from multiple canonical sources. 20 rows.
CREATE TABLE IF NOT EXISTS reference.amino_acid_properties (
    id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    one_letter              char(1) NOT NULL UNIQUE,
    three_letter            char(3) NOT NULL,
    full_name               text NOT NULL,
    -- Mass and geometry
    mw_da                   real NOT NULL,      -- residue molecular weight (Da, minus water)
    volume_a3               real,               -- van der Waals volume (Å³), Zamyatnin 1972
    sasa_a2                 real,               -- max solvent-accessible surface area (Å²)
    -- Hydrophobicity scales
    kd_hydrophobicity       real,               -- Kyte-Doolittle 1982
    ww_hydrophobicity       real,               -- Wimley-White 1996 (interface)
    eisenberg_hydrophobicity real,              -- Eisenberg 1984 consensus
    -- Charge and ionization
    pka_side_chain          real,               -- pKa of ionizable side chain (NULL if non-ionizable)
    charge_at_ph7           real,               -- net charge at pH 7.0
    -- Biosynthetic cost
    ecpa_b20                real,               -- ATP equivalents, Akashi-Gojobori / Barton 2010
    source_citation         text NOT NULL
);

-- 7. Scalar physical constants
--    Named constants with units and experimental context. ~40-60 rows.
CREATE TABLE IF NOT EXISTS reference.physical_constants (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            text NOT NULL UNIQUE,       -- e.g. 'lp_bdna_unmethylated_nm'
    symbol          text,                       -- e.g. 'Lp'
    value           double precision NOT NULL,
    units           text NOT NULL,              -- e.g. 'nm', 'kcal/mol', 'pN'
    category        text,                       -- e.g. 'mechanics', 'electrostatics', 'kinetics'
    description     text,
    context         text,                       -- experimental conditions, e.g. '150 mM NaCl, 37°C'
    source_citation text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_phys_const_category
    ON reference.physical_constants (category);

-- 8. Explicit grants (belt + suspenders with default privileges)
GRANT SELECT ON reference.catalog TO api_reader;
GRANT SELECT ON reference.nn_thermodynamics TO api_reader;
GRANT SELECT ON reference.dinucleotide_properties TO api_reader;
GRANT SELECT ON reference.amino_acid_properties TO api_reader;
GRANT SELECT ON reference.physical_constants TO api_reader;

GRANT SELECT, INSERT, UPDATE ON reference.catalog TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON reference.nn_thermodynamics TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON reference.dinucleotide_properties TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON reference.amino_acid_properties TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON reference.physical_constants TO ingest_writer;

COMMIT;
