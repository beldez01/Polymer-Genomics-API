# Gene Bioenergetic Cost Layer — Implementation Plan

## Context

Integrate 20,431 genes of established bioenergetic metrics (Akashi-Gojobori amino acid costs, CAI, tAI, GTEx EWGC) into the Polymer Genomics API and genome browser. The spec is at `/Users/zbb2/Desktop/Research/topics/computational-biology/gene-cost-layer-integration.md`. Data asset: `reference_gene_cost_table_v3.tsv` (93 columns, 20,431 rows).

Full-stack: PostgreSQL schema + ingest → FastAPI query/router → MCP tool → Next.js canvas track + context panel.

## Architectural Compatibility Audit

After exhaustive codebase review, here are all integration points and how gene_costs aligns:

### 1. Enum Extension
The `layer_type` enum has 6 values: `genome, gene_model, cpg, probe, methylation, isochore`. Adding `'gene_cost'` via `ALTER TYPE ... ADD VALUE IF NOT EXISTS` is safe and follows the same pattern the init.sql uses for other enum values.

### 2. Three Dispatch Systems (all must be updated)

| System | File | What to add |
|--------|------|-------------|
| `LAYER_QUERY_MAP` | `queries.py` | `"gene_cost": region_gene_costs_query` |
| `_convert_rows()` | `regions.py` | `elif layer_type == "gene_cost":` branch |
| `_aggregation_query()` | `aggregation.py` | `elif layer_type == "gene_cost":` branch |

`tiles.py` imports `_convert_rows` from `regions.py` — no changes needed there; the new branch is automatically available.

### 3. Partition Whitelist
`ingest/partitions.py` has `ALLOWED_SCHEMAS` and `ALLOWED_TABLES` frozensets. Must add `'bioenergetics'` to `ALLOWED_SCHEMAS` and `'gene_costs'` to `ALLOWED_TABLES` for the `batch_load` path to work.

### 4. Table Design — No Partitioning
20K rows. Non-partitioned like `cpg.islands` (267K rows) and `ref.isochores` (~30K rows). GiST index on `(chr_id, coord)` is sufficient.

### 5. Coordinate Convention
DB stores 0-based half-open. Gene boundaries in `gene.features` are already in this convention (GTF start-1, GTF end). The ingest copies these exact values. `_convert_rows` calls `db_to_api()` to produce 1-based closed output.

### 6. Layer Registration
`one_default_per_key` partial unique index enforces one active default per `layer_key`. Ingest must check-and-skip if `gene_costs_v1` already exists for the build (same pattern as `isochores.py` and `cpg.py`).

### 7. Ingest Pattern
Use `batch_load()` from `loader.py` (not direct `copy_records_to_table`) + `compute_content_hash` + `update_layer_stats`. This follows the `cpg.py` pattern and ensures proper content hashing and row counting in the registry.

### 8. Detail Endpoint
Follows the `probes.py` single-lookup precedent: bypasses `LAYER_QUERY_MAP`, resolves layer independently via `layer_type = 'gene_cost'` from `registry.active_layers`, returns structured (non-GRanges) data.

### 9. Search Compatibility
`search.py` searches only `gene.features` by symbol. Gene costs use the same GENCODE symbols — no search changes needed. Users search for a gene symbol, then gene_cost data appears via the region query and detail endpoint.

### 10. Aggregation Compatibility
`_aggregation_query()` in `aggregation.py` is a parallel dispatch system (does NOT use `LAYER_QUERY_MAP`). It has its own per-type SQL returning bins. Must add a `gene_cost` branch with `COUNT(*)`, `AVG(ecpa_b20)`, `SUM(c_protein)`, `AVG(cai)` aggregates. The `_GC_LAYER_TYPES` set does not need updating (gene_cost does not have `avg_gc`).

### 11. MCP Tool
Follows existing pattern: `@mcp.tool()` function calling `_get()` against the REST endpoint. No import of `polymer_genomics` internals.

### 12. Frontend Layer Toggle
`Sidebar.tsx` fetches layers via `fetchLayers(build)` from the API. The new `gene_costs_v1` layer auto-appears once registered in the DB. No hardcoded layer keys in the sidebar.

---

## Phase 1: Backend (7 steps)

### Step 1 — Schema DDL

