# Polymer Genomics API — V1 Design Document

**Date:** 2026-02-25
**Status:** Approved (brainstorming complete)
**Project:** `/Users/zbb2/Desktop/PolymerGenomicsAPI/`

---

## 1. Problem Statement

Multi-agent genomic analysis workflows (Polymer IDE, Polymer Evolution) suffer from:
- Redundant downloads of reference data (genomes, probe manifests, ENCODE tracks)
- Scattered, hardcoded file paths across projects and phases
- No canonical source of truth for curated genomic annotations
- Every session starts with data acquisition tax instead of science

**Solution:** A standalone, cloud-hosted genomic reference database with a REST API (OpenAPI 3.1) that gives agents and bioinformaticians instant, indexed access to curated genomic data.

## 2. V1 Scope

**Reference/annotation data only.** No user-generated data, no experiment storage, no analysis pipelines.

### V1 Data Layers

| Layer | Type | Build | Storage | Est. Rows | Est. Size |
|---|---|---|---|---|---|
| `hg38_sequence` | genome | hg38 | object_storage | — | ~3.1 GB |
| `hg37_sequence` | genome | hg37 | object_storage | — | ~3.0 GB |
| `gencode_v44` | gene_model | both | postgres | ~2.7M | ~500 MB |
| `isochores_hg38` | isochore | hg38 | postgres | ~3,200 | ~1 MB |
| `isochores_hg37` | isochore | hg37 | postgres | ~3,200 | ~1 MB |
| `cpg_sites_hg38` | cpg | hg38 | postgres | ~28.3M | ~2 GB |
| `cpg_sites_hg37` | cpg | hg37 | postgres | ~28.2M | ~2 GB |
| `cpg_islands` | cpg | both | postgres | ~28K | ~5 MB |
| `probe_450k` | probe | both | postgres | ~485K | ~100 MB |
| `probe_epic_v1` | probe | both | postgres | ~866K | ~180 MB |
| `probe_epic_v2` | probe | both | postgres | ~935K | ~200 MB |
| `probe_crossmap` | probe | both | postgres | ~400K edges | ~80 MB |
| `meth_monocyte` | methylation | hg38 | both | manifest in PG | Parquet+BigWig |
| `meth_neutrophil` | methylation | hg38 | both | manifest in PG | Parquet+BigWig |
| `meth_bcell` | methylation | hg38 | both | manifest in PG | Parquet+BigWig |
| `meth_cd4t` | methylation | hg38 | both | manifest in PG | Parquet+BigWig |
| `meth_cd8t` | methylation | hg38 | both | manifest in PG | Parquet+BigWig |
| `meth_nk` | methylation | hg38 | both | manifest in PG | Parquet+BigWig |

**Totals:** ~8-12 GB PostgreSQL, ~15-25 GB object storage.

### Subscription Tiers (Future)

- **Tier 1:** Reference/annotation access (V1)
- **Tier 2:** Personal integrated storage
- **Tier 3:** TBD (expanded)

### Illumina Probe Licensing

Derive, don't redistribute. Serve derived mappings (probe ID → genomic coordinates → gene → CpG context). Exclude Illumina's proprietary design columns. Coordinates are factual and not copyrightable.

### Legal Notes

- Genome sequences (hg37/hg38): public domain (NIH policy)
- ENCODE data: free for commercial use (post-embargo)
- Published methylation atlases: reusable from publications
- UCSC annotations: mixed licensing — verify per-track
- Illumina manifests: restricted redistribution — derived data only

## 3. Architecture

### Hybrid: PostgreSQL + Object Storage

```
Client (Agent via MCP / R via client package / Browser via viewer)
    │
    ▼
FastAPI (OpenAPI 3.1)
    ├── Metadata + interval queries → PostgreSQL (read replica)
    │     (genes, probes, CpG sites/islands, isochores, layer registry)
    ├── Bulk data → Presigned URLs → S3/R2
    │     (FASTA, BigWig, Parquet, RDS exports)
    └── /viewer → Static SPA (Next.js)
```

**PostgreSQL** answers "where are things?" — indexed intervals, probe mappings, gene models, layer registry, provenance.

