-- 047_hic_compartment.sql
-- Hi-C A/B Compartment Scores: Rao et al. 2014, eigenvector PC1.
-- Native resolution varies (5-25kb); stored at native res, joined via range overlap.
-- Source: GEO GSE63525 (open access).

BEGIN;

ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'hic_compartment';

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS regulatory.hic_compartment (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    layer_id          uuid NOT NULL REFERENCES registry.layers(id),
    build             genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open)
    chr_id            smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos         int NOT NULL,
    end_pos           int NOT NULL,
    coord             int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- Compartment scores
    pc1_gm12878      real,     -- PC1 eigenvector (positive = A/active, negative = B/inactive)
    resolution_bp     int,      -- Native resolution in bp (e.g., 5000, 10000, 25000)

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS regulatory.hic_compartment_hg38
    PARTITION OF regulatory.hic_compartment
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS regulatory.hic_compartment_hg38_p0
    PARTITION OF regulatory.hic_compartment_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS regulatory.hic_compartment_hg38_p1
    PARTITION OF regulatory.hic_compartment_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS regulatory.hic_compartment_hg38_p2
    PARTITION OF regulatory.hic_compartment_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS regulatory.hic_compartment_hg38_p3
    PARTITION OF regulatory.hic_compartment_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hic_compartment_range
    ON regulatory.hic_compartment USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_hic_compartment_layer_build
    ON regulatory.hic_compartment (layer_id, build);

-- Grants
GRANT SELECT ON regulatory.hic_compartment TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.hic_compartment TO ingest_writer;
GRANT SELECT ON regulatory.hic_compartment_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.hic_compartment_hg38 TO ingest_writer;
GRANT SELECT ON regulatory.hic_compartment_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.hic_compartment_hg38_p0 TO ingest_writer;
GRANT SELECT ON regulatory.hic_compartment_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.hic_compartment_hg38_p1 TO ingest_writer;
GRANT SELECT ON regulatory.hic_compartment_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.hic_compartment_hg38_p2 TO ingest_writer;
GRANT SELECT ON regulatory.hic_compartment_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.hic_compartment_hg38_p3 TO ingest_writer;

COMMIT;
