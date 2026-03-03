# Gene Bioenergetic Cost Layer — Implementation Plan

**Status: COMPLETE (2026-03-02)**

## Context

Integrate 20,431 genes of established bioenergetic metrics (Akashi-Gojobori amino acid costs, CAI, tAI, GTEx EWGC) into the Polymer Genomics API and genome browser. Data asset: `reference_gene_cost_table_v3.tsv` (93 columns, 20,431 rows).

Full-stack: PostgreSQL schema + ingest → FastAPI query/router → MCP tool → Next.js canvas track + context panel.

## Architectural Compatibility Audit

After exhaustive codebase review, here are all integration points and how gene_costs aligns:

### 1. Enum Extension
The `layer_type` enum has 6 values: `genome, gene_model, cpg, probe, methylation, isochore`. Adding `'gene_cost'` via `ALTER TYPE ... ADD VALUE IF NOT EXISTS` is safe and follows the same pattern the init.sql uses for other enum values.

### 2. Dispatch System (TRACK_REGISTRY pattern)

The codebase uses a `TRACK_REGISTRY` dict in `queries.py` with `query_fn` and `convert_fn` per layer type. Region and tile routers iterate over this registry automatically — no changes needed to `regions.py` or `tiles.py`.

| System | File | What to add |
|--------|------|-------------|
| `TRACK_REGISTRY["gene_cost"]` | `queries.py` | `query_fn` + `convert_fn` entry |
| `_aggregation_query()` | `aggregation.py` | `elif layer_type == "gene_cost":` branch |

### 3. Partition Whitelist
`ingest/partitions.py` has `ALLOWED_SCHEMAS` and `ALLOWED_TABLES` frozensets. Added `'bioenergetics'` to `ALLOWED_SCHEMAS` and `'gene_costs'` to `ALLOWED_TABLES`.

### 4. Table Design — No Partitioning
20K rows. Non-partitioned like `ref.isochores` (~30K rows). GiST index on `(chr_id, coord)` is sufficient.

### 5. Coordinate Convention
DB stores 0-based half-open. Gene coordinates resolved from `gene.features` (already in this convention). `_convert_gene_cost()` calls `db_to_api()` to produce 1-based closed output.

**Implementation note:** Genomic coordinates are nullable — 412 genes (2.1%) from TSV have no GENCODE match and are stored with NULL chr_id/start_pos/end_pos/strand. They're still queryable by symbol via the detail endpoint.

### 6. Layer Registration
`one_default_per_key` partial unique index enforces one active default per `layer_key`. Ingest checks-and-skips if `gene_costs_v1` already exists for the build (same pattern as `isochores.py`).

### 7. Ingest Pattern
Uses direct `copy_records_to_table` (same as `isochores.py`) rather than `batch_load()` from `loader.py`. The `batch_load` path requires partition validation which is unnecessary for non-partitioned tables. Content hash and layer stats update are deferred (can be added in a follow-up).

### 8. Detail Endpoint
Follows the `probes.py` single-lookup precedent: resolves layer independently via `layer_type = 'gene_cost'` from `registry.active_layers`, returns structured (non-GRanges) data with 7 groups.

### 9. Aggregation
`_aggregation_query()` in `aggregation.py` dispatches per layer type. Added `gene_cost` branch with custom bin fields (`gene_count`, `mean_ecpa`, `total_cost`, `mean_cai`). The bin response builder has a separate code path for gene_cost to emit these fields instead of the generic `count`/`density`/`avg_gc`.

### 10. MCP Tool
Standard pattern: `@mcp.tool()` function calling `_get()` against the REST endpoint.

### 11. Frontend
- `TRACK_REGISTRY` auto-flows through `regions.py` → viewer fetcher → `TrackStack`
- `Sidebar.tsx` fetches layers via API; `gene_costs_v1` auto-appears once registered in DB
- No changes needed to `api.ts` (GRanges type already generic enough)

---

## Implementation Record