**Object storage** stores "big payloads" — FASTA, BigWig tracks, methylation matrices, Parquet exports. Returned via presigned URLs.

### Three Consumers (Priority Order)

1. **Agents** (via MCP wrapper) — composable, join-friendly endpoints
2. **R/Bioconductor** (via `polymergenomics` client package) — responses map to S4 objects (GRanges, DataFrame)
3. **Viewer UI** — tile and aggregation endpoints

## 4. Hard Architecture Invariants

```
1. No LLM/agent process ever holds DB credentials.
2. The API is the ONLY process with DB access.
3. All endpoints map to parameterized SQL or stored procedures.
4. No general query endpoint. Ever.
5. API connects to read replica for all hot-path queries.
6. Internal coordinate convention: 0-based half-open [start, end).
7. External coordinate convention: 1-based closed [start, end].
8. Conversion happens at exactly one layer: the API serializer.
```

### DB Roles

| Role | Access | Used By |
|---|---|---|
| `api_reader` | Read-only, restricted schemas, read replica | API service (hot path) |
| `ingest_writer` | Write-only to staging + merge procedures | Data pipeline |
| `admin` | Schema migrations, index maintenance | Human-only |

### Role-Level Guardrails

```sql
ALTER ROLE api_reader SET statement_timeout = '30s';
ALTER ROLE api_reader SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE api_reader SET work_mem = '64MB';
ALTER ROLE api_reader SET temp_file_limit = '256MB';
```

**Debug mode:** Time-limited, staging DB only, shows executed SQL in real-time, requires human click-through. Never in production.

## 5. Data Model

### Enums & Constrained Types

```sql
CREATE TYPE genome_build AS ENUM ('hg37', 'hg38');
CREATE TYPE layer_type AS ENUM (
    'genome', 'gene_model', 'cpg', 'probe',
    'methylation', 'isochore'
);
CREATE TYPE license_class AS ENUM (
    'public_domain', 'derived', 'restricted', 'proprietary'
);
CREATE TYPE storage_location AS ENUM (
    'postgres', 'object_storage', 'both'
);
CREATE TYPE probe_platform AS ENUM (
    '450k', 'epic_v1', 'epic_v2'
);
CREATE TYPE mapping_method AS ENUM (
    'exact_id', 'coord_overlap', 'liftover', 'sequence_match'
);
CREATE TYPE feature_type AS ENUM (
    'exon', 'intron', 'UTR5', 'UTR3', 'promoter', 'gene_body'
);
CREATE TYPE cpg_context AS ENUM (
    'island', 'n_shore', 's_shore', 'n_shelf', 's_shelf', 'open_sea'
);
CREATE TYPE layer_dependency_type AS ENUM (
    'derived_from', 'lifted_from', 'filtered_from'
);
```

### Chromosome Reference

```sql
CREATE TABLE ref.chromosomes (
    chr_id      smallint PRIMARY KEY,   -- 1-22, 23=X, 24=Y, 25=M
    chr_name    text NOT NULL UNIQUE,   -- 'chr1'..'chrM'
    length_hg37 int,
    length_hg38 int
);
```

### Layer Registry

```sql
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
    content_hash    text,               -- SHA-256 of canonical export
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

-- Dependency graph
CREATE TABLE registry.layer_dependencies (
    layer_id        uuid REFERENCES registry.layers(id),
    depends_on_id   uuid REFERENCES registry.layers(id),
    relationship    layer_dependency_type NOT NULL,
    PRIMARY KEY (layer_id, depends_on_id)
);

-- Current active version of each layer family
CREATE VIEW registry.active_layers AS
SELECT * FROM registry.layers
WHERE is_active = true AND is_default = true;
```

### Object Storage References

```sql
CREATE TABLE storage.objects (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    provider        text NOT NULL DEFAULT 'aws_s3',
    bucket          text NOT NULL,
    key             text NOT NULL,
    region          text,
    etag            text,
    version_id      text,
    content_hash    text,               -- SHA-256
    size_bytes      bigint,
    file_type       text NOT NULL,      -- parquet|bigwig|fasta_gz|bed_gz|rds
    description     text,
    created_at      timestamptz DEFAULT now(),

    UNIQUE (provider, bucket, key)
);
```

### Core Interval Tables

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

