-- 050_tad_domains.sql
-- TAD (Topologically Associating Domain) calls from ENCODE 4 Hi-C.
-- Arrowhead contact domains (Juicer Tools v2.13.06), native GRCh38.
-- Initial cell types: GM12878, K562, H1-hESC.
-- Source: ENCODE portal (encodeproject.org).

BEGIN;

ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'tad_domain';

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS regulatory.tad_domains (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    layer_id          uuid NOT NULL REFERENCES registry.layers(id),
    build             genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open)
    chr_id            smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos         int NOT NULL,
    end_pos           int NOT NULL,
    coord             int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- Domain metadata
    cell_type         text NOT NULL,         -- e.g. 'GM12878', 'K562', 'H1-hESC'
    resolution_bp     int,                   -- Native resolution (5000, 10000, 25000)
    corner_score      real,                  -- Arrowhead corner score (domain strength)
    uvar_score        real,                  -- Upper variance score
    lvar_score        real,                  -- Lower variance score

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS regulatory.tad_domains_hg38
    PARTITION OF regulatory.tad_domains
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS regulatory.tad_domains_hg38_p0
    PARTITION OF regulatory.tad_domains_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS regulatory.tad_domains_hg38_p1
    PARTITION OF regulatory.tad_domains_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS regulatory.tad_domains_hg38_p2
    PARTITION OF regulatory.tad_domains_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS regulatory.tad_domains_hg38_p3
    PARTITION OF regulatory.tad_domains_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tad_domains_range
    ON regulatory.tad_domains USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_tad_domains_layer_build_cell
    ON regulatory.tad_domains (layer_id, build, cell_type);

-- Grants
GRANT SELECT ON regulatory.tad_domains TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tad_domains TO ingest_writer;
GRANT SELECT ON regulatory.tad_domains_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tad_domains_hg38 TO ingest_writer;
GRANT SELECT ON regulatory.tad_domains_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tad_domains_hg38_p0 TO ingest_writer;
GRANT SELECT ON regulatory.tad_domains_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tad_domains_hg38_p1 TO ingest_writer;
GRANT SELECT ON regulatory.tad_domains_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tad_domains_hg38_p2 TO ingest_writer;
GRANT SELECT ON regulatory.tad_domains_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tad_domains_hg38_p3 TO ingest_writer;

COMMIT;
