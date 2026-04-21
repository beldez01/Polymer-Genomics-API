-- Migration 007: Recurrent cancer breakpoints (multi-source)
--
-- Creates oncology.recurrent_breakpoints. Powers Exp 23 cancer-orphan cohort.
-- Designed to coexist with fragility.breakpoints (which holds curated Mitelman
-- + HumCFS named fragile sites); this table is for the large-scale SV catalogs.
--
-- Primary source for Exp 23: Chen et al. 2021, PLOS Computational Biology
--   "Comprehensive analysis of cancer breakpoints reveals signatures of
--    genetic and epigenetic contribution to cancer genome rearrangements"
--   PMC7951985 — ~630,000 breakpoint events
--
-- Secondary source (pre-registered replication, pending DACO): PCAWG consensus SVs.
-- Tertiary (sensitivity): full Mitelman database.
--
-- Evidence class: M (measured via WGS + cytogenetics); recurrence count is D (derived).

CREATE SCHEMA IF NOT EXISTS oncology;

CREATE TABLE IF NOT EXISTS oncology.recurrent_breakpoints (
    id                BIGSERIAL PRIMARY KEY,
    layer_id          UUID REFERENCES registry.layers(id),
    build             genome_build NOT NULL,
    chr_id            SMALLINT NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos         INT NOT NULL,
    end_pos           INT NOT NULL,
    sv_type           VARCHAR(16),      -- 'DEL', 'DUP', 'INV', 'TRA', 'INS', 'BND', 'UNK'
    recurrence_count  INT,              -- how many tumors had a breakpoint in this window
    tumor_types       TEXT,             -- pipe-separated list of tumor types affected
    mate_chr_id       SMALLINT REFERENCES ref.chromosomes(chr_id),
    mate_start        INT,              -- for TRA / BND: partner coordinate
    mate_end          INT,
    source            VARCHAR(64) NOT NULL,  -- 'Chen2021_630K' | 'PCAWG_consensus' | 'Mitelman_full'
    source_id         VARCHAR(128),
    metadata          JSONB,            -- source-specific extra fields
    UNIQUE (build, chr_id, start_pos, end_pos, sv_type, source)
);

CREATE INDEX IF NOT EXISTS rcbp_pos_idx
    ON oncology.recurrent_breakpoints (chr_id, start_pos, end_pos);

CREATE INDEX IF NOT EXISTS rcbp_source_idx
    ON oncology.recurrent_breakpoints (source);

CREATE INDEX IF NOT EXISTS rcbp_recurrence_idx
    ON oncology.recurrent_breakpoints (recurrence_count)
    WHERE recurrence_count IS NOT NULL;

CREATE INDEX IF NOT EXISTS rcbp_sv_type_idx
    ON oncology.recurrent_breakpoints (sv_type);

COMMENT ON TABLE oncology.recurrent_breakpoints IS
    'Multi-source cancer structural variant breakpoint catalog. Primary: Chen 2021 (~630K). '
    'Secondary: PCAWG consensus. Tertiary: Mitelman full. Evidence: M for observed breaks, D for recurrence.';