**Invariant:** Every partition gets a GiST(chr_id, coord) index. The ingestion pipeline creates partitions + indexes automatically. No hand-created per-chr partitions.

#### CpG Sites

```sql
CREATE TABLE cpg.sites (
    id          bigint GENERATED ALWAYS AS IDENTITY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    pos         int NOT NULL,           -- 0-based, the C position
    coord       int4range GENERATED ALWAYS AS (int4range(pos, pos + 2)) STORED,
    island_id   int,
    context     cpg_context,
    gc_content  real,
    PRIMARY KEY (id, build, chr_id)
) PARTITION BY LIST (build);

CREATE TABLE cpg.sites_hg38 PARTITION OF cpg.sites
    FOR VALUES IN ('hg38') PARTITION BY LIST (chr_id);
CREATE TABLE cpg.sites_hg37 PARTITION OF cpg.sites
    FOR VALUES IN ('hg37') PARTITION BY LIST (chr_id);

-- Per-chromosome partitions created by ingestion pipeline:
--   CREATE TABLE cpg.sites_hg38_chr{N} PARTITION OF cpg.sites_hg38
--       FOR VALUES IN ({N});
--   CREATE INDEX ON cpg.sites_hg38_chr{N} USING GiST (chr_id, coord);
```

#### Gene Features

```sql
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
    gene_id         text,               -- ENSG...
    transcript_id   text,               -- ENST...
    feature_type    feature_type NOT NULL,
    PRIMARY KEY (id, build, chr_id)
) PARTITION BY LIST (build);

CREATE INDEX idx_gene_symbol ON gene.features (gene_symbol);
CREATE INDEX idx_gene_type ON gene.features (feature_type, build, chr_id);
```

#### Probe Coordinates (Derived)

```sql
CREATE TABLE probe.coordinates (
    id          bigint GENERATED ALWAYS AS IDENTITY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    probe_id    text NOT NULL,
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    pos         int NOT NULL,           -- 0-based, interrogated C
    coord       int4range GENERATED ALWAYS AS (int4range(pos, pos + 1)) STORED,
    gene_symbol text,
    cpg_context cpg_context,
    PRIMARY KEY (id, build),

    UNIQUE (layer_id, build, probe_id)
) PARTITION BY LIST (build);
```

#### Crossmap: Edge Table

```sql
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
```

#### Methylation Atlas (Manifest Only in Postgres)

```sql
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
```

### Materialized Views (Version-Safe)

```sql
CREATE MATERIALIZED VIEW mv_epicv2_in_islands AS
SELECT p.probe_id, p.chr_id, p.pos, i.island_name, i.start_pos, i.end_pos
FROM probe.coordinates p
JOIN cpg.islands i ON p.chr_id = i.chr_id AND i.coord @> p.coord
WHERE p.layer_id = (
    SELECT id FROM registry.active_layers
    WHERE layer_key = 'probe_epic_v2'
)
AND p.build = 'hg38';

CREATE MATERIALIZED VIEW mv_epicv2_in_promoters AS
SELECT p.probe_id, p.chr_id, p.pos, g.gene_symbol, g.transcript_id
FROM probe.coordinates p
JOIN gene.features g ON p.chr_id = g.chr_id AND g.coord @> p.coord
WHERE g.feature_type = 'promoter'
  AND p.layer_id = (
    SELECT id FROM registry.active_layers
    WHERE layer_key = 'probe_epic_v2'
  )
AND p.build = 'hg38';

-- Refresh: triggered by ingest pipeline, never runtime
-- CONCURRENTLY to avoid blocking readers
```

### Object Storage Layout

```
s3://polymer-genomics-api/
├── genomes/
│   ├── hg37/chr{1..22,X,Y,M}.fa.gz
│   └── hg38/chr{1..22,X,Y,M}.fa.gz
├── methylation/
│   ├── atlas/
│   │   ├── monocyte_hg38.bw
│   │   ├── monocyte_hg38.parquet
│   │   ├── neutrophil_hg38.bw
│   │   ├── neutrophil_hg38.parquet
│   │   └── ...
│   └── summary/
│       ├── hematopoietic_mean_10kb.parquet
│       └── hematopoietic_variance_10kb.parquet
├── tracks/
│   ├── isochores_hg38.bw
│   └── cpg_density_hg38.bw
└── exports/
    └── (pre-serialized RDS, bulk Parquet exports)
```

