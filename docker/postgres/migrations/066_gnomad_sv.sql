-- 066_gnomad_sv.sql
-- gnomAD v4 structural variants.
-- ~800K SVs with allele frequency, type, and consequence annotations.
-- Source: gnomad.broadinstitute.org, ODC-ODbL 1.0.

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'structural_variant';
COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS variation.structural_variants (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    sv_id           text,
    sv_type         text NOT NULL,
    sv_length       int,
    allele_count    int,
    allele_number   int,
    allele_freq     real,
    homozygote_count int,
    popmax_af       real,
    popmax_pop      text,
    filter_status   text,
    consequence     text,
    gene_symbol     text,
    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS variation.structural_variants_hg38
    PARTITION OF variation.structural_variants FOR VALUES IN ('hg38')
    PARTITION BY LIST (chr_id);

DO $$ BEGIN
FOR i IN 1..25 LOOP
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS variation.structural_variants_hg38_chr%s
         PARTITION OF variation.structural_variants_hg38 FOR VALUES IN (%s)',
        i, i
    );
END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_sv_range
    ON variation.structural_variants USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_sv_type
    ON variation.structural_variants (sv_type);
CREATE INDEX IF NOT EXISTS idx_sv_gene
    ON variation.structural_variants (gene_symbol);
CREATE INDEX IF NOT EXISTS idx_sv_layer_build
    ON variation.structural_variants (layer_id, build);

GRANT SELECT ON ALL TABLES IN SCHEMA variation TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA variation TO ingest_writer;

COMMIT;
