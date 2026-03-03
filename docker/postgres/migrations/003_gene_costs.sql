-- 003_gene_costs.sql
-- Gene Bioenergetic Cost Layer: schema, table, indexes, permissions.

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'gene_cost';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Create bioenergetics schema
CREATE SCHEMA IF NOT EXISTS bioenergetics;
GRANT USAGE ON SCHEMA bioenergetics TO api_reader, ingest_writer;

-- 3. Default privileges for future tables in the schema
ALTER DEFAULT PRIVILEGES IN SCHEMA bioenergetics
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA bioenergetics
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. Gene cost table (non-partitioned, ~20K rows like ref.isochores)
CREATE TABLE IF NOT EXISTS bioenergetics.gene_costs (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,

    -- Identity
    gene_symbol     text NOT NULL,
    uniprot_id      text,
    protein_name    text,

    -- Genomic coordinates (0-based half-open internally)
    chr_id          smallint REFERENCES ref.chromosomes(chr_id),
    start_pos       int,
    end_pos         int,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    strand          char(1),

    -- Protein identity
    protein_length  int,

    -- Biosynthetic cost (Akashi-Gojobori)
    ecpa_b20        real,   -- ECPAgene Barton 2010 (ATP per aa)
    ecpa_h11        real,   -- ECPAgene Higgs 2011
    c_protein       real,   -- Total protein cost (ATP)
    c_aa_synthesis  real,   -- Amino acid synthesis cost
    c_translation   real,   -- Translation cost

    -- Elemental composition
    n_protein       int,    -- Nitrogen atoms in protein
    s_protein       int,    -- Sulfur atoms in protein
    c_atoms         int,    -- Carbon atoms
    mw_kda          real,   -- Molecular weight (kDa)
    cost_per_kda    real,
    n_per_kda       real,
    s_per_kda       real,

    -- Amino acid composition fractions
    frac_cheap          real,
    frac_moderate       real,
    frac_expensive      real,
    frac_very_expensive real,
    n_cys           int,
    n_met           int,
    n_trp           int,
    n_arg           int,
    n_lys           int,

    -- Codon optimization
    cds_length_nt   int,
    n_codons        int,
    gc3             real,
    gc_cds          real,
    cai             real,   -- Codon Adaptation Index
    tai             real,   -- tRNA Adaptation Index
    enc             real,   -- Effective Number of Codons
    fop             real,   -- Frequency of Optimal codons

    -- Expression (GTEx summary)
    mean_tpm        real,
    max_tpm         real,

    -- Per-tissue TPM (24 tissues)
    tpm_brain       real,
    tpm_heart       real,
    tpm_kidney      real,
    tpm_liver       real,
    tpm_muscle      real,
    tpm_adipose     real,
    tpm_whole_blood real,
    tpm_lung        real,
    tpm_pancreas    real,
    tpm_stomach     real,
    tpm_small_intestine real,
    tpm_skin        real,
    tpm_testis      real,
    tpm_ovary       real,
    tpm_thyroid     real,
    tpm_spleen      real,
    tpm_nerve       real,
    tpm_artery      real,
    tpm_colon       real,
    tpm_esophagus   real,
    tpm_prostate    real,
    tpm_pituitary   real,
    tpm_breast      real,
    tpm_uterus      real,

    -- Per-tissue EWGC (24 tissues)
    ewgc_brain      real,
    ewgc_heart      real,
    ewgc_kidney     real,
    ewgc_liver      real,
    ewgc_muscle     real,
    ewgc_adipose    real,
    ewgc_whole_blood real,
    ewgc_lung       real,
    ewgc_pancreas   real,
    ewgc_stomach    real,
    ewgc_small_intestine real,
    ewgc_skin       real,
    ewgc_testis     real,
    ewgc_ovary      real,
    ewgc_thyroid    real,
    ewgc_spleen     real,
    ewgc_nerve      real,
    ewgc_artery     real,
    ewgc_colon      real,
    ewgc_esophagus  real,
    ewgc_prostate   real,
    ewgc_pituitary  real,
    ewgc_breast     real,
    ewgc_uterus     real
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_gene_costs_range
    ON bioenergetics.gene_costs USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_gene_costs_symbol
    ON bioenergetics.gene_costs (gene_symbol);

CREATE INDEX IF NOT EXISTS idx_gene_costs_layer_build
    ON bioenergetics.gene_costs (layer_id, build);

-- 6. Explicit grants (belt + suspenders with default privileges)
GRANT SELECT ON bioenergetics.gene_costs TO api_reader;
GRANT SELECT, INSERT, UPDATE ON bioenergetics.gene_costs TO ingest_writer;

COMMIT;
