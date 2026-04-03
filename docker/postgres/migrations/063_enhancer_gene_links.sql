-- 063_enhancer_gene_links.sql
-- ABC model enhancer-gene predictions (Nasser et al. 2021)
-- Also adds archaic methylation table to evolution schema

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'enhancer_gene';
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'archaic_methylation';
COMMIT;

BEGIN;

-- Enhancer-gene links (regulatory schema already exists)
CREATE TABLE IF NOT EXISTS regulatory.enhancer_gene_links (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    target_gene     text,
    target_gene_tss int,
    cell_type       text,
    abc_score       real,
    distance        int,
    class           text,       -- intergenic, genic, promoter
    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS regulatory.enhancer_gene_links_hg38
    PARTITION OF regulatory.enhancer_gene_links FOR VALUES IN ('hg38')
    PARTITION BY LIST (chr_id);

DO $$ BEGIN
FOR i IN 1..25 LOOP
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS regulatory.enhancer_gene_links_hg38_chr%s
         PARTITION OF regulatory.enhancer_gene_links_hg38 FOR VALUES IN (%s)',
        i, i
    );
END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_egl_range
    ON regulatory.enhancer_gene_links USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_egl_gene
    ON regulatory.enhancer_gene_links (target_gene);
CREATE INDEX IF NOT EXISTS idx_egl_layer
    ON regulatory.enhancer_gene_links (layer_id, build);

GRANT SELECT ON ALL TABLES IN SCHEMA regulatory TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA regulatory TO ingest_writer;

-- Archaic methylation (Gokhman et al. 2014, 2020)
CREATE TABLE IF NOT EXISTS evolution.archaic_methylation (
    id                      bigint GENERATED ALWAYS AS IDENTITY,
    layer_id                uuid NOT NULL REFERENCES registry.layers(id),
    build                   genome_build NOT NULL,
    chr_id                  smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos               int NOT NULL,
    end_pos                 int NOT NULL,
    coord                   int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    species                 text NOT NULL,  -- neanderthal, denisovan, modern_human
    methylation_level       real,
    confidence              text,           -- high, medium, low
    dmr_id                  text,
    direction_vs_modern     text,           -- hyper, hypo
    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS evolution.archaic_methylation_hg38
    PARTITION OF evolution.archaic_methylation FOR VALUES IN ('hg38')
    PARTITION BY LIST (chr_id);

DO $$ BEGIN
FOR i IN 1..25 LOOP
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS evolution.archaic_methylation_hg38_chr%s
         PARTITION OF evolution.archaic_methylation_hg38 FOR VALUES IN (%s)',
        i, i
    );
END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_archaic_meth_range
    ON evolution.archaic_methylation USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_archaic_meth_species
    ON evolution.archaic_methylation (species);
CREATE INDEX IF NOT EXISTS idx_archaic_meth_layer
    ON evolution.archaic_methylation (layer_id, build);

GRANT SELECT ON ALL TABLES IN SCHEMA evolution TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA evolution TO ingest_writer;

COMMIT;
