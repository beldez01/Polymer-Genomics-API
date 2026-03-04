-- 004_expression.sql
-- Gene Expression Layer (GTEx v10): schema, table, indexes, permissions.

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'expression';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Create expression schema
CREATE SCHEMA IF NOT EXISTS expression;
GRANT USAGE ON SCHEMA expression TO api_reader, ingest_writer;

-- 3. Default privileges for future tables in the schema
ALTER DEFAULT PRIVILEGES IN SCHEMA expression
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA expression
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. Gene expression table (non-partitioned, ~56K rows)
--    WIDE format: one row per gene, 54 tissue columns.
CREATE TABLE IF NOT EXISTS expression.gene_tpm (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,

    -- Identity
    gene_symbol     text NOT NULL,
    gene_id         text,                   -- ENSG ID (no version suffix)

    -- Genomic coordinates (0-based half-open internally)
    chr_id          smallint REFERENCES ref.chromosomes(chr_id),
    start_pos       int,
    end_pos         int,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    strand          char(1),

    -- Summary
    median_tpm      real,                   -- median across all 54 tissues
    max_tpm         real,
    max_tissue      text,                   -- tissue name with highest TPM
    n_tissues_detected smallint,            -- count where TPM > 0.1

    -- Per-tissue TPM (54 GTEx v10 tissues, all REAL, snake_case)
    tpm_adipose_subcutaneous            real,
    tpm_adipose_visceral_omentum        real,
    tpm_adrenal_gland                   real,
    tpm_artery_aorta                    real,
    tpm_artery_coronary                 real,
    tpm_artery_tibial                   real,
    tpm_bladder                         real,
    tpm_brain_amygdala                  real,
    tpm_brain_anterior_cingulate_cortex_ba24 real,
    tpm_brain_caudate_basal_ganglia     real,
    tpm_brain_cerebellar_hemisphere     real,
    tpm_brain_cerebellum                real,
    tpm_brain_cortex                    real,
    tpm_brain_frontal_cortex_ba9        real,
    tpm_brain_hippocampus               real,
    tpm_brain_hypothalamus              real,
    tpm_brain_nucleus_accumbens_basal_ganglia real,
    tpm_brain_putamen_basal_ganglia     real,
    tpm_brain_spinal_cord_cervical_c1   real,
    tpm_brain_substantia_nigra          real,
    tpm_breast_mammary_tissue           real,
    tpm_cells_cultured_fibroblasts      real,
    tpm_cells_ebv_transformed_lymphocytes real,
    tpm_cervix_ectocervix               real,
    tpm_cervix_endocervix               real,
    tpm_colon_sigmoid                   real,
    tpm_colon_transverse                real,
    tpm_esophagus_gastroesophageal_junction real,
    tpm_esophagus_mucosa                real,
    tpm_esophagus_muscularis            real,
    tpm_fallopian_tube                  real,
    tpm_heart_atrial_appendage          real,
    tpm_heart_left_ventricle            real,
    tpm_kidney_cortex                   real,
    tpm_kidney_medulla                  real,
    tpm_liver                           real,
    tpm_lung                            real,
    tpm_minor_salivary_gland            real,
    tpm_muscle_skeletal                 real,
    tpm_nerve_tibial                    real,
    tpm_ovary                           real,
    tpm_pancreas                        real,
    tpm_pituitary                       real,
    tpm_prostate                        real,
    tpm_skin_not_sun_exposed_suprapubic real,
    tpm_skin_sun_exposed_lower_leg      real,
    tpm_small_intestine_terminal_ileum  real,
    tpm_spleen                          real,
    tpm_stomach                         real,
    tpm_testis                          real,
    tpm_thyroid                         real,
    tpm_uterus                          real,
    tpm_vagina                          real,
    tpm_whole_blood                     real
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_gene_tpm_range
    ON expression.gene_tpm USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_gene_tpm_symbol
    ON expression.gene_tpm (gene_symbol);

CREATE INDEX IF NOT EXISTS idx_gene_tpm_layer_build
    ON expression.gene_tpm (layer_id, build);

-- 6. Explicit grants (belt + suspenders with default privileges)
GRANT SELECT ON expression.gene_tpm TO api_reader;
GRANT SELECT, INSERT, UPDATE ON expression.gene_tpm TO ingest_writer;

COMMIT;
