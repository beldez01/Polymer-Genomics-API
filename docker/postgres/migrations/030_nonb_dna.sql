-- 030_nonb_dna.sql
-- Non-B DNA structure predictions at 1kb resolution.
-- Deterministic from sequence: G-quadruplex, Z-DNA, cruciform, R-loop, triplex.
-- Evidence class: D (deterministic transform), Tier: intrinsic.

BEGIN;

-- fragility schema already created in 029

-- 1. Non-B DNA table — partitioned by build, sub-partitioned by chr_id hash
CREATE TABLE IF NOT EXISTS fragility.nonb_dna (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    g4_density      real,         -- G-quadruplex motifs per kb
    z_dna_density   real,         -- Z-DNA forming motifs per kb
    cruciform_density real,       -- inverted repeat / hairpin density per kb
    r_loop_score    real,         -- R-loop forming potential (GC skew × G clustering)
    triplex_density real,         -- H-DNA / triplex motifs per kb
    total_nonb_density real,      -- sum of all non-B densities
    PRIMARY KEY (id, build, chr_id)
) PARTITION BY LIST (build);

-- hg38 partition, sub-partitioned by chr_id hash(4)
CREATE TABLE IF NOT EXISTS fragility.nonb_dna_hg38
    PARTITION OF fragility.nonb_dna FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS fragility.nonb_dna_hg38_p0
    PARTITION OF fragility.nonb_dna_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS fragility.nonb_dna_hg38_p1
    PARTITION OF fragility.nonb_dna_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS fragility.nonb_dna_hg38_p2
    PARTITION OF fragility.nonb_dna_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS fragility.nonb_dna_hg38_p3
    PARTITION OF fragility.nonb_dna_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_nonb_coord
    ON fragility.nonb_dna USING GiST (chr_id, coord);

-- 3. Catalog entry
INSERT INTO reference.catalog
    (table_name, display_name, description, source_citation, row_count)
VALUES
    ('nonb_dna', 'Non-B DNA Structure Predictions',
     'G-quadruplex, Z-DNA, cruciform, R-loop, and triplex density per 1kb window from sequence algorithms',
     'G4Hunter (Bedrat 2016); ZHunt (Ho 1986); sequence-deterministic',
     0)
ON CONFLICT (table_name) DO NOTHING;

-- 4. Explicit grants
GRANT SELECT ON fragility.nonb_dna TO api_reader;
GRANT SELECT, INSERT, UPDATE ON fragility.nonb_dna TO ingest_writer;

COMMIT;