**File:** `docker/postgres/init.sql` (append before role grants)

```sql
ALTER TYPE registry.layer_type ADD VALUE IF NOT EXISTS 'gene_cost';

CREATE SCHEMA IF NOT EXISTS bioenergetics;
GRANT USAGE ON SCHEMA bioenergetics TO api_reader, ingest_writer;

CREATE TABLE bioenergetics.gene_costs (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           registry.genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,     -- 0-based half-open (from gene.features)
    end_pos         int NOT NULL,     -- 0-based half-open
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    strand          char(1) NOT NULL DEFAULT '+',
    -- Identity
    gene_symbol     text NOT NULL,
    uniprot_id      text,
    protein_name    text,
    -- Biosynthetic cost (Akashi-Gojobori)
    protein_length  int,
    ecpa_b20        real,
    ecpa_h11        real,
    c_protein       real,
    c_aa_synthesis  real,
    c_translation   real,
    -- Elemental composition
    n_protein       int,
    s_protein       int,
    c_atoms         int,
    mw_kda          real,
    cost_per_kda    real,
    n_per_kda       real,
    s_per_kda       real,
    -- AA composition fractions
    frac_cheap      real,
    frac_moderate   real,
    frac_expensive  real,
    frac_very_expensive real,
    -- AA counts
    n_cys int, n_met int, n_trp int, n_arg int, n_lys int,
    -- Codon optimization
    cds_length_nt   int,
    n_codons        int,
    gc3             real,
    gc_cds          real,
    cai             real,
    tai             real,
    enc             real,
    fop             real,
    -- Expression summary
    mean_tpm        real,
    max_tpm         real,
    -- 24 tissue TPM columns
    tpm_brain real, tpm_heart real, tpm_kidney real, tpm_liver real,
    tpm_muscle real, tpm_adipose real, tpm_whole_blood real, tpm_lung real,
    tpm_pancreas real, tpm_stomach real, tpm_small_intestine real, tpm_skin real,
    tpm_testis real, tpm_ovary real, tpm_thyroid real, tpm_spleen real,
    tpm_nerve real, tpm_artery real, tpm_colon real, tpm_esophagus real,
    tpm_prostate real, tpm_pituitary real, tpm_breast real, tpm_uterus real,
    -- 24 EWGC columns
    ewgc_brain real, ewgc_heart real, ewgc_kidney real, ewgc_liver real,
    ewgc_muscle real, ewgc_adipose real, ewgc_whole_blood real, ewgc_lung real,
    ewgc_pancreas real, ewgc_stomach real, ewgc_small_intestine real, ewgc_skin real,
    ewgc_testis real, ewgc_ovary real, ewgc_thyroid real, ewgc_spleen real,
    ewgc_nerve real, ewgc_artery real, ewgc_colon real, ewgc_esophagus real,
    ewgc_prostate real, ewgc_pituitary real, ewgc_breast real, ewgc_uterus real
);

CREATE INDEX idx_gene_costs_coord ON bioenergetics.gene_costs USING GiST (chr_id, coord);
CREATE INDEX idx_gene_costs_symbol ON bioenergetics.gene_costs (gene_symbol);
CREATE INDEX idx_gene_costs_layer_build ON bioenergetics.gene_costs (layer_id, build);

GRANT SELECT ON bioenergetics.gene_costs TO api_reader;
GRANT SELECT, INSERT, UPDATE ON bioenergetics.gene_costs TO ingest_writer;
```

Also add default privileges for the new schema (matching existing pattern):
```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA bioenergetics GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA bioenergetics GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;
```

**Apply to running instance:** `docker exec` psql to execute the DDL on the live database.

### Step 2 — Partition Whitelist Update

**File:** `src/polymer_genomics/ingest/partitions.py`

Add `'bioenergetics'` to `ALLOWED_SCHEMAS` frozenset and `'gene_costs'` to `ALLOWED_TABLES` frozenset.

### Step 3 — Ingest Script

**New file:** `src/polymer_genomics/ingest/gene_costs.py`

Following `cpg.py` pattern (uses `batch_load` + content hash + layer stats):

