-- 010_gene_costs_v2.sql
-- Expand gene_costs with RNA transcription cost columns and 30 additional
-- tissue TPM + EWGC columns (GTEx v10 54-tissue list completion).
-- ALTER TABLE migration — no new layer type, no new schema needed.

BEGIN;

-- 1. No new layer_type needed (uses existing 'gene_cost')
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'gene_cost';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Ensure bioenergetics schema exists
CREATE SCHEMA IF NOT EXISTS bioenergetics;
GRANT USAGE ON SCHEMA bioenergetics TO api_reader, ingest_writer;

-- 3. Default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA bioenergetics
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA bioenergetics
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. Add RNA transcription cost columns
ALTER TABLE bioenergetics.gene_costs
    ADD COLUMN IF NOT EXISTS transcript_length_nt int,      -- mRNA transcript length in nucleotides
    ADD COLUMN IF NOT EXISTS c_transcription      real,     -- ATP cost per transcript (Lynch-Marinov framework)
    ADD COLUMN IF NOT EXISTS c_rna_total          real;     -- total RNA cost = c_transcription * expression_level

-- 5. Add 30 new tissue TPM columns (GTEx v10 completion)
ALTER TABLE bioenergetics.gene_costs
    ADD COLUMN IF NOT EXISTS tpm_adipose_visceral_omentum                    real,
    ADD COLUMN IF NOT EXISTS tpm_adrenal_gland                               real,
    ADD COLUMN IF NOT EXISTS tpm_artery_coronary                              real,
    ADD COLUMN IF NOT EXISTS tpm_artery_tibial                               real,
    ADD COLUMN IF NOT EXISTS tpm_bladder                                      real,
    ADD COLUMN IF NOT EXISTS tpm_brain_amygdala                               real,
    ADD COLUMN IF NOT EXISTS tpm_brain_anterior_cingulate_cortex_ba24         real,
    ADD COLUMN IF NOT EXISTS tpm_brain_caudate_basal_ganglia                  real,
    ADD COLUMN IF NOT EXISTS tpm_brain_cerebellar_hemisphere                  real,
    ADD COLUMN IF NOT EXISTS tpm_brain_cerebellum                             real,
    ADD COLUMN IF NOT EXISTS tpm_brain_cortex                                 real,
    ADD COLUMN IF NOT EXISTS tpm_brain_frontal_cortex_ba9                     real,
    ADD COLUMN IF NOT EXISTS tpm_brain_hippocampus                            real,
    ADD COLUMN IF NOT EXISTS tpm_brain_hypothalamus                           real,
    ADD COLUMN IF NOT EXISTS tpm_brain_nucleus_accumbens_basal_ganglia        real,
    ADD COLUMN IF NOT EXISTS tpm_brain_putamen_basal_ganglia                  real,
    ADD COLUMN IF NOT EXISTS tpm_brain_spinal_cord_cervical_c1                real,
    ADD COLUMN IF NOT EXISTS tpm_brain_substantia_nigra                       real,
    ADD COLUMN IF NOT EXISTS tpm_cells_cultured_fibroblasts                   real,
    ADD COLUMN IF NOT EXISTS tpm_cells_ebv_transformed_lymphocytes            real,
    ADD COLUMN IF NOT EXISTS tpm_cervix_ectocervix                            real,
    ADD COLUMN IF NOT EXISTS tpm_cervix_endocervix                            real,
    ADD COLUMN IF NOT EXISTS tpm_fallopian_tube                               real,
    ADD COLUMN IF NOT EXISTS tpm_heart_left_ventricle                         real,
    ADD COLUMN IF NOT EXISTS tpm_kidney_medulla                               real,
    ADD COLUMN IF NOT EXISTS tpm_minor_salivary_gland                         real,
    ADD COLUMN IF NOT EXISTS tpm_muscle_skeletal                              real,
    ADD COLUMN IF NOT EXISTS tpm_nerve_tibial                                 real,
    ADD COLUMN IF NOT EXISTS tpm_vagina                                       real,
    ADD COLUMN IF NOT EXISTS tpm_colon_transverse                             real;

-- 6. Add 30 new tissue EWGC columns (matching TPM tissues)
ALTER TABLE bioenergetics.gene_costs
    ADD COLUMN IF NOT EXISTS ewgc_adipose_visceral_omentum                   real,
    ADD COLUMN IF NOT EXISTS ewgc_adrenal_gland                              real,
    ADD COLUMN IF NOT EXISTS ewgc_artery_coronary                             real,
    ADD COLUMN IF NOT EXISTS ewgc_artery_tibial                              real,
    ADD COLUMN IF NOT EXISTS ewgc_bladder                                     real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_amygdala                              real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_anterior_cingulate_cortex_ba24        real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_caudate_basal_ganglia                 real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_cerebellar_hemisphere                 real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_cerebellum                            real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_cortex                                real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_frontal_cortex_ba9                    real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_hippocampus                           real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_hypothalamus                          real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_nucleus_accumbens_basal_ganglia       real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_putamen_basal_ganglia                 real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_spinal_cord_cervical_c1               real,
    ADD COLUMN IF NOT EXISTS ewgc_brain_substantia_nigra                      real,
    ADD COLUMN IF NOT EXISTS ewgc_cells_cultured_fibroblasts                  real,
    ADD COLUMN IF NOT EXISTS ewgc_cells_ebv_transformed_lymphocytes           real,
    ADD COLUMN IF NOT EXISTS ewgc_cervix_ectocervix                           real,
    ADD COLUMN IF NOT EXISTS ewgc_cervix_endocervix                           real,
    ADD COLUMN IF NOT EXISTS ewgc_fallopian_tube                              real,
    ADD COLUMN IF NOT EXISTS ewgc_heart_left_ventricle                        real,
    ADD COLUMN IF NOT EXISTS ewgc_kidney_medulla                              real,
    ADD COLUMN IF NOT EXISTS ewgc_minor_salivary_gland                        real,
    ADD COLUMN IF NOT EXISTS ewgc_muscle_skeletal                             real,
    ADD COLUMN IF NOT EXISTS ewgc_nerve_tibial                                real,
    ADD COLUMN IF NOT EXISTS ewgc_vagina                                      real,
    ADD COLUMN IF NOT EXISTS ewgc_colon_transverse                            real;

-- 7. No new indexes needed (existing GiST, symbol, layer_build indexes still apply)

-- 8. Explicit grants (belt + suspenders with default privileges)
GRANT SELECT ON bioenergetics.gene_costs TO api_reader;
GRANT SELECT, INSERT, UPDATE ON bioenergetics.gene_costs TO ingest_writer;

COMMIT;