### Step 1 — Database Migration

**New file:** `docker/postgres/migrations/003_gene_costs.sql`

- `ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'gene_cost'` (in separate transaction — enum values visible only after COMMIT)
- `CREATE SCHEMA IF NOT EXISTS bioenergetics` + GRANT to `api_reader`/`ingest_writer`
- Default privileges for schema
- `CREATE TABLE bioenergetics.gene_costs` — 89 insertable columns + 2 generated (`id` IDENTITY, `coord` int4range)
  - Identity: `gene_symbol`, `uniprot_id`, `protein_name`
  - Genomic: `chr_id`, `start_pos`, `end_pos`, `coord` (generated), `strand` — all nullable (412 genes lack coordinates)
  - Biosynthetic cost: `ecpa_b20`, `ecpa_h11`, `c_protein`, `c_aa_synthesis`, `c_translation`
  - Elemental: `n_protein`, `s_protein`, `c_atoms`, `mw_kda`, `cost_per_kda`, `n_per_kda`, `s_per_kda`
  - Composition: `frac_cheap`, `frac_moderate`, `frac_expensive`, `frac_very_expensive`, `n_cys`..`n_lys`
  - Codon: `cds_length_nt`, `n_codons`, `gc3`, `gc_cds`, `cai`, `tai`, `enc`, `fop`
  - Expression: `mean_tpm`, `max_tpm` + 24 tissue TPM + 24 tissue EWGC
- Indexes: GiST on `(chr_id, coord)`, btree on `gene_symbol`, btree on `(layer_id, build)`
- GRANT SELECT to `api_reader`, SELECT+INSERT+UPDATE to `ingest_writer`

**Applied:** `docker exec -i polymergenomicsapi-postgres-1 psql -U admin -d polymer_genomics < 003_gene_costs.sql`

### Step 2 — Partition Whitelist Update

**Edit:** `src/polymer_genomics/ingest/partitions.py`

- Added `'bioenergetics'` to `ALLOWED_SCHEMAS` frozenset
- Added `'gene_costs'` to `ALLOWED_TABLES` frozenset

### Step 3 — Ingest Script

**New file:** `src/polymer_genomics/ingest/gene_costs.py`

Key design decisions:
1. **`read_cost_table(tsv_path)`** — `csv.DictReader` with `_HEADER_MAP` dict (93 TSV headers → DB column names). Type-safe parsing via `_safe_int`/`_safe_float` with `_INT_COLS`/`_FLOAT_COLS` sets.
2. **`resolve_gene_coordinates(conn, build)`** — Queries `gene.features` for `feature_type='gene'`, returns uppercase-keyed lookup dict. Does NOT filter by layer_id (takes first match per symbol).
3. **`_build_row()`** — Constructs 89-element tuple matching COLUMNS order. Uses `CAI_correct`/`tAI_correct` for MT genes when available.
4. **Batch loading** — Direct `copy_records_to_table` in 5,000-row batches (matches `isochores.py` pattern).
5. **Unmatched genes** — Stored with NULL coordinates (still queryable by symbol).

**Run:** `uv run python -m polymer_genomics.ingest.gene_costs`

**Result:** 20,306 rows loaded. 19,894 matched coordinates (97.9%), 412 unmatched.

### Step 4 — Track Registry Entry

**Edit:** `src/polymer_genomics/queries.py`

- Added `region_gene_costs_query()` — selects 15 columns: `gene_symbol`, `start_pos`, `end_pos`, `strand`, `protein_length`, `ecpa_b20`, `c_protein`, `n_protein`, `s_protein`, `cai`, `tai`, `mean_tpm`, `max_tpm`, `frac_cheap`, `frac_expensive`
- Added `_convert_gene_cost(rows, chr_name)` — builds GRanges dict with 12 mcols, uses strand from data (not `*`)
- Registered in `TRACK_REGISTRY["gene_cost"]` with both `query_fn` and `convert_fn`
- Regions and tiles routers automatically pick this up — no changes to either

