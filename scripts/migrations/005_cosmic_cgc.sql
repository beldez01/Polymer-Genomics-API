-- Migration 005: COSMIC Cancer Gene Census (Tier 1 + Tier 2)
--
-- Creates oncology.cosmic_cgc. Used by Exp 23 cancer-orphan filter step C5 to
-- remove breakpoints within ±50 kb of any driver locus.
--
-- Source: COSMIC Cancer Gene Census
--   https://cancer.sanger.ac.uk/census
-- License: COSMIC academic license required for download (free for non-commercial).
-- Evidence class: K (curated).

CREATE SCHEMA IF NOT EXISTS oncology;

CREATE TABLE IF NOT EXISTS oncology.cosmic_cgc (
    id                       SERIAL PRIMARY KEY,
    layer_id                 UUID REFERENCES registry.layers(id),
    gene_symbol              VARCHAR(32) NOT NULL,
    entrez_id                INT,
    chromosome               VARCHAR(16),
    genome_start             INT,
    genome_end               INT,
    build                    VARCHAR(10),
    tier                     SMALLINT NOT NULL CHECK (tier IN (1, 2)),
    hallmark                 BOOLEAN  DEFAULT FALSE,
    somatic                  BOOLEAN  DEFAULT FALSE,
    germline                 BOOLEAN  DEFAULT FALSE,
    tumor_types_somatic      TEXT,
    tumor_types_germline     TEXT,
    cancer_syndrome          TEXT,
    tissue_type              TEXT,
    molecular_genetics       VARCHAR(16),   -- 'Dom', 'Rec'
    role_in_cancer           TEXT,          -- 'oncogene', 'TSG', 'fusion', etc.
    mutation_types           TEXT,
    translocation_partner    TEXT,
    source_version           VARCHAR(32),   -- e.g. 'v100_GRCh38'
    UNIQUE (gene_symbol, source_version)
);

CREATE INDEX IF NOT EXISTS cosmic_cgc_gene_idx ON oncology.cosmic_cgc (gene_symbol);
CREATE INDEX IF NOT EXISTS cosmic_cgc_pos_idx  ON oncology.cosmic_cgc (chromosome, genome_start);
CREATE INDEX IF NOT EXISTS cosmic_cgc_tier_idx ON oncology.cosmic_cgc (tier);

COMMENT ON TABLE oncology.cosmic_cgc IS
    'COSMIC Cancer Gene Census, Tier 1 + Tier 2 driver genes with somatic / germline '
    'annotations and translocation partners. Evidence: K (curated).';
