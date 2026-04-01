-- 053: HLA Allele Biophysics Layer
-- Source: IPD-IMGT/HLA Database (https://www.ebi.ac.uk/ipd/imgt/hla/)
-- Reference: Bettens et al. 2022 (PLOS Genetics) — non-coding cis-eQTLs
--            explain 13-50% of HLA class I expression variance.
--
-- Allele-centric data model: each HLA allele is its own entity with
-- pre-computed biophysics for whole allele, non-coding regions, and
-- individual features (exons/introns/UTRs).

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'hla';
COMMIT;

BEGIN;

-- ============================================================
-- Schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS hla;

-- ============================================================
-- hla.alleles — master allele table (~37K rows)
-- ============================================================
CREATE TABLE IF NOT EXISTS hla.alleles (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),

    -- HLA identity (4-field nomenclature)
    allele_name     text NOT NULL,          -- e.g. 'A*01:01:01:01'
    locus           text NOT NULL,          -- e.g. 'HLA-A', 'HLA-DRB1'
    allele_group    text NOT NULL,          -- 1st field
    protein         text NOT NULL,          -- 2nd field
    synonymous      text,                   -- 3rd field (null if < 3 fields)
    noncoding       text,                   -- 4th field (null if < 4 fields)

    -- Classification
    hla_class       smallint NOT NULL CHECK (hla_class IN (1, 2)),
    expression_suffix text CHECK (expression_suffix IN ('N','L','S','C','A','Q',NULL)),

    -- Sequence metadata
    has_genomic     boolean NOT NULL DEFAULT false,
    sequence_length int,
    cds_length      int,
    n_exons         smallint,
    n_introns       smallint,

    -- Whole-allele biophysics (computed over full genomic sequence)
    gc_content           real,
    cpg_count            int,
    cpg_density          real,
    cpg_obs_exp          real,
    cpg_island_count     int,
    mean_stacking_dg37   real,    -- kcal/mol per step
    melting_temp_est     real,    -- degrees C
    mean_a_form_prop     real,
    mean_z_form_prop     real,
    total_z_penalty      real,
    mean_major_groove_w  real,    -- Angstroms
    mean_minor_groove_w  real,

    -- Non-coding biophysics (introns + UTRs only)
    nc_gc_content        real,
    nc_cpg_count         int,
    nc_cpg_density       real,
    nc_mean_stacking_dg37 real,
    nc_melting_temp_est  real,
    nc_mean_a_form_prop  real,
    nc_mean_z_form_prop  real,
    nc_total_z_penalty   real,
    nc_cpg_island_count  int,

    -- Flag counts from evaluate_sequence
    flag_count_total     int,
    flag_count_warnings  int,

    -- Provenance
    imgt_version    text NOT NULL,
    accession       text,

    UNIQUE (layer_id, allele_name)
);

CREATE INDEX IF NOT EXISTS idx_hla_alleles_locus
    ON hla.alleles (locus);
CREATE INDEX IF NOT EXISTS idx_hla_alleles_locus_group
    ON hla.alleles (locus, allele_group);
CREATE INDEX IF NOT EXISTS idx_hla_alleles_protein
    ON hla.alleles (locus, allele_group, protein);
CREATE INDEX IF NOT EXISTS idx_hla_alleles_name
    ON hla.alleles (allele_name);
CREATE INDEX IF NOT EXISTS idx_hla_alleles_layer
    ON hla.alleles (layer_id);

-- ============================================================
-- hla.allele_features — per-exon/intron/UTR biophysics (~555K rows)
-- ============================================================
CREATE TABLE IF NOT EXISTS hla.allele_features (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    allele_id       bigint NOT NULL REFERENCES hla.alleles(id),

    -- Feature identity
    feature_type    text NOT NULL,      -- 'exon', 'intron', '5utr', '3utr'
    feature_number  smallint NOT NULL,  -- ordinal (1-based)
    feature_label   text NOT NULL,      -- e.g. 'exon_3', 'intron_2', '5utr'

    -- Position within allele sequence (0-based half-open)
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    length_bp       int NOT NULL,
    sequence_hash   text,               -- sha256 for dedup/comparison

    -- Biophysics
    gc_content      real,
    cpg_count       int,
    cpg_density     real,
    cpg_obs_exp     real,
    mean_stacking_dg37  real,
    melting_temp_est    real,
    mean_a_form_prop    real,
    mean_z_form_prop    real,
    total_z_penalty     real,
    mean_major_groove_w real,
    mean_minor_groove_w real,
    cpg_island_count    int,

    -- Flags
    flag_count      int DEFAULT 0,

    UNIQUE (layer_id, allele_id, feature_label)
);

CREATE INDEX IF NOT EXISTS idx_hla_features_allele
    ON hla.allele_features (allele_id);
CREATE INDEX IF NOT EXISTS idx_hla_features_type
    ON hla.allele_features (feature_type);
CREATE INDEX IF NOT EXISTS idx_hla_features_layer
    ON hla.allele_features (layer_id);

-- ============================================================
-- hla.allele_sequences — raw FASTA sequences (~100 MB text)
-- ============================================================
CREATE TABLE IF NOT EXISTS hla.allele_sequences (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    allele_id       bigint NOT NULL REFERENCES hla.alleles(id) UNIQUE,
    genomic_seq     text,
    cds_seq         text
);

CREATE INDEX IF NOT EXISTS idx_hla_seq_allele
    ON hla.allele_sequences (allele_id);

-- ============================================================
-- Grants
-- ============================================================
GRANT USAGE ON SCHEMA hla TO api_reader, ingest_writer;

ALTER DEFAULT PRIVILEGES IN SCHEMA hla
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA hla
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

GRANT SELECT ON ALL TABLES IN SCHEMA hla TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA hla TO ingest_writer;

COMMIT;