## 6. API Contracts

### Contract 1: Coordinate Convention

**Internal (PostgreSQL):** 0-based half-open `[start, end)`
**External (API responses):** 1-based closed `[start, end]`

Conversion at exactly one layer: the API serializer.

```
PostgreSQL [s, e)  →  API serializer: s_out = s_db + 1, e_out = e_db  →  Client [s, e]
```

Inbound queries accept both conventions:
```
GET /regions/hg38/chr16:70699930-70699931              # default: 1-based
GET /regions/hg38/chr16:70699929-70699931?coords=0based  # BED-style
```

Response always 1-based closed. Every response includes `"coordinate_system": "1-based_closed"`.

**R client never converts.** Receives 1-based closed, passes directly to `IRanges(start=, end=)`.

**CI test invariant:**
```
For every feature at internal [s, e):
  API returns start = s + 1, end = e, width = e - s
  round-trip: query(start=s+1, end=e) → same feature
```

### Contract 2: Pagination

**Sort key:** `(chr_id, pos, layer_id, id)` — deterministic, stable across requests.

Multi-layer region queries: interleaved by position (genome order), not grouped by layer.

Cursor-based only. No offset/skip. Cursors encode last-seen tuple.

```json
{
  "pagination": {
    "cursor": "base64({chr_id:16, pos:70699930, layer_id:'abc', id:99281})",
    "has_more": true,
    "total_estimate": 284000,
    "sort": ["chr_id", "pos", "layer_id", "id"],
    "direction": "asc"
  }
}
```

- Immutable layer cursors: valid indefinitely within same version
- Active layer cursors: 10 minutes
- Default page size: 1,000. Max: 50,000.

### Contract 3: Response Envelope

Every data response uses this envelope:

```json
{
  "status": "complete|paginated|truncated|partial",
  "coordinate_system": "1-based_closed",
  "query": {
    "build": "hg38",
    "region": {"chr": "chr16", "start": 70699930, "end": 70700000},
    "layers_requested": ["cpg_sites", "probe_epic_v2"],
    "coords_input": "1based"
  },
  "layers_resolved": [
    {
      "layer_key": "cpg_sites",
      "version": "1.0",
      "layer_id": "uuid-abc",
      "content_hash": "sha256:def..."
    }
  ],
  "data": { ... },
  "pagination": { ... },
  "timing": {
    "query_time_ms": 28,
    "db_time_ms": 22
  }
}
```

**Status field (truncation signal):**

| Status | Meaning |
|---|---|
| `complete` | All results returned |
| `paginated` | More results exist, follow cursor |
| `truncated` | Hit max_returned_rows cap, use narrower region or /bulk |
| `partial` | One or more layers failed/timed out, layers_resolved shows which |

`layers_resolved` is the reproducibility contract — same hashes = same results.

### Contract 4: Tiling Scheme

Fixed grid, deterministic:
```
tile_start = tile_index × resolution
tile_end   = tile_start + resolution
tile_index = floor(position / resolution)
```

Supported resolutions: 1,000 | 10,000 | 100,000 | 1,000,000 bp (enum, not arbitrary).

- Empty tiles return `{"data": {}, "n": 0}`, not 404
- Immutable layer tiles: `Cache-Control: public, immutable`
- Coarse tiles are NOT pre-aggregated — same features, wider region
- Multi-resolution consistency: `data(tile 7069, 10kb) = union(tiles 70690..70699, 1kb)`

### Contract 5: Bulk Integrity

Every bulk download response carries:
```json
{
  "content_hash": "sha256:abc123...",
  "size_bytes": 195000000,
  "row_count": 935000,
  "format": "rds",
  "layer_version": "1.0",
  "generated_at": "2026-02-25T00:00:00Z"
}
```

R client verifies hash after download. Fail loud on mismatch.

### Contract 6: Deterministic Search

- Exact match > prefix > fuzzy. No opaque relevance scoring.
- Stable ordering: type (gene > probe > island), then alphabetical.
- Explicit `"match"` type in response (`exact`, `prefix`, `gene_association`).
- No fuzzy by default. Agents get exact + prefix unless `?fuzzy=true`.

