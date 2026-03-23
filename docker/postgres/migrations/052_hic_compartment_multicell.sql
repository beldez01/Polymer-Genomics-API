-- 052_hic_compartment_multicell.sql
-- Add cell_type and generic pc1_score columns to hic_compartment for multi-cell-type support.
-- Original pc1_gm12878 column retained for backwards compatibility.
-- Source: 4D Nucleome compartment bigWig files (data.4dnucleome.org).

BEGIN;

ALTER TABLE regulatory.hic_compartment
    ADD COLUMN IF NOT EXISTS cell_type text,
    ADD COLUMN IF NOT EXISTS pc1_score real;

-- Backfill: existing GM12878 rows get cell_type='GM12878' and pc1_score=pc1_gm12878
UPDATE regulatory.hic_compartment
SET cell_type = 'GM12878', pc1_score = pc1_gm12878
WHERE cell_type IS NULL AND pc1_gm12878 IS NOT NULL;

-- Index on cell_type for filtered queries
CREATE INDEX IF NOT EXISTS idx_hic_compartment_cell
    ON regulatory.hic_compartment (layer_id, build, cell_type);

COMMIT;
