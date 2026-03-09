-- 020_gene_profiles.sql
-- Gene Profile System: layered per-gene feature profiles with typed anomaly detection.
-- Four biological layers: intrinsic, regulatory, expression, protein.

-- Transaction 1: extend enum
BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'gene_profile';
COMMIT;

-- Transaction 2: schema + tables
BEGIN;

CREATE SCHEMA IF NOT EXISTS profiles;
GRANT USAGE ON SCHEMA profiles TO api_reader, ingest_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA profiles
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA profiles
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- Gene identity is build-stable, NOT coupled to profile layer_id.
-- One row per protein-coding gene per build. Survives profile recomputation.
CREATE TABLE IF NOT EXISTS profiles.gene_identity (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    build           genome_build NOT NULL,
    ensembl_gene_id text NOT NULL,
    gene_symbol     text NOT NULL,
    chr_id          smallint REFERENCES ref.chromosomes(chr_id),
    start_pos       int,
    end_pos         int,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    strand          char(1),
    canonical_transcript text,
    gene_length_bp  int,
    n_transcripts   smallint,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gene_identity_ensg
    ON profiles.gene_identity (build, ensembl_gene_id);
CREATE INDEX IF NOT EXISTS idx_gene_identity_symbol
    ON profiles.gene_identity (build, upper(gene_symbol));

-- Layer vectors (one row per gene per layer-type per profile version)
CREATE TABLE IF NOT EXISTS profiles.layer_vectors (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    gene_id         bigint NOT NULL REFERENCES profiles.gene_identity(id) ON DELETE CASCADE,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    layer_name      text NOT NULL
        CHECK (layer_name IN ('intrinsic', 'regulatory', 'expression', 'protein')),
    dimension_names text[]   NOT NULL,
    raw_values      real[]   NOT NULL,
    z_scores        real[]   NOT NULL,
    percentiles     real[]   NOT NULL,
    missingness     boolean[] NOT NULL,
    norm            real,
    n_dimensions    smallint NOT NULL,
    n_present       smallint NOT NULL,
    CHECK (array_length(dimension_names, 1) = n_dimensions),
    CHECK (array_length(raw_values, 1) = n_dimensions),
    CHECK (array_length(z_scores, 1) = n_dimensions),
    CHECK (array_length(percentiles, 1) = n_dimensions),
    CHECK (array_length(missingness, 1) = n_dimensions),
    CHECK (n_present <= n_dimensions)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_layer_vectors_gene_layer
    ON profiles.layer_vectors (gene_id, layer_name, layer_id);

-- Pre-computed anomalies (one row per anomaly per gene)
CREATE TABLE IF NOT EXISTS profiles.anomalies (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    gene_id         bigint NOT NULL REFERENCES profiles.gene_identity(id) ON DELETE CASCADE,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    anomaly_type    text NOT NULL
        CHECK (anomaly_type IN ('tail', 'relationship', 'peer', 'regional', 'mismatch')),
    layer_name      text
        CHECK (layer_name IS NULL OR layer_name IN ('intrinsic', 'regulatory', 'expression', 'protein')),
    dimension       text NOT NULL,
    score           real NOT NULL,
    percentile      real,
    direction       text NOT NULL CHECK (direction IN ('high', 'low')),
    context         jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_anomalies_gene
    ON profiles.anomalies (gene_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_type
    ON profiles.anomalies (anomaly_type, layer_name);

-- Metadata: version tracking + provenance manifests
CREATE TABLE IF NOT EXISTS profiles.profile_metadata (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    version_tag     text NOT NULL,
    n_genes         int,
    dimension_manifest jsonb NOT NULL,
    provenance      jsonb NOT NULL DEFAULT '{}',
    regression_manifest jsonb NOT NULL DEFAULT '{}',
    computed_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON ALL TABLES IN SCHEMA profiles TO api_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA profiles TO ingest_writer;

COMMIT;