### Step 5 — Gene Cost Detail Endpoint

**New file:** `src/polymer_genomics/routers/gene_costs.py`

Route: `GET /v1/genes/{build}/{symbol}/cost`

- Case-insensitive symbol lookup (`UPPER(gene_symbol) = UPPER($2)`)
- `SELECT *` to get all 89 columns for the full structured response
- 7-group response: `coordinates`, `identity`, `biosynthetic_cost`, `elemental`, `composition`, `codon_optimization`, `expression`
- Expression tissues sorted by EWGC descending (nulls last)
- Coordinates block is null when gene lacks genomic mapping

**Edit:** `src/polymer_genomics/main.py`

- Imported `gene_costs_router` and registered before `genes_router` (the `/cost` suffix disambiguates from existing `/{build}/{symbol}` route)

### Step 6 — Aggregation Extension

**Edit:** `src/polymer_genomics/routers/aggregation.py`

- Added `elif layer_type == "gene_cost":` branch with SQL: `COUNT(*)` as `gene_count`, `AVG(ecpa_b20)` as `mean_ecpa`, `SUM(c_protein)` as `total_cost`, `AVG(cai)` as `mean_cai`
- Added separate bin builder for gene_cost type (different field names than generic `count`/`density`)
- NOT added to `_GC_LAYER_TYPES` (no avg_gc field)

### Step 7 — MCP Tool

**Edit:** `mcp/polymer_genomics_mcp/server.py`

Added `lookup_gene_cost(build, symbol)` tool calling `_get(f"/v1/genes/{build}/{symbol}/cost")`.

### Step 8 — Theme Additions

**Edit:** `viewer/src/config/theme.ts`

