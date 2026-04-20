-- Migration 004: PRDM9 motif catalog
--
-- Creates recombination.prdm9_motifs table. Stores two complementary sources:
--   1. Altemose et al. 2017 experimentally validated PRDM9 binding peaks (ChIP-seq)
--   2. Myers 2008 13-mer PWM matches scanned against hg38 (A/B/C alleles)
--
-- Source citations:
--   Myers S. et al. "Drive against hotspot motifs in primates implicates the
--     PRDM9 gene in meiotic recombination." Science 327, 876-879 (2010).
--   Altemose N. et al. "A map of human PRDM9 binding provides evidence for novel
--     behaviors of PRDM9 and its role in the histone methylation landscape."
--     eLife 6:e28383 (2017).
--
-- Evidence class: M for ChIP-seq peaks, D for PWM-derived motif matches.

-- recombination schema is assumed to exist (created by earlier palsson / pratto migrations).

CREATE TABLE IF NOT EXISTS recombination.prdm9_motifs (
    id             BIGSERIAL PRIMARY KEY,
    layer_id       UUID     REFERENCES registry.layers(id),
    build          genome_build NOT NULL,
    chr_id         SMALLINT NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos      INT      NOT NULL,
    end_pos        INT      NOT NULL,
    strand         CHAR(1),
    allele         VARCHAR(16),   -- 'A', 'B', 'C', 'A-like', or 'validated'
    source         VARCHAR(64) NOT NULL,   -- 'altemose_2017_chipseq' | 'myers_2008_pwm'
    score          REAL,          -- peak intensity OR PWM log-odds
    source_id      VARCHAR(128),
    UNIQUE (build, chr_id, start_pos, end_pos, source, allele)
);

CREATE INDEX IF NOT EXISTS prdm9_motifs_pos_idx
    ON recombination.prdm9_motifs (chr_id, start_pos, end_pos);

CREATE INDEX IF NOT EXISTS prdm9_motifs_source_idx
    ON recombination.prdm9_motifs (source, allele);

COMMENT ON TABLE recombination.prdm9_motifs IS
    'PRDM9 binding catalog: Altemose 2017 experimentally validated peaks (hg38) '
    'and Myers 2008 13-mer PWM matches (A/B/C alleles). Evidence: M for peaks, D for PWM.';
