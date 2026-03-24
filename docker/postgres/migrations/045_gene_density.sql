-- 045_gene_density.sql
-- Derived gene/expression density columns on biophysics.sequence_properties.
-- Source: derived from GENCODE v44 (gene.features) + GTEx v10 (expression.gene_tpm).

ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS gene_density real,
    ADD COLUMN IF NOT EXISTS gene_bp_fraction real,
    ADD COLUMN IF NOT EXISTS median_tpm real;

COMMENT ON COLUMN biophysics.sequence_properties.gene_density IS 'Number of gene features overlapping 1kb window (GENCODE v44)';
COMMENT ON COLUMN biophysics.sequence_properties.gene_bp_fraction IS 'Fraction of 1kb window covered by gene bodies';
COMMENT ON COLUMN biophysics.sequence_properties.median_tpm IS 'Median GTEx TPM of genes overlapping window (GTEx v10)';
