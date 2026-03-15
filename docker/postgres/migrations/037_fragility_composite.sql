-- 037_fragility_composite.sql
-- Composite fragility score combining non-B DNA, biophysics, breakpoint proximity

CREATE TABLE IF NOT EXISTS fragility.composite_score (
    id bigint GENERATED ALWAYS AS IDENTITY,
    layer_id uuid NOT NULL REFERENCES registry.layers(id),
    build genome_build NOT NULL,
    chr_id smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos int NOT NULL,
    end_pos int NOT NULL,
    coord int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- Component scores (0-1 normalized)
    nonb_component real,
    curvature_component real,
    stacking_component real,
    breakpoint_proximity real,

    -- Composite
    fragility_score real NOT NULL,
    fragility_class text,

    PRIMARY KEY (id, build, chr_id)
) PARTITION BY LIST (build);

-- hg38 partitions
CREATE TABLE IF NOT EXISTS fragility.composite_score_hg38
    PARTITION OF fragility.composite_score FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS fragility.composite_score_hg38_p0
    PARTITION OF fragility.composite_score_hg38 FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS fragility.composite_score_hg38_p1
    PARTITION OF fragility.composite_score_hg38 FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS fragility.composite_score_hg38_p2
    PARTITION OF fragility.composite_score_hg38 FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS fragility.composite_score_hg38_p3
    PARTITION OF fragility.composite_score_hg38 FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- GiST index for range queries
CREATE INDEX IF NOT EXISTS idx_fragility_composite_range
    ON fragility.composite_score USING gist (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_fragility_composite_layer
    ON fragility.composite_score (layer_id, build);

-- Permissions
GRANT SELECT ON ALL TABLES IN SCHEMA fragility TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA fragility TO ingest_writer;
