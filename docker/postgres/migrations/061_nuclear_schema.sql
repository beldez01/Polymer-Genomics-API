-- 061_nuclear_schema.sql
-- Nuclear compartment tables: LADs, NADs, DMVs, super-enhancers

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'lad';
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'nad';
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'dmv';
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'super_enhancer';
COMMIT;

BEGIN;

CREATE SCHEMA IF NOT EXISTS nuclear;
GRANT USAGE ON SCHEMA nuclear TO api_reader, ingest_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA nuclear
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA nuclear
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- Lamina-associated domains (Kind et al. 2015)
CREATE TABLE IF NOT EXISTS nuclear.lads (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    lad_type        text,       -- constitutive, facultative
    cell_type       text,
    damid_score     real
);

CREATE INDEX IF NOT EXISTS idx_lad_range ON nuclear.lads USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_lad_layer ON nuclear.lads (layer_id, build);

-- Nucleolus-associated domains (Dillinger et al. 2017)
CREATE TABLE IF NOT EXISTS nuclear.nads (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    cell_type       text,
    enrichment_score real
);

CREATE INDEX IF NOT EXISTS idx_nad_range ON nuclear.nads USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_nad_layer ON nuclear.nads (layer_id, build);

-- DNA Methylation Valleys (Xie et al. 2013)
CREATE TABLE IF NOT EXISTS nuclear.dmvs (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    length_kb       real,
    mean_methylation real,
    nearest_gene    text,
    developmental_tf boolean
);

CREATE INDEX IF NOT EXISTS idx_dmv_range ON nuclear.dmvs USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_dmv_layer ON nuclear.dmvs (layer_id, build);

-- Super-enhancers (dbSUPER)
CREATE TABLE IF NOT EXISTS nuclear.super_enhancers (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id            uuid NOT NULL REFERENCES registry.layers(id),
    build               genome_build NOT NULL,
    chr_id              smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos           int NOT NULL,
    end_pos             int NOT NULL,
    coord               int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    cell_type           text,
    se_rank             int,
    constituent_count   int,
    target_gene         text,
    h3k27ac_signal      real
);

CREATE INDEX IF NOT EXISTS idx_se_range ON nuclear.super_enhancers USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_se_celltype ON nuclear.super_enhancers (cell_type);
CREATE INDEX IF NOT EXISTS idx_se_layer ON nuclear.super_enhancers (layer_id, build);

GRANT SELECT ON ALL TABLES IN SCHEMA nuclear TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nuclear TO ingest_writer;

COMMIT;
