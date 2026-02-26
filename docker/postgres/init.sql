-- Polymer Genomics API — Full Database Schema
-- Idempotent: safe to re-run (uses IF NOT EXISTS throughout)

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Schemas
-- ============================================================
CREATE SCHEMA IF NOT EXISTS ref;
CREATE SCHEMA IF NOT EXISTS registry;
CREATE SCHEMA IF NOT EXISTS cpg;
CREATE SCHEMA IF NOT EXISTS gene;
CREATE SCHEMA IF NOT EXISTS probe;
CREATE SCHEMA IF NOT EXISTS methylation;
CREATE SCHEMA IF NOT EXISTS storage;

-- ============================================================
-- Roles (idempotent with DO blocks)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'api_reader') THEN
        CREATE ROLE api_reader LOGIN PASSWORD 'api_reader_dev';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ingest_writer') THEN
        CREATE ROLE ingest_writer LOGIN PASSWORD 'ingest_writer_dev';
    END IF;
END
$$;

-- ============================================================
-- Enums
-- ============================================================
DO $$ BEGIN CREATE TYPE genome_build AS ENUM ('hg19','hg38','t2t'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE layer_type AS ENUM ('L0','L1','L2','L3','L3.5'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE license_class AS ENUM ('open','academic','commercial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE storage_location AS ENUM ('postgres','s3'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE probe_platform AS ENUM ('EPIC','EPICv2','450K','MSA','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE mapping_method AS ENUM ('liftover','remap','direct'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE feature_type AS ENUM ('gene','transcript','exon','promoter','enhancer','utr5','utr3','intron'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cpg_context AS ENUM ('island','shore_n','shore_s','shelf_n','shelf_s','open_sea'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE layer_dependency_type AS ENUM ('requires','extends','modifies'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- ref.chromosomes
-- ============================================================
CREATE TABLE IF NOT EXISTS ref.chromosomes (
    chr_id   smallint PRIMARY KEY,
    chr_name text     NOT NULL UNIQUE
);

INSERT INTO ref.chromosomes (chr_id, chr_name) VALUES
    ( 1, 'chr1'),  ( 2, 'chr2'),  ( 3, 'chr3'),  ( 4, 'chr4'),  ( 5, 'chr5'),
    ( 6, 'chr6'),  ( 7, 'chr7'),  ( 8, 'chr8'),  ( 9, 'chr9'),  (10, 'chr10'),
    (11, 'chr11'), (12, 'chr12'), (13, 'chr13'), (14, 'chr14'), (15, 'chr15'),
    (16, 'chr16'), (17, 'chr17'), (18, 'chr18'), (19, 'chr19'), (20, 'chr20'),
    (21, 'chr21'), (22, 'chr22'), (23, 'chrX'),  (24, 'chrY'),  (25, 'chrM')
ON CONFLICT (chr_id) DO NOTHING;

-- ============================================================
-- registry.layers
-- ============================================================
CREATE TABLE IF NOT EXISTS registry.layers (
    layer_id    uuid         DEFAULT uuid_generate_v4() PRIMARY KEY,
    key         text         NOT NULL,
    version     text         NOT NULL,
    layer       layer_type   NOT NULL,
    build       genome_build NOT NULL,
    license     license_class NOT NULL DEFAULT 'open',
    description text,
    source_url  text,
    is_default  boolean      NOT NULL DEFAULT false,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (key, version, build)
);

-- Only one default per (key, build)
CREATE UNIQUE INDEX IF NOT EXISTS one_default_per_key
    ON registry.layers (key, build)
    WHERE is_default = true;

-- ============================================================
-- registry.layer_dependencies
-- ============================================================
CREATE TABLE IF NOT EXISTS registry.layer_dependencies (
    parent_id  uuid NOT NULL REFERENCES registry.layers(layer_id),
    child_id   uuid NOT NULL REFERENCES registry.layers(layer_id),
    dep_type   layer_dependency_type NOT NULL DEFAULT 'requires',
    PRIMARY KEY (parent_id, child_id)
);

-- ============================================================
-- registry.active_layers (view)
-- ============================================================
CREATE OR REPLACE VIEW registry.active_layers AS
    SELECT * FROM registry.layers WHERE is_default = true;

-- ============================================================
-- storage.objects
-- ============================================================
CREATE TABLE IF NOT EXISTS storage.objects (
    object_id   uuid         DEFAULT uuid_generate_v4() PRIMARY KEY,
    layer_id    uuid         NOT NULL REFERENCES registry.layers(layer_id),
    location    storage_location NOT NULL DEFAULT 's3',
    bucket      text,
    key         text         NOT NULL,
    size_bytes  bigint,
    sha256      text,
    content_type text        NOT NULL DEFAULT 'application/octet-stream',
    created_at  timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================
-- gene.features  (PARTITIONED by build, sub-partitioned by chr_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS gene.features (
    feature_id  bigint       GENERATED ALWAYS AS IDENTITY,
    layer_id    uuid         NOT NULL REFERENCES registry.layers(layer_id),
    build       genome_build NOT NULL,
    chr_id      smallint     NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos   int          NOT NULL,
    end_pos     int          NOT NULL,
    coord       int4range    GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    strand      char(1)      NOT NULL CHECK (strand IN ('+', '-', '.')),
    feat_type   feature_type NOT NULL,
    gene_symbol text,
    gene_id     text,
    transcript_id text,
    PRIMARY KEY (build, chr_id, feature_id)
) PARTITION BY LIST (build);

-- hg38 partition for gene.features, sub-partitioned by chr_id
CREATE TABLE IF NOT EXISTS gene.features_hg38
    PARTITION OF gene.features FOR VALUES IN ('hg38')
    PARTITION BY LIST (chr_id);

-- hg19 partition for gene.features, sub-partitioned by chr_id
CREATE TABLE IF NOT EXISTS gene.features_hg19
    PARTITION OF gene.features FOR VALUES IN ('hg19')
    PARTITION BY LIST (chr_id);

-- t2t partition for gene.features, sub-partitioned by chr_id
CREATE TABLE IF NOT EXISTS gene.features_t2t
    PARTITION OF gene.features FOR VALUES IN ('t2t')
    PARTITION BY LIST (chr_id);

-- Create per-chromosome sub-partitions for each build
DO $$
DECLARE
    b text;
    c int;
BEGIN
    FOR b IN SELECT unnest(ARRAY['hg38','hg19','t2t']) LOOP
        FOR c IN 1..25 LOOP
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS gene.features_%s_chr%s PARTITION OF gene.features_%s FOR VALUES IN (%s)',
                b, c, b, c
            );
        END LOOP;
    END LOOP;
END
$$;

-- GiST index on gene.features (created on each leaf partition automatically)
CREATE INDEX IF NOT EXISTS idx_gene_features_coord ON gene.features USING gist (chr_id, coord);

-- ============================================================
-- cpg.islands
-- ============================================================
CREATE TABLE IF NOT EXISTS cpg.islands (
    island_id   bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id    uuid         NOT NULL REFERENCES registry.layers(layer_id),
    build       genome_build NOT NULL,
    chr_id      smallint     NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos   int          NOT NULL,
    end_pos     int          NOT NULL,
    coord       int4range    GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    cpg_count   smallint,
    gc_fraction real,
    obs_exp     real
);

CREATE INDEX IF NOT EXISTS idx_cpg_islands_coord ON cpg.islands USING gist (chr_id, coord);

-- ============================================================
-- cpg.sites  (PARTITIONED by build, sub-partitioned by chr_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS cpg.sites (
    site_id     bigint       GENERATED ALWAYS AS IDENTITY,
    layer_id    uuid         NOT NULL REFERENCES registry.layers(layer_id),
    build       genome_build NOT NULL,
    chr_id      smallint     NOT NULL REFERENCES ref.chromosomes(chr_id),
    pos         int          NOT NULL,
    coord       int4range    GENERATED ALWAYS AS (int4range(pos, pos + 2)) STORED,
    context     cpg_context,
    island_id   bigint,
    PRIMARY KEY (build, chr_id, site_id)
) PARTITION BY LIST (build);

-- hg38 partition for cpg.sites, sub-partitioned by chr_id
CREATE TABLE IF NOT EXISTS cpg.sites_hg38
    PARTITION OF cpg.sites FOR VALUES IN ('hg38')
    PARTITION BY LIST (chr_id);

-- hg19 partition for cpg.sites, sub-partitioned by chr_id
CREATE TABLE IF NOT EXISTS cpg.sites_hg19
    PARTITION OF cpg.sites FOR VALUES IN ('hg19')
    PARTITION BY LIST (chr_id);

-- t2t partition for cpg.sites, sub-partitioned by chr_id
CREATE TABLE IF NOT EXISTS cpg.sites_t2t
    PARTITION OF cpg.sites FOR VALUES IN ('t2t')
    PARTITION BY LIST (chr_id);

-- Create per-chromosome sub-partitions for each build
DO $$
DECLARE
    b text;
    c int;
BEGIN
    FOR b IN SELECT unnest(ARRAY['hg38','hg19','t2t']) LOOP
        FOR c IN 1..25 LOOP
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS cpg.sites_%s_chr%s PARTITION OF cpg.sites_%s FOR VALUES IN (%s)',
                b, c, b, c
            );
        END LOOP;
    END LOOP;
END
$$;

CREATE INDEX IF NOT EXISTS idx_cpg_sites_coord ON cpg.sites USING gist (chr_id, coord);

-- ============================================================
-- probe.coordinates  (PARTITIONED by build only)
-- ============================================================
CREATE TABLE IF NOT EXISTS probe.coordinates (
    probe_row_id bigint       GENERATED ALWAYS AS IDENTITY,
    layer_id     uuid         NOT NULL REFERENCES registry.layers(layer_id),
    build        genome_build NOT NULL,
    platform     probe_platform NOT NULL,
    probe_id     text         NOT NULL,
    chr_id       smallint     NOT NULL REFERENCES ref.chromosomes(chr_id),
    pos          int          NOT NULL,
    coord        int4range    GENERATED ALWAYS AS (int4range(pos, pos + 1)) STORED,
    strand       char(1)      CHECK (strand IN ('+', '-', '.')),
    map_method   mapping_method,
    PRIMARY KEY (build, probe_row_id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS probe.coordinates_hg38
    PARTITION OF probe.coordinates FOR VALUES IN ('hg38');
CREATE TABLE IF NOT EXISTS probe.coordinates_hg19
    PARTITION OF probe.coordinates FOR VALUES IN ('hg19');
CREATE TABLE IF NOT EXISTS probe.coordinates_t2t
    PARTITION OF probe.coordinates FOR VALUES IN ('t2t');

-- Unique constraint: one mapping per layer+build+probe
CREATE UNIQUE INDEX IF NOT EXISTS idx_probe_layer_build_id
    ON probe.coordinates (layer_id, build, probe_id);

-- ============================================================
-- probe.map_edges
-- ============================================================
CREATE TABLE IF NOT EXISTS probe.map_edges (
    edge_id     bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    src_layer_id uuid        NOT NULL REFERENCES registry.layers(layer_id),
    dst_layer_id uuid        NOT NULL REFERENCES registry.layers(layer_id),
    src_probe_id text        NOT NULL,
    dst_probe_id text        NOT NULL,
    map_method   mapping_method NOT NULL,
    confidence   real         CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_map_edges_src ON probe.map_edges (src_layer_id, src_probe_id);
CREATE INDEX IF NOT EXISTS idx_map_edges_dst ON probe.map_edges (dst_layer_id, dst_probe_id);

-- ============================================================
-- methylation.atlas_layers
-- ============================================================
CREATE TABLE IF NOT EXISTS methylation.atlas_layers (
    atlas_layer_id uuid      DEFAULT uuid_generate_v4() PRIMARY KEY,
    layer_id       uuid      NOT NULL REFERENCES registry.layers(layer_id),
    tissue         text      NOT NULL,
    cell_type      text,
    sample_count   int,
    storage_ref    uuid      REFERENCES storage.objects(object_id),
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ref.isochores
-- ============================================================
CREATE TABLE IF NOT EXISTS ref.isochores (
    isochore_id bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id    uuid         NOT NULL REFERENCES registry.layers(layer_id),
    build       genome_build NOT NULL,
    chr_id      smallint     NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos   int          NOT NULL,
    end_pos     int          NOT NULL,
    coord       int4range    GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    family      text         NOT NULL CHECK (family IN ('L1','L2','H1','H2','H3')),
    gc_fraction real         NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_isochores_coord ON ref.isochores USING gist (chr_id, coord);

-- ============================================================
-- GRANTS
-- ============================================================

-- api_reader: SELECT only on all schemas
GRANT USAGE ON SCHEMA ref        TO api_reader;
GRANT USAGE ON SCHEMA registry   TO api_reader;
GRANT USAGE ON SCHEMA cpg        TO api_reader;
GRANT USAGE ON SCHEMA gene       TO api_reader;
GRANT USAGE ON SCHEMA probe      TO api_reader;
GRANT USAGE ON SCHEMA methylation TO api_reader;
GRANT USAGE ON SCHEMA storage    TO api_reader;

GRANT SELECT ON ALL TABLES IN SCHEMA ref         TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA registry    TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA cpg         TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA gene        TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA probe       TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA methylation TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA storage     TO api_reader;

-- ingest_writer: SELECT on ref/registry, INSERT+UPDATE on data schemas
GRANT USAGE ON SCHEMA ref        TO ingest_writer;
GRANT USAGE ON SCHEMA registry   TO ingest_writer;
GRANT USAGE ON SCHEMA cpg        TO ingest_writer;
GRANT USAGE ON SCHEMA gene       TO ingest_writer;
GRANT USAGE ON SCHEMA probe      TO ingest_writer;
GRANT USAGE ON SCHEMA methylation TO ingest_writer;
GRANT USAGE ON SCHEMA storage    TO ingest_writer;

GRANT SELECT ON ALL TABLES IN SCHEMA ref      TO ingest_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA registry TO ingest_writer;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA cpg         TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA gene        TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA probe       TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA methylation TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA storage     TO ingest_writer;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA ref         GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA registry    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA cpg         GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA gene        GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA probe       GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA methylation GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage     GRANT SELECT ON TABLES TO api_reader;