1. **`register_layer(conn, build)`** — Check for existing `gene_costs_v1` layer for this build. If found with rows, skip. Otherwise INSERT into `registry.layers` with:
   - `layer_key = 'gene_costs_v1'`
   - `version = '1.0.{build}'`
   - `layer_type = 'gene_cost'`
   - `source = 'derived:UniProt+GTEx+CodonStatsDB'`
   - `license_class = 'derived'`
   - `storage_type = 'postgres'`
   - `is_active = true, is_default = true`

2. **`resolve_gene_coordinates(conn, build)`** — Query `gene.features` for `feature_type = 'gene'` entries:
   ```sql
   SELECT DISTINCT ON (gene_symbol) gene_symbol, chr_id, start_pos, end_pos, strand
   FROM gene.features
   WHERE build = $1::genome_build AND layer_id = $2 AND feature_type = 'gene'
   ORDER BY gene_symbol, start_pos
   ```
   Requires the active `gene_model` layer to be loaded first.
   Returns `{gene_symbol: (chr_id, start_pos, end_pos, strand)}` dict.

3. **`read_cost_table(tsv_path)`** — Parse TSV with csv.DictReader. Map column names from TSV headers to DB column names. Handle type conversions (int, float, text). Skip header row.

4. **`merge_and_load(conn, layer_id, build, cost_rows, coord_lookup)`** — For each row:
   - Look up coordinates by `gene_symbol`. If not found, try common aliases (e.g., strip version suffixes). Log and skip if still unmatched.
   - Build tuple matching the COLUMNS list order.
   - Accumulate in batches of 5,000.
   - Call `batch_load(conn, 'bioenergetics', 'gene_costs', batch, COLUMNS)`.
   - Expected: ~18,500 matched genes.

5. **`compute_content_hash(conn, 'bioenergetics', 'gene_costs', layer_id)`**
6. **`update_layer_stats(conn, layer_id, row_count, content_hash)`**

**Input:** `/Users/zbb2/Desktop/Research/data/output/reference_gene_cost_table_v3.tsv`

**TSV column → DB column mapping:** The TSV uses mixed case headers (e.g., `ECPAgene_B20`, `TPM_Brain`, `EWGC_Brain`). Map to lowercase snake_case DB columns (e.g., `ecpa_b20`, `tpm_brain`, `ewgc_brain`).

**MT gene handling:** For 13 MT genes, use `mt_CAI`/`mt_tAI` values for the `cai`/`tai` columns (MT-corrected values). The TSV has separate `CAI_correct`/`tAI_correct` columns — use those when available.

### Step 4 — Region Query Function

**File:** `src/polymer_genomics/queries.py`

Add `region_gene_costs_query()` — standard 6-param signature. Selects the 12 Tier 1 columns (gene_symbol, protein_length, ecpa_b20, c_protein, n_protein, s_protein, cai, tai, mean_tpm, max_tpm, frac_cheap, frac_expensive) plus start_pos, end_pos, strand. Uses `coord && int4range($3, $4)` for GiST overlap.

Register: `LAYER_QUERY_MAP["gene_cost"] = region_gene_costs_query`

### Step 5 — Region Router (_convert_rows branch)

**File:** `src/polymer_genomics/routers/regions.py`

Add `elif layer_type == "gene_cost":` branch to `_convert_rows()`. Build parallel lists, call `db_to_api()`, return GRanges dict with 12 mcols + strand. This automatically works for tiles.py since it imports `_convert_rows`.

### Step 6 — Gene Cost Detail Router

**New file:** `src/polymer_genomics/routers/gene_costs.py`

**Route:** `GET /v1/genes/{build}/{symbol}/cost`

Pattern follows `probes.py` single-lookup:
1. Validate build.
2. Query `registry.active_layers` for `layer_type = 'gene_cost'` + build. 404 if none.
3. Query `bioenergetics.gene_costs` by `gene_symbol` + `build` + `layer_id` (`SELECT *`, LIMIT 1). 404 if not found.
4. Transform flat row into Tier 2 structured response with 7 groups: `coordinates`, `identity`, `biosynthetic_cost`, `elemental`, `composition`, `codon_optimization`, `expression`.
5. Build tissue array from 24 TPM + 24 EWGC column pairs, sorted by EWGC descending.
6. Wrap in `build_envelope()`.

**File:** `src/polymer_genomics/main.py`