- Added `gene_costs_v1: '#10b981'` to `COLOR.layer` (emerald-500)
- Added `COLOR.cost` object: `cheap` (#22c55e), `moderate` (#eab308), `expensive` (#f97316), `very_expensive` (#ef4444)

### Step 9 — CostTrack Component

**New file:** `viewer/src/components/tracks/CostTrack.tsx`

Canvas track following `IsochoreTrack.tsx` pattern:
- Gene bars spanning genomic coordinates with viewport clipping
- Color: `ecpa_b20` mapped through 4 cost tiers (<18 green, 18-25 yellow, 25-30 orange, >30 red) via `COST_TIERS` array
- Height: proportional to `log2(c_protein)` normalized against max in view
- Gene symbol labels when bar width >= 40px (clipped to bar bounds)
- Cost tier legend when zoomed out (span > 100K and canvas >= 400px)
- Empty state: "No gene cost data in view"
- Default height: 36px

### Step 10 — TrackStack Integration

**Edit:** `viewer/src/components/TrackStack.tsx`

- Imported `CostTrack`
- Added between Genes and CpG Sites tracks:
  ```tsx
  {data?.layers?.gene_costs_v1 && (
    <TrackRow label="Cost">
      <CostTrack ... height={36} />
    </TrackRow>
  )}
  ```

### Step 11 — RegionContextPanel COST Section

**Edit:** `viewer/src/hooks/useRegionContext.ts`

- Extended `RegionContext` interface with `cost` field (9 properties: `geneSymbol`, `proteinLength`, `ecpaB20`, `cProtein`, `nProtein`, `sProtein`, `cai`, `tai`, `meanTpm`) or null
- In `useMemo`: if `gene_costs_v1` layer exists, finds gene whose range contains viewport center

**Edit:** `viewer/src/components/RegionContextPanel.tsx`

- Added COST section between GENE and LANDMARKS
- Displays: gene symbol + protein length, ECPA (ATP/aa), C_protein (k ATP), N/S atom counts, CAI, tAI, mean TPM
- Falls back to "No cost data" when center is not over a gene

---

## File Summary

| Action | File | Step |
|--------|------|------|
| New | `docker/postgres/migrations/003_gene_costs.sql` | 1 |
| Edit | `src/polymer_genomics/ingest/partitions.py` | 2 |
| New | `src/polymer_genomics/ingest/gene_costs.py` | 3 |
| Edit | `src/polymer_genomics/queries.py` | 4 |
| New | `src/polymer_genomics/routers/gene_costs.py` | 5 |
| Edit | `src/polymer_genomics/main.py` | 5 |
| Edit | `src/polymer_genomics/routers/aggregation.py` | 6 |
| Edit | `mcp/polymer_genomics_mcp/server.py` | 7 |
| Edit | `viewer/src/config/theme.ts` | 8 |
| New | `viewer/src/components/tracks/CostTrack.tsx` | 9 |
| Edit | `viewer/src/components/TrackStack.tsx` | 10 |
| Edit | `viewer/src/hooks/useRegionContext.ts` | 11 |
| Edit | `viewer/src/components/RegionContextPanel.tsx` | 11 |

**Not modified (no changes needed):**
- `src/polymer_genomics/routers/regions.py` — TRACK_REGISTRY handles dispatch automatically
- `src/polymer_genomics/routers/tiles.py` — same (imports from regions.py)
- `viewer/src/lib/api.ts` — GRanges type is generic enough
- `viewer/src/stores/viewport.ts` — layer auto-appears via API sidebar fetch

---

## Verification (all passed 2026-03-02)

1. **Schema:** `\dt bioenergetics.*` → `gene_costs`; `\dT+ layer_type` includes `gene_cost`
2. **Ingest:** 20,306 rows loaded (19,894 coord-matched, 412 unmatched); `SELECT count(*) FROM bioenergetics.gene_costs` = 20,306
3. **Region query:** `curl localhost:8000/v1/regions/hg38/chr4:73390000-73430000?layers=gene_costs_v1` → ALB with 12 mcols in GRanges
4. **Detail endpoint:** `curl localhost:8000/v1/genes/hg38/ALB/cost` → 7-group response: 609 aa, ECPA 23.7, liver #1 at 25,201 TPM / 426M EWGC
5. **Aggregation:** `curl localhost:8000/v1/aggregation/hg38/chr4:70000000-79999999?resolution=1000000&layers=gene_costs_v1` → 11 bins with gene_count, mean_ecpa, total_cost, mean_cai
6. **MCP tool:** `lookup_gene_cost` registered in server.py
7. **TypeScript:** `npx tsc --noEmit` — zero errors
8. **Python:** All 6 files pass `py_compile`

---

## Deviations from Original Plan

| Original plan | Actual implementation | Reason |
|---------------|----------------------|--------|
| Edit `docker/postgres/init.sql` | New `migrations/003_gene_costs.sql` | Migration file is the established pattern (002_ already exists) |
| `LAYER_QUERY_MAP` + `_convert_rows` in regions.py | `TRACK_REGISTRY` with `query_fn`+`convert_fn` in queries.py | Codebase had already migrated to TRACK_REGISTRY pattern; plan was outdated |
| `batch_load()` from `loader.py` + content hash | Direct `copy_records_to_table` | Matches `isochores.py` pattern; non-partitioned tables don't need `batch_load` validation |
| `chr_id NOT NULL`, `start_pos NOT NULL` | All coordinate columns nullable | 412 genes lack GENCODE coordinates; storing them with NULL coords is better than dropping them |
| `license_class = 'derived'` | `license_class = 'public_domain'` | Matches existing layer registrations |
| 14 steps (separate API types step) | 11 steps (no api.ts changes needed) | GRanges type in api.ts is already generic |

---

## Phase 3: Deferred

- Tissue selector (Sidebar dropdown, `activeTissue` in Zustand)
- Gene Cost Detail Panel (replace RegionContextPanel on click)
- CostTrack tissue-modulated opacity
- CostTrack histogram/aggregation mode at chromosome scale
- Content hash + row_count update in registry.layers
- RFE on Phase II validation data
