-- Migration 006: UCSC Segmental Duplications track
--
-- Creates structural.segmental_duplications. Used by Exp 23 orphan filters
-- M4 / C3 to remove breakpoints in NAHR-prone configurations.
--
-- Source: UCSC Genome Browser genomicSuperDups track (Bailey et al. 2001 / 2002)
--   Download: https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/
--   Table: genomicSuperDups
-- License: UCSC public (free use).
-- Evidence class: K (curated).

CREATE SCHEMA IF NOT EXISTS structural;

CREATE TABLE IF NOT EXISTS structural.segmental_duplications (
    id             BIGSERIAL PRIMARY KEY,
    layer_id       UUID REFERENCES registry.layers(id),
    build          genome_build NOT NULL,
    chr_id         SMALLINT NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos      INT NOT NULL,
    end_pos        INT NOT NULL,
    match_chr_id   SMALLINT REFERENCES ref.chromosomes(chr_id),
    match_start    INT,
    match_end      INT,
    strand         CHAR(1),
    frac_match     REAL,          -- fraction matching (0.0-1.0)
    jc_k           REAL,          -- Jukes-Cantor distance
    seg_len        INT,
    name           VARCHAR(64),
    UNIQUE (build, chr_id, start_pos, end_pos, match_chr_id, match_start, match_end)
);

CREATE INDEX IF NOT EXISTS segdups_pos_idx
    ON structural.segmental_duplications (chr_id, start_pos, end_pos);

CREATE INDEX IF NOT EXISTS segdups_match_idx
    ON structural.segmental_duplications (match_chr_id, match_start, match_end);

CREATE INDEX IF NOT EXISTS segdups_frac_idx
    ON structural.segmental_duplications (frac_match);

COMMENT ON TABLE structural.segmental_duplications IS
    'UCSC genomicSuperDups track: paired segmental duplications ≥ 1 kb with '
    '≥ 90% identity. Source: Bailey 2001/2002; UCSC hg38. Evidence: K (curated).';