Import and register: `app.include_router(gene_costs_router)` with `prefix="/v1/genes"`.

**Note:** This shares the `/v1/genes` prefix with `genes.py`. The route is `/{build}/{symbol}/cost` — the `/cost` suffix disambiguates from the existing `/{build}/{symbol}` gene model endpoint.

### Step 7 — Aggregation Extension

**File:** `src/polymer_genomics/routers/aggregation.py`

Add `elif layer_type == "gene_cost":` branch to `_aggregation_query()`. SQL bins by `floor(gc.start_pos / $6) * $6`, aggregates: `COUNT(*) AS gene_count`, `AVG(ecpa_b20) AS mean_ecpa_b20`, `SUM(c_protein) AS total_c_protein`, `AVG(cai) AS mean_cai`. No `avg_gc` (do NOT add to `_GC_LAYER_TYPES`).

### Step 8 — MCP Tool

**File:** `mcp/polymer_genomics_mcp/server.py`

Add `lookup_gene_cost(build, symbol)` tool:
```python
@mcp.tool()
async def lookup_gene_cost(build: str, symbol: str) -> dict:
    """Look up bioenergetic cost metrics for a gene.

    Returns amino acid biosynthetic cost (Akashi-Gojobori), elemental
    composition (N, S, C), codon optimization (CAI, tAI), and
    tissue-specific expression-weighted gene costs (EWGC) from GTEx.

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'ALB', 'TP53', 'TTN').
    """
    return await _get(f"/v1/genes/{build}/{symbol}/cost")
```

---

## Phase 2: Frontend (6 steps)

### Step 9 — Design System Additions

**File:** `viewer/src/config/theme.ts`

Add to `COLOR.layer`:
```typescript
gene_costs_v1: '#10b981',  // emerald-500
```

Add new `COLOR.cost` object:
```typescript
cost: {
  cheap:          '#22c55e',  // green-500
  moderate:       '#eab308',  // yellow-500
  expensive:      '#f97316',  // orange-500
  very_expensive: '#ef4444',  // red-500
},
```

### Step 10 — API Client Types + Fetch

**File:** `viewer/src/lib/api.ts`

Add TypeScript interfaces:
- `GeneCostData` (7 groups matching Tier 2 response)
- `GeneCostResponse` (envelope wrapping `GeneCostData`)
- `CostAggregationBin` (for aggregation)

Add fetch function:
```typescript
export async function fetchGeneCost(build: string, symbol: string): Promise<GeneCostResponse> {
  return fetchJSON(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/cost`);
}
```

### Step 11 — CostTrack Component

**New file:** `viewer/src/components/tracks/CostTrack.tsx`

Props: `{ data: GRanges | undefined, viewStart, viewEnd, canvasWidth, height?: number }`

Canvas track following `IsochoreTrack.tsx` pattern:
- `useRef<HTMLCanvasElement>` + `useEffect` with all props as deps
- DPR setup, `drawGridlines()`, guard on `!data || data.n === 0`
- Gene bars: x from `genomicToPixel(start)` to `genomicToPixel(end)`
- Color: map `mcols.ecpa_b20[i]` to green-amber-rose gradient via linear interpolation
  - < 18: green → green (cheap)
  - 18-25: green → yellow → orange (moderate to expensive)
  - 25-30: orange → red (expensive to very expensive)
  - > 30: red (very expensive)
- Height: proportional to `log2(mcols.c_protein[i])`, normalized to track height. Range: ~log2(2000)=11 to ~log2(3,500,000)=21.7. Map [11, 22] → [4px, height-4px].
- Labels: gene symbol above bar when bar pixel width > 40px, `11px JetBrains Mono, #CCCCCC`
- `drawTrackLabel(ctx, 'Cost', canvasWidth)` last
- Empty state: "No gene cost data in view"

### Step 12 — TrackStack Integration

**File:** `viewer/src/components/TrackStack.tsx`

Import `CostTrack`. Add between GeneTrack and CpgTrack:
```tsx
{data?.layers?.gene_costs_v1 && (
  <TrackRow>
    <CostTrack data={data.layers.gene_costs_v1} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={40} />
  </TrackRow>
)}
```

### Step 13 — RegionContextPanel COST Section

