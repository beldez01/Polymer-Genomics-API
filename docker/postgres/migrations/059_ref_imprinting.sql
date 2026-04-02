-- 059_ref_imprinting.sql
-- Imprinted gene and ICR reference tables.
-- Source: geneimprint.com, Monk et al. 2019 Nat Rev Genet, Court et al. 2014.

CREATE TABLE IF NOT EXISTS ref.imprinted_genes (
    gene_symbol      text PRIMARY KEY,
    expressed_allele text NOT NULL,   -- 'maternal' or 'paternal'
    imprint_status   text NOT NULL,   -- 'confirmed' or 'predicted'
    chromosome       text,
    associated_icr   text
);

CREATE TABLE IF NOT EXISTS ref.imprinted_icrs (
    icr_name          text PRIMARY KEY,
    build             genome_build NOT NULL,
    chr_id            smallint REFERENCES ref.chromosomes(chr_id),
    start_pos         int,
    end_pos           int,
    coord             int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    methylated_allele text,       -- 'maternal' or 'paternal'
    regulated_genes   text[]
);

CREATE INDEX IF NOT EXISTS idx_icr_range
    ON ref.imprinted_icrs USING GiST (chr_id, coord);

GRANT SELECT ON ref.imprinted_genes TO api_reader;
GRANT SELECT ON ref.imprinted_icrs TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ref.imprinted_genes TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ref.imprinted_icrs TO ingest_writer;
