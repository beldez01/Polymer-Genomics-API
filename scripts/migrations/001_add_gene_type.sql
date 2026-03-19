-- Migration: Add gene_type column to gene.features
-- Purpose: Store GENCODE biotype (protein_coding, lncRNA, etc.) to enable
--          accurate protein-coding gene counts on the atlas overview.
-- After running: re-ingest GENCODE v44 to populate the column.
--
-- Run via: fly postgres connect -a polymer-db < scripts/migrations/001_add_gene_type.sql

ALTER TABLE gene.features ADD COLUMN IF NOT EXISTS gene_type text;

-- Index for efficient counts by gene_type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gene_gene_type
    ON gene.features (gene_type, feature_type, build);
