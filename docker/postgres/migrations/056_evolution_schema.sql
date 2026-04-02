-- 056_evolution_schema.sql
-- Creates the evolution schema for deep-time genomic layers.
-- First table: ultraconserved elements (Bejerano et al. 2004).

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'ultraconserved';
COMMIT;

BEGIN;

CREATE SCHEMA IF NOT EXISTS evolution;
GRANT USAGE ON SCHEMA evolution TO api_reader, ingest_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA evolution
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA evolution
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

CREATE TABLE IF NOT EXISTS evolution.ultraconserved_elements (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos   int NOT NULL,
    end_pos     int NOT NULL,
    coord       int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    uce_name    text,
    length_bp   int,
    category    text  -- exonic, intronic, intergenic
);

CREATE INDEX IF NOT EXISTS idx_uce_range
    ON evolution.ultraconserved_elements USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_uce_layer_build
    ON evolution.ultraconserved_elements (layer_id, build);

GRANT SELECT ON evolution.ultraconserved_elements TO api_reader;
GRANT SELECT, INSERT, UPDATE ON evolution.ultraconserved_elements TO ingest_writer;

COMMIT;
