-- 032_gene_aliases.sql
-- Gene alias/synonym table: maps ~200K NCBI gene synonyms to canonical GENCODE symbols.
-- Non-partitioned (organism-level, not coordinate-level).

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'gene_alias';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Gene aliases table (non-partitioned, ~150-250K rows)
CREATE TABLE IF NOT EXISTS gene.aliases (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id         uuid NOT NULL REFERENCES registry.layers(id),
    alias            text NOT NULL,
    canonical_symbol text NOT NULL,
    ncbi_gene_id     integer,
    alias_type       text NOT NULL DEFAULT 'synonym'
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_gene_aliases_alias_upper
    ON gene.aliases (UPPER(alias));

CREATE INDEX IF NOT EXISTS idx_gene_aliases_canonical
    ON gene.aliases (canonical_symbol);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gene_aliases_unique
    ON gene.aliases (UPPER(alias), layer_id);

-- 4. Explicit grants
GRANT SELECT ON gene.aliases TO api_reader;
GRANT SELECT, INSERT, UPDATE ON gene.aliases TO ingest_writer;

COMMIT;