## 7. API Query Budget

```yaml
query_limits:
  max_region_length: 10_000_000    # 10 Mb
  max_returned_rows: 50_000
  max_query_time_ms: 30_000
  pagination: cursor_based
  rate_limits:
    tier_1_free:   100 req/min
    tier_1_paid:   1000 req/min
    tier_2:        5000 req/min
    tier_3:        negotiated
  caching:
    immutable_layers: "Cache-Control: public, max-age=86400, immutable"
    active_layers:    "Cache-Control: public, max-age=3600"
    user_data:        "Cache-Control: private, no-store"

db_guardrails:
  hot_path: read_replica_only
  statement_timeout: 30s
  idle_in_transaction: 60s
  work_mem: 64MB
  temp_file_limit: 256MB
```

## 8. API Surface

### Response Format Negotiation

| Accept Header | Format | Consumer |
|---|---|---|
| `application/json` (default) | JSON, GRanges-structured | Agents, general |
| `application/x-granges+json` | JSON with explicit S4 slot mapping | R client package |
| `text/tab-separated-values` | TSV, BED-like | Shell scripts |

GRanges JSON format:
```json
{
  "class": "GRanges",
  "seqnames": ["chr16", ...],
  "ranges": {"start": [...], "end": [...], "width": [...]},
  "strand": ["*", ...],
  "seqinfo": {"genome": "hg38", "seqlengths": {"chr16": 90338345}},
  "mcols": { ... }
}
```

### Endpoint Groups

#### 8.1 Layers — Discovery & Toggle

```
GET  /v1/layers
GET  /v1/layers/{layer_key}
GET  /v1/layers/{layer_key}/versions
GET  /v1/layers/{layer_key}/stats
```

#### 8.2 Region Queries — The Core Primitive

```
GET  /v1/regions/{build}/{chr}:{start}-{end}?layers={csv}
GET  /v1/regions/{build}/{chr}:{start}-{end}/features
GET  /v1/regions/{build}/{chr}:{start}-{end}/cpg
GET  /v1/regions/{build}/{chr}:{start}-{end}/probes
GET  /v1/regions/{build}/{chr}:{start}-{end}/methylation?cell_types={csv}
```

The `layers` parameter is the toggle mechanism. Omit → all active defaults. Specify → exactly those.

Methylation endpoint: summary stats inline, full per-CpG betas via presigned URL.

#### 8.3 Gene Queries — Symbol-First Lookups

```
GET  /v1/genes/{symbol}?build={build}
GET  /v1/genes/{symbol}/region
GET  /v1/genes/{symbol}/probes?platform={platform}
GET  /v1/genes/{symbol}/cpg
GET  /v1/genes/{symbol}/methylation?cell_types={csv}
GET  /v1/genes/search?q={partial}
```

#### 8.4 Probe Queries — Platform-Aware

```
GET  /v1/probes/{probe_id}
GET  /v1/probes/{probe_id}/crossmap
GET  /v1/probes/search?chr={chr}&start={start}&end={end}&platform={platform}
POST /v1/probes/batch                       -- up to 10K probe IDs
POST /v1/probes/crossmap/batch              -- batch platform translation
```

#### 8.5 Aggregation — Never Ship Raw Unless Asked

```
GET  /v1/agg/{build}/{chr}:{start}-{end}/probe_density?bin_size={bp}
GET  /v1/agg/{build}/{chr}:{start}-{end}/cpg_density?bin_size={bp}
GET  /v1/agg/{build}/{chr}:{start}-{end}/methylation_summary?cell_types={csv}&bin_size={bp}
GET  /v1/agg/{build}/{chr}:{start}-{end}/gc_content?bin_size={bp}
GET  /v1/agg/{build}/genome_wide?metric={metric}&bin_size={bp}
```

#### 8.6 Tile Endpoints — Viewer & Agent Ergonomics

```
GET  /v1/tiles/{build}/{chr}/{tile_index}?resolution={bp}&layers={csv}
```

#### 8.7 Bulk Download — Presigned URLs

