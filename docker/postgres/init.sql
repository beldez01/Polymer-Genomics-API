-- Polymer Genomics API — Full Database Schema
-- Idempotent: safe to re-run (uses IF NOT EXISTS / DO blocks)

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
-- Roles
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

-- Role guardrails
ALTER ROLE api_reader SET statement_timeout = '30s';
ALTER ROLE api_reader SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE api_reader SET work_mem = '64MB';
ALTER ROLE api_reader SET temp_file_limit = '256MB';

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE genome_build AS ENUM ('hg37', 'hg38');
CREATE TYPE layer_type AS ENUM (
    'genome', 'gene_model', 'cpg', 'probe', 'methylation', 'isochore'
);
CREATE TYPE license_class AS ENUM (
    'public_domain', 'derived', 'restricted', 'proprietary'
);
CREATE TYPE storage_location AS ENUM (
    'postgres', 'object_storage', 'both'
);
CREATE TYPE probe_platform AS ENUM ('450k', 'epic_v1', 'epic_v2');
CREATE TYPE mapping_method AS ENUM (
    'exact_id', 'coord_overlap', 'liftover', 'sequence_match'
);
CREATE TYPE feature_type AS ENUM (
    'gene', 'transcript', 'exon', 'intron', 'cds', 'utr5', 'utr3',
    'start_codon', 'stop_codon', 'promoter', 'gene_body'
);
CREATE TYPE cpg_context AS ENUM (
    'island', 'n_shore', 's_shore', 'n_shelf', 's_shelf', 'open_sea'
);
CREATE TYPE layer_dependency_type AS ENUM (
    'derived_from', 'lifted_from', 'filtered_from'
);

-- ============================================================
-- ref.chromosomes
-- ============================================================
CREATE TABLE ref.chromosomes (
    chr_id      smallint PRIMARY KEY,
    chr_name    text NOT NULL UNIQUE,
    length_hg37 int,
    length_hg38 int
);

INSERT INTO ref.chromosomes (chr_id, chr_name) VALUES
    ( 1, 'chr1'),  ( 2, 'chr2'),  ( 3, 'chr3'),  ( 4, 'chr4'),  ( 5, 'chr5'),
    ( 6, 'chr6'),  ( 7, 'chr7'),  ( 8, 'chr8'),  ( 9, 'chr9'),  (10, 'chr10'),
    (11, 'chr11'), (12, 'chr12'), (13, 'chr13'), (14, 'chr14'), (15, 'chr15'),
    (16, 'chr16'), (17, 'chr17'), (18, 'chr18'), (19, 'chr19'), (20, 'chr20'),
    (21, 'chr21'), (22, 'chr22'), (23, 'chrX'),  (24, 'chrY'),  (25, 'chrM');

-- ============================================================
-- registry.layers
-- ============================================================
CREATE TABLE registry.layers (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    layer_key       text NOT NULL,
    version         text NOT NULL,
    name            text NOT NULL,
    layer_type      layer_type NOT NULL,
    genome_build    genome_build NOT NULL,
    source          text NOT NULL,
    license_class   license_class NOT NULL,
    license_uri     text,
    storage_type    storage_location NOT NULL,
    row_count       bigint,
    content_hash    text,
    is_active       boolean DEFAULT true,
    is_default      boolean DEFAULT false,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    metadata        jsonb,
    UNIQUE (layer_key, version)
);

-- Exactly one default per layer family
CREATE UNIQUE INDEX one_default_per_key
    ON registry.layers (layer_key)
    WHERE is_default = true AND is_active = true;

-- ============================================================
-- registry.layer_dependencies
-- ============================================================
CREATE TABLE registry.layer_dependencies (
    layer_id        uuid REFERENCES registry.layers(id),
    depends_on_id   uuid REFERENCES registry.layers(id),
    relationship    layer_dependency_type NOT NULL,
    PRIMARY KEY (layer_id, depends_on_id)
);

-- ============================================================
-- registry.active_layers (view)
-- ============================================================
CREATE VIEW registry.active_layers AS
SELECT * FROM registry.layers
WHERE is_active = true AND is_default = true;

-- ============================================================
-- storage.objects
-- ============================================================
CREATE TABLE storage.objects (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    provider        text NOT NULL DEFAULT 'aws_s3',
    bucket          text NOT NULL,
    key             text NOT NULL,
    region          text,
    etag            text,
    version_id      text,
    content_hash    text,
    size_bytes      bigint,
    file_type       text NOT NULL,
    description     text,
    created_at      timestamptz DEFAULT now(),
    UNIQUE (provider, bucket, key)
);

-- ============================================================
-- gene.features (PARTITIONED by build, sub-partitioned by chr_id)
-- ============================================================
CREATE TABLE gene.features (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    strand          char(1) CHECK (strand IN ('+', '-')),
    gene_symbol     text NOT NULL,
    gene_id         text,
    transcript_id   text,
    feature_type    feature_type NOT NULL,
    PRIMARY KEY (id, build, chr_id)
) PARTITION BY LIST (build);

CREATE TABLE gene.features_hg38 PARTITION OF gene.features
    FOR VALUES IN ('hg38') PARTITION BY LIST (chr_id);
CREATE TABLE gene.features_hg37 PARTITION OF gene.features
    FOR VALUES IN ('hg37') PARTITION BY LIST (chr_id);

-- Per-chromosome sub-partitions + GiST indexes
DO $$
DECLARE
    b text;
    c int;
BEGIN
    FOR b IN SELECT unnest(ARRAY['hg38','hg37']) LOOP
        FOR c IN 1..25 LOOP
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS gene.features_%s_chr%s PARTITION OF gene.features_%s FOR VALUES IN (%s)',
                b, c, b, c
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_gene_%s_chr%s_coord ON gene.features_%s_chr%s USING GiST (chr_id, coord)',
                b, c, b, c
            );
        END LOOP;
    END LOOP;