**File:** `viewer/src/hooks/useRegionContext.ts`

Extend `RegionContext` interface with:
```typescript
cost: {
  gene_symbol: string;
  protein_length: number;
  ecpa_b20: number;
  c_protein: number;
  n_protein: number;
  s_protein: number;
  cai: number;
  tai: number;
  mean_tpm: number;
  frac_cheap: number;
  frac_expensive: number;
} | null;
```

In `useMemo`: if `data?.layers?.gene_costs_v1` exists, find the gene whose range contains `center`. Set `cost` to its mcols, or null if no gene at center.

**File:** `viewer/src/components/RegionContextPanel.tsx`

Add COST section between GENE and LANDMARKS. Uses `Section` component with "COST" header. Shows:
- Gene symbol + protein length
- ECPAgene (1 decimal), C_protein (K/M suffix)
- N, S atom counts
- CAI (3 decimal), tAI (3 decimal)
- Mean TPM (K/M suffix)

Number formatting helper: `formatSI(n)` → K/M/B suffixes.

### Step 14 — Default Layer Visibility

**File:** `viewer/src/stores/viewport.ts`

Leave `gene_costs_v1` OUT of `activeLayers` default — user toggles it on via sidebar. The layer auto-appears in the sidebar's layer list (fetched from API).

---

## Phase 3: Deferred (not in this implementation pass)

- Tissue selector (Sidebar dropdown, `activeTissue` in Zustand)
- Gene Cost Detail Panel (replace RegionContextPanel on click)
- CostTrack tissue-modulated opacity
- CostTrack histogram/aggregation mode at chromosome scale

These are self-contained enhancements after Phase 1+2 are working.

---

## File Summary

| Action | File | Step |
|--------|------|------|
| Edit | `docker/postgres/init.sql` | 1 |
| Edit | `src/polymer_genomics/ingest/partitions.py` | 2 |
| New | `src/polymer_genomics/ingest/gene_costs.py` | 3 |
| Edit | `src/polymer_genomics/queries.py` | 4 |
| Edit | `src/polymer_genomics/routers/regions.py` | 5 |
| New | `src/polymer_genomics/routers/gene_costs.py` | 6 |
| Edit | `src/polymer_genomics/main.py` | 6 |
| Edit | `src/polymer_genomics/routers/aggregation.py` | 7 |
| Edit | `mcp/polymer_genomics_mcp/server.py` | 8 |
| Edit | `viewer/src/config/theme.ts` | 9 |
| Edit | `viewer/src/lib/api.ts` | 10 |
| New | `viewer/src/components/tracks/CostTrack.tsx` | 11 |
| Edit | `viewer/src/components/TrackStack.tsx` | 12 |
| Edit | `viewer/src/hooks/useRegionContext.ts` | 13 |
| Edit | `viewer/src/components/RegionContextPanel.tsx` | 13 |

---

## Verification

1. **After Step 1 (schema):** `\dt bioenergetics.*` shows `gene_costs` table; `\dT+ registry.layer_type` includes `gene_cost`
2. **After Step 3 (ingest):** `python -m polymer_genomics.ingest.gene_costs` → ~18,500 rows loaded; `SELECT count(*) FROM bioenergetics.gene_costs` confirms; `SELECT * FROM registry.active_layers WHERE layer_key = 'gene_costs_v1'` shows content_hash and row_count
3. **After Step 5 (region router):** `curl localhost:8000/v1/regions/hg38/chr4:73390000-73430000?layers=gene_costs_v1` → ALB and GC genes with 12 mcols
4. **After Step 6 (detail router):** `curl localhost:8000/v1/genes/hg38/ALB/cost` → Tier 2 structured response with 7 groups, tissues sorted by EWGC desc
5. **After Step 7 (aggregation):** `curl localhost:8000/v1/aggregation/hg38/chr1:1-249000000?resolution=1000000&layers=gene_costs_v1` → bins with gene_count, mean_ecpa_b20
6. **After Step 8 (MCP):** `lookup_gene_cost` tool returns ALB cost data
7. **After Step 12 (frontend):** Navigate to chr4:73390000-73430000 in viewer → green-to-amber cost bars between gene model and CpG tracks
8. **After Step 13 (context panel):** COST section shows ALB metrics when viewport center is over the gene