```
GET  /v1/bulk/{layer_key}?build={build}&format={parquet|rds|bigwig}
GET  /v1/bulk/methylation/{cell_type}?build={build}&format={parquet|bigwig}
GET  /v1/bulk/crossmap?src={platform}&dst={platform}&format={parquet|tsv}
```

`format=rds` serves pre-serialized S4 GRanges. R client does `readRDS(url(...))`.

#### 8.8 Isochore Queries

```
GET  /v1/isochores/{build}/{chr}:{start}-{end}
GET  /v1/isochores/{build}/classify?gc={value}
```

#### 8.9 Search — Cross-Layer

```
GET  /v1/search?q={term}&build={build}&fuzzy={bool}
```

### Error Responses

```json
{
  "error": {
    "code": "REGION_TOO_LARGE",
    "message": "Region exceeds maximum of 10Mb.",
    "limit": 10000000,
    "requested": 50000000
  }
}
```

Standard codes: `REGION_TOO_LARGE`, `LAYER_NOT_FOUND`, `BUILD_MISMATCH`, `RATE_LIMITED`, `INVALID_PROBE_ID`, `PAGINATION_EXPIRED`.

## 9. R Client Package: `polymergenomics`

Thin R package wrapping the API, returning proper S4 objects.

```r
library(polymergenomics)
pg_connect(api_key = Sys.getenv("POLYMER_API_KEY"))

gr     <- pg_region("hg38", "chr16", 70699930, 70700000,
                    layers = c("cpg_sites", "probe_epic_v2"))
probes <- pg_probes("cg08796240")
meth   <- pg_methylation("hg38", "chr16", 70699930, 70700000,
                         cell_types = c("monocyte", "neutrophil"))
xmap   <- pg_crossmap(c("cg00000029", "cg00000108"),
                      from = "450k", to = "epic_v2")
epic   <- pg_bulk("probe_epic_v2", build = "hg38")
vac14  <- pg_gene("VAC14", build = "hg38")
```

**Package handles:** Authentication, format negotiation, GRanges/DataFrame construction, cursor pagination, local caching (respects Cache-Control), presigned URL fetching, hash verification.

## 10. MCP Wrapper

MCP server exposes each endpoint group as a tool:

- `list_layers` — discover available data
- `query_region` — region lookup with layer toggles
- `lookup_gene` — gene model + probes + CpG + methylation
- `lookup_probe` — probe coordinates + crossmap
- `crossmap_probes` — batch platform translation
- `aggregate_region` — binned summary statistics
- `search` — cross-layer search
- `bulk_download` — presigned URL for full layer

## 11. Minimal Genome Viewer

### Tech Stack

| Component | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Track Renderer | Custom Canvas |
| State | Zustand |
| Styling | Tailwind |

### Viewport Model

Resolution auto-selects from visible region width:

| Visible Region | Resolution |
|---|---|
| < 50 kb | 1 kb |
| 50 kb - 500 kb | 10 kb |
| 500 kb - 5 Mb | 100 kb |
| > 5 Mb | 1 Mb |

### V1 Tracks

1. **Isochore Band** — colored horizontal bands (L1→H3)
2. **Gene Model** — exon bars, intron lines, strand arrows
3. **CpG Islands** — green blocks
4. **CpG Sites** — tick marks (fine zoom) / density histogram (coarse zoom)
5. **Probe Track** — inverted triangles, color-coded by platform
6. **Methylation Heatmap** — blue→red gradient, one row per cell type

### Data Flow

```
Viewport pan/zoom → calculate tile indices → fetch uncached tiles
→ cache in Map (LRU, ~500 tiles) → canvas render per track
```

Prefetch: 2 tiles in each direction for smooth panning.

### Routes

```
/                           → Landing: search + build selector
/view/{build}/{region}      → Viewer (deep-linkable)
```

### What the Viewer Does NOT Do (V1)

No custom track upload, no analysis, no screenshots, no bookmarks, no multi-region comparison, no user accounts.

## 12. Storage Estimates

| Component | Size |
|---|---|
| PostgreSQL (intervals + indexes) | ~8-12 GB |
| Object storage (FASTA + BigWig + Parquet) | ~15-25 GB |
| **Total V1** | **~25-35 GB** |
