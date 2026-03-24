-- 046_mutation_density.sql
-- Somatic Mutation Density Layer: PCAWG pan-cancer, 1kb bins.
-- Source: PCAWG open-tier (ICGC/TCGA, syn7364923).

BEGIN;

ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'mutation_density';

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS annotation.mutation_density (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    layer_id          uuid NOT NULL REFERENCES registry.layers(id),
    build             genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open, 1kb bins)
    chr_id            smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos         int NOT NULL,
    end_pos           int NOT NULL,
    coord             int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- Mutation rates (mutations per Mb per sample, normalized)
    pan_cancer_rate   real,     -- All cancer types combined
    snv_rate          real,     -- Single nucleotide variants
    indel_rate        real,     -- Insertions/deletions
    sv_rate           real,     -- Structural variants (breakpoints)

    -- Per-type rates (PCAWG categories)
    liver_rate        real,     -- Liver-HCC
    lung_rate         real,     -- Lung-AdenoCA + Lung-SCC
    skin_rate         real,     -- Skin-Melanoma (high TMB)
    blood_rate        real,     -- Lymph-BNHL + Lymph-CLL

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS annotation.mutation_density_hg38
    PARTITION OF annotation.mutation_density
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS annotation.mutation_density_hg38_p0
    PARTITION OF annotation.mutation_density_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS annotation.mutation_density_hg38_p1
    PARTITION OF annotation.mutation_density_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS annotation.mutation_density_hg38_p2
    PARTITION OF annotation.mutation_density_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS annotation.mutation_density_hg38_p3
    PARTITION OF annotation.mutation_density_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mutation_density_range
    ON annotation.mutation_density USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_mutation_density_layer_build
    ON annotation.mutation_density (layer_id, build);

-- Grants
GRANT SELECT ON annotation.mutation_density TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.mutation_density TO ingest_writer;
GRANT SELECT ON annotation.mutation_density_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.mutation_density_hg38 TO ingest_writer;
GRANT SELECT ON annotation.mutation_density_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.mutation_density_hg38_p0 TO ingest_writer;
GRANT SELECT ON annotation.mutation_density_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.mutation_density_hg38_p1 TO ingest_writer;
GRANT SELECT ON annotation.mutation_density_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.mutation_density_hg38_p2 TO ingest_writer;
GRANT SELECT ON annotation.mutation_density_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.mutation_density_hg38_p3 TO ingest_writer;

COMMIT;