END
$$;

CREATE INDEX idx_gene_symbol ON gene.features (gene_symbol);
CREATE INDEX idx_gene_type ON gene.features (feature_type, build, chr_id);

-- ============================================================
-- cpg.islands (small table, no partitioning needed)
-- ============================================================
CREATE TABLE cpg.islands (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos   int NOT NULL,
    end_pos     int NOT NULL,
    coord       int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    island_name text
);

CREATE INDEX idx_cpg_islands_range ON cpg.islands USING GiST (chr_id, coord);

-- ============================================================
-- cpg.sites (PARTITIONED by build, sub-partitioned by chr_id)
-- ============================================================
CREATE TABLE cpg.sites (
    id          bigint GENERATED ALWAYS AS IDENTITY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    pos         int NOT NULL,
    coord       int4range GENERATED ALWAYS AS (int4range(pos, pos + 2)) STORED,
    island_id   bigint,
    context     cpg_context,
    gc_content  real,
    PRIMARY KEY (id, build, chr_id)
) PARTITION BY LIST (build);

CREATE TABLE cpg.sites_hg38 PARTITION OF cpg.sites
    FOR VALUES IN ('hg38') PARTITION BY LIST (chr_id);
CREATE TABLE cpg.sites_hg37 PARTITION OF cpg.sites
    FOR VALUES IN ('hg37') PARTITION BY LIST (chr_id);

-- Per-chromosome sub-partitions + GiST indexes
DO $$
DECLARE
    b text;
    c int;
BEGIN
    FOR b IN SELECT unnest(ARRAY['hg38','hg37']) LOOP
        FOR c IN 1..25 LOOP
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS cpg.sites_%s_chr%s PARTITION OF cpg.sites_%s FOR VALUES IN (%s)',
                b, c, b, c
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_cpg_sites_%s_chr%s_coord ON cpg.sites_%s_chr%s USING GiST (chr_id, coord)',
                b, c, b, c
            );
        END LOOP;
    END LOOP;
END
$$;

-- ============================================================
-- probe.coordinates (PARTITIONED by build only)
-- ============================================================
CREATE TABLE probe.coordinates (
    id          bigint GENERATED ALWAYS AS IDENTITY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    probe_id    text NOT NULL,
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    pos         int NOT NULL,
    coord       int4range GENERATED ALWAYS AS (int4range(pos, pos + 1)) STORED,
    gene_symbol text,
    cpg_context cpg_context,
    PRIMARY KEY (id, build),
    UNIQUE (layer_id, build, probe_id)
) PARTITION BY LIST (build);

CREATE TABLE probe.coordinates_hg38 PARTITION OF probe.coordinates
    FOR VALUES IN ('hg38');
CREATE TABLE probe.coordinates_hg37 PARTITION OF probe.coordinates
    FOR VALUES IN ('hg37');

CREATE INDEX idx_probe_id ON probe.coordinates (probe_id);
CREATE INDEX idx_probe_coord ON probe.coordinates USING GiST (chr_id, coord);

-- ============================================================
-- probe.map_edges
-- ============================================================
CREATE TABLE probe.map_edges (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    src_platform    probe_platform NOT NULL,
    src_probe_id    text NOT NULL,
    dst_platform    probe_platform NOT NULL,
    dst_probe_id    text NOT NULL,
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL,
    pos             int NOT NULL,
    method          mapping_method NOT NULL,
    confidence      real NOT NULL DEFAULT 1.0
        CHECK (confidence >= 0.0 AND confidence <= 1.0),
    UNIQUE (src_platform, src_probe_id, dst_platform, dst_probe_id, build)
);

CREATE INDEX idx_map_edges_src ON probe.map_edges (src_platform, src_probe_id);
CREATE INDEX idx_map_edges_dst ON probe.map_edges (dst_platform, dst_probe_id);

-- ============================================================
-- methylation.atlas_layers
-- ============================================================
CREATE TABLE methylation.atlas_layers (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    cell_type       text NOT NULL,
    build           genome_build NOT NULL,
    bigwig_ref      uuid REFERENCES storage.objects(id),
    parquet_ref     uuid REFERENCES storage.objects(id),
    summary_ref     uuid REFERENCES storage.objects(id),
    n_samples       int,
    mean_coverage   real,
    metadata        jsonb
);

-- ============================================================
-- ref.isochores
-- ============================================================
CREATE TABLE ref.isochores (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    gc_content      real NOT NULL,
    isochore_class  text NOT NULL CHECK (isochore_class IN ('L1', 'L2', 'H1', 'H2', 'H3'))
);

CREATE INDEX idx_isochore_range ON ref.isochores USING GiST (chr_id, coord);

-- ============================================================
-- GRANTS
-- ============================================================

-- api_reader: SELECT only on all schemas
GRANT USAGE ON SCHEMA ref, registry, cpg, gene, probe, methylation, storage TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA ref         TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA registry    TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA cpg         TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA gene        TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA probe       TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA methylation TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA storage     TO api_reader;

-- ingest_writer: SELECT on ref/registry, SELECT+INSERT+UPDATE on data schemas
GRANT USAGE ON SCHEMA ref, registry, cpg, gene, probe, methylation, storage TO ingest_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA ref      TO ingest_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA registry TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA cpg         TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA gene        TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA probe       TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA methylation TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA registry    TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA storage     TO ingest_writer;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA ref         GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA registry    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA cpg         GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA gene        GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA probe       GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA methylation GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage     GRANT SELECT ON TABLES TO api_reader;
