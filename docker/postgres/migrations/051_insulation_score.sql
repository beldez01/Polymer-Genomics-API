-- 051_insulation_score.sql
-- Diamond insulation scores from 4D Nucleome.
-- Continuous signal at 5kb resolution (cooltools v0.2.0).
-- Negative = TAD boundary, positive/zero = domain interior.
-- Source: 4DN data portal (data.4dnucleome.org).

BEGIN;

ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'insulation_score';

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS regulatory.insulation_score (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    layer_id          uuid NOT NULL REFERENCES registry.layers(id),
    build             genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open)
    chr_id            smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos         int NOT NULL,
    end_pos           int NOT NULL,
    coord             int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- Insulation data
    cell_type         text NOT NULL,
    insulation_score  real,           -- log2 diamond insulation (negative = boundary)
    resolution_bp     int,            -- 5000 or 10000

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS regulatory.insulation_score_hg38
    PARTITION OF regulatory.insulation_score
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS regulatory.insulation_score_hg38_p0
    PARTITION OF regulatory.insulation_score_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS regulatory.insulation_score_hg38_p1
    PARTITION OF regulatory.insulation_score_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS regulatory.insulation_score_hg38_p2
    PARTITION OF regulatory.insulation_score_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS regulatory.insulation_score_hg38_p3
    PARTITION OF regulatory.insulation_score_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insulation_score_range
    ON regulatory.insulation_score USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_insulation_score_layer_build_cell
    ON regulatory.insulation_score (layer_id, build, cell_type);

-- Grants
GRANT SELECT ON regulatory.insulation_score TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.insulation_score TO ingest_writer;
GRANT SELECT ON regulatory.insulation_score_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.insulation_score_hg38 TO ingest_writer;
GRANT SELECT ON regulatory.insulation_score_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.insulation_score_hg38_p0 TO ingest_writer;
GRANT SELECT ON regulatory.insulation_score_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.insulation_score_hg38_p1 TO ingest_writer;
GRANT SELECT ON regulatory.insulation_score_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.insulation_score_hg38_p2 TO ingest_writer;
GRANT SELECT ON regulatory.insulation_score_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.insulation_score_hg38_p3 TO ingest_writer;

COMMIT;
