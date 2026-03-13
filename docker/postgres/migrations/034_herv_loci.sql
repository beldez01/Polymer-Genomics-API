-- 034_herv_loci.sql
-- Telescope HERV proviral loci layer (~15K intact proviral loci).
-- Source: Telescope HERV annotation v2 (Bendall et al., MIT license).

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'herv';

COMMIT;

-- New transaction (enum values visible after COMMIT)
BEGIN;

-- 2. HERV proviral loci table
CREATE TABLE IF NOT EXISTS annotation.herv_loci (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open internally)
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- Strand
    strand          char(1),

    -- HERV locus identity
    locus_id        text NOT NULL,           -- Telescope gene_id (e.g. 'HERVK_1q22')
    subfamily       text NOT NULL,           -- ERV subfamily (e.g. 'HERVK', 'HERV9', 'THE1')
    n_fragments     int NOT NULL DEFAULT 1,  -- number of LTR/internal fragments
    locus_length    int NOT NULL,            -- end - start

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

-- hg38 partition, sub-partitioned by chromosome hash
CREATE TABLE IF NOT EXISTS annotation.herv_loci_hg38
    PARTITION OF annotation.herv_loci
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

-- 4 hash sub-partitions
CREATE TABLE IF NOT EXISTS annotation.herv_loci_hg38_p0
    PARTITION OF annotation.herv_loci_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS annotation.herv_loci_hg38_p1
    PARTITION OF annotation.herv_loci_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS annotation.herv_loci_hg38_p2
    PARTITION OF annotation.herv_loci_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS annotation.herv_loci_hg38_p3
    PARTITION OF annotation.herv_loci_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_herv_loci_range
    ON annotation.herv_loci USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_herv_loci_subfamily
    ON annotation.herv_loci (subfamily);

CREATE INDEX IF NOT EXISTS idx_herv_loci_layer_build
    ON annotation.herv_loci (layer_id, build);

-- 4. Explicit grants
GRANT SELECT ON annotation.herv_loci TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.herv_loci TO ingest_writer;
GRANT SELECT ON annotation.herv_loci_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.herv_loci_hg38 TO ingest_writer;
GRANT SELECT ON annotation.herv_loci_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.herv_loci_hg38_p0 TO ingest_writer;
GRANT SELECT ON annotation.herv_loci_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.herv_loci_hg38_p1 TO ingest_writer;
GRANT SELECT ON annotation.herv_loci_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.herv_loci_hg38_p2 TO ingest_writer;
GRANT SELECT ON annotation.herv_loci_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON annotation.herv_loci_hg38_p3 TO ingest_writer;

COMMIT;
