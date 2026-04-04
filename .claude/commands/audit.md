---
description: Cross-layer gap audit — DB vs API vs MCP routing completeness + live health checks
allowed-tools: [Bash, Read, Glob, Grep]
model: opus
---

# Polymer Genomics Cross-Layer Audit

Systematic gap detection across the three service layers: Database → API → MCP.
Run this after adding any new layer, endpoint, or MCP tool to catch missing wiring.

## Instructions

Execute all three phases in order. Output a structured report at the end.

---

## Phase 1: Source Code Registry Scan

Read these 5 files and extract the registered layer keys from each:

### 1A. TRACK_REGISTRY (generic region queries)
**File:** `src/polymer_genomics/queries/_registry.py`
**Extract:** All keys from `TRACK_REGISTRY` dict (these are the layer_type strings).
This is the master list — every layer should appear here first.

### 1B. INTERSECT_TABLES (cross-layer boolean intersection)
**File:** `src/polymer_genomics/routers/intersect.py`
**Extract:** All keys from `INTERSECT_TABLES` dict.

### 1C. CORRELATION_REGISTRY (correlation + stats engine)
**File:** `src/polymer_genomics/correlation.py`
**Extract:** All keys from `CORRELATION_REGISTRY` dict.

### 1D. _COUNT_TABLES (region profile counts)
**File:** `src/polymer_genomics/routers/profile.py`
**Extract:** All keys from `_COUNT_TABLES` dict.

### 1E. Aggregation (binned density)
**File:** `src/polymer_genomics/routers/aggregation.py`
**Extract:** All layer_type values handled in `_aggregation_query()` (look for `if layer_type ==` branches).

### 1F. MCP Tools
**File:** `mcp/polymer_genomics_mcp/server.py`
**Extract:** All function names decorated with `@mcp.tool()`. For each, note which API endpoint it calls (look for `_get("/v1/...")` or `_post("/v1/...")` calls in the function body).
**Also check:** `mcp/polymer_genomics_mcp/compute_tools.py` for compute tools.

### 1G. API Endpoints
**Scan:** `src/polymer_genomics/routers/*.py`
**Extract:** Every `@router.get(...)` and `@router.post(...)` path.
**Cross-reference with:** `src/polymer_genomics/main.py` to get the router prefix for each (look at `app.include_router(...)` calls and the `APIRouter(prefix=...)` in each router file).
Produce the full endpoint path (prefix + route).

### 1H. Cross-Reference and Produce Gap Matrix

For each TRACK_REGISTRY key, report whether it appears in:
- INTERSECT_TABLES (Y/N)
- CORRELATION_REGISTRY (Y/N)
- _COUNT_TABLES (Y/N)
- Aggregation (Y/N)

For each API endpoint, report whether it has a corresponding MCP tool (Y/N).
For each MCP tool, confirm the API endpoint it calls actually exists.

---

## Phase 2: Live API Probe

Hit the live API at `https://api.polymerbio.org` to verify each endpoint is reachable.

### Test Queries

Use these representative test queries. Run each with `curl -s -o /dev/null -w "%{http_code} %{time_total}s" URL`:

**Gene endpoints** (prefix `/v1/genes`):
```bash
# Core gene lookup
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/genes/hg38/BRCA1"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/genes/hg38/BRCA1/expression"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/genes/hg38/BRCA1/cost"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/genes/hg38/BRCA1/constraint"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/genes/hg38/BRCA1/pathways"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/genes/hg38/BRCA1/gene-sets"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/genes/hg38/BRCA1/protein-abundance"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/genes/hg38/BRCA1/protein-atlas"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/genes/hg38/BRCA1/profile"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/genes/hg38/BRCA1/similar"
```

**Region endpoints** (use `chr17:7668402-7687550` = TP53 locus):
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/regions/hg38/chr17:7668402-7687550"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/biophysics/hg38/chr17:7668402-7687550"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/aggregation/hg38/chr17:7668402-7687550"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/stats/hg38/chr17:7668402-7687550"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/profile/hg38/chr17:7668402-7687550"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/correlate/hg38/chr17:7668402-7687550?layer_a=biophysics&layer_b=conservation&stat=pearson_r"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/sequence/hg38/chr17:7668402-7668500"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/cpg-profile/hg38/cg00000029"
```

**Probe endpoints:**
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/probes/hg38/cg00000029"
```

**Search & layers:**
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/search?q=BRCA"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/layers"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/layers/summary/hg38"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/stats/summary"
```

**Reference endpoints:**
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/reference/nn-parameters"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/reference/dinucleotide-properties"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/reference/amino-acid-properties"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/reference/physical-constants"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/reference/sbs-spectrum"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/reference/clock-probes"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/reference/probe-repeat-overlap?limit=5"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/reference/validation"
```

**Transposome endpoints:**
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/transposome/families"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/transposome/family/L1HS"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/transposome/probe-te-mapping?platform=epic_v2&build=hg38"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/transposome/reference-methylation"
```

**HLA endpoints:**
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/hla/loci"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/hla/alleles/HLA-A?limit=5"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/hla/distributions/HLA-A"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/hla/allele/A*01:01:01:01"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/hla/expression-correlation"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/hla/expression-within-protein"
```

**Design endpoints (POST — use minimal body):**
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" -X POST -H "Content-Type: application/json" -d '{"sequence":"ATCGATCGATCG"}' "https://api.polymerbio.org/v1/evaluate"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" -X POST -H "Content-Type: application/json" -d '{"parts":[{"name":"p1","sequence":"ATCGATCGATCG","role":"promoter"}]}' "https://api.polymerbio.org/v1/design/construct"
```

**Bulk download:**
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/bulk/probe_epic_v2"
```

**Query/Recipes:**
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/query/recipes"
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/v1/query?build=hg38&gene=BRCA1&radius=5000"
```

**Health:**
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://api.polymerbio.org/ping"
```

For each, report `[OK]` for 200, `[WARN]` for slow (>5s), `[FAIL]` for non-200.

---

## Phase 3: Live DB Schema Comparison

First check if fly proxy is running on port 15432 or 15433:
```bash
lsof -i :15432 2>/dev/null | head -2
lsof -i :15433 2>/dev/null | head -2
```

If proxy is running, query the DB. If not, report `[SKIP] Fly proxy not running — start with: fly proxy 15432:5432 -a polymer-db`.

### DB Queries (if proxy available)

**Get all schemas and tables:**
```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND table_type = 'BASE TABLE'
ORDER BY table_schema, table_name;
```

**Get materialized views:**
```sql
SELECT schemaname, matviewname
FROM pg_matviews
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, matviewname;
```

**Get row counts for each table** (from pg_stat):
```sql
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, relname;
```

### Cross-reference:
- For each DB table, check if its schema+table appears in any TRACK_REGISTRY query function (look at the `_query` functions imported in `_registry.py` — each references a specific table).
- Flag any table that exists in DB but has NO routing entry anywhere.
- Flag any TRACK_REGISTRY entry whose underlying table doesn't exist in DB.

---

## Output Format

Produce this exact structure:

```
============================================================
POLYMER CROSS-LAYER AUDIT — {date}
============================================================

PHASE 1: SOURCE REGISTRY GAPS
------------------------------------------------------------
TRACK_REGISTRY:     {N} layers
INTERSECT:          {N}/{total} ({missing} missing)
CORRELATION:        {N}/{total} ({missing} missing)
PROFILE:            {N}/{total} ({missing} missing)
AGGREGATION:        {N}/{total} ({missing} missing)
MCP TOOLS:          {N} tools → {covered}/{total} API endpoints covered

Layer Gap Matrix:
  Layer Type              Region  Intersect  Correlate  Profile  Aggregate
  ──────────────────────  ──────  ─────────  ─────────  ───────  ─────────
  clinvar                 Y       N          N          N        N
  eqtl                    Y       N          N          N        N
  ...

API → MCP Coverage:
  [GAP] POST /v1/hla/compare — no MCP tool
  [GAP] GET /v1/hla/loci — no MCP tool
  ...
  [OK] {N}/{total} endpoints have MCP tools

PHASE 2: LIVE API HEALTH
------------------------------------------------------------
  [OK]   GET  /v1/genes/hg38/BRCA1                          200  1.2s
  [FAIL] POST /v1/hla/compare                               500  0.3s
  [WARN] GET  /v1/genes/hg38/BRCA1/profile                  200  8.4s
  ...
  Summary: {ok}/{total} healthy, {fail} failed, {warn} slow (>5s)

PHASE 3: DB ↔ CODE ALIGNMENT
------------------------------------------------------------
  DB: {N} schemas, {N} tables, {N} materialized views
  [GAP] {schema}.{table} — exists in DB, no routing entry
  [OK]  All TRACK_REGISTRY entries have matching DB tables
  ...

============================================================
SUMMARY
============================================================
  Critical gaps (DB unreachable):     {N}
  MCP tool gaps:                      {N} endpoints uncovered
  Intersect gaps:                     {N} layers missing
  Correlation gaps:                   {N} layers missing
  Profile gaps:                       {N} layers missing
  Aggregation gaps:                   {N} layers missing
  API failures:                       {N} endpoints down
  Slow endpoints (>5s):               {N}

  ACTION REQUIRED: {Y/N}
============================================================
```

## Key Principles

- Read actual source code — never rely on docs or comments
- Report exact counts — not approximations
- Flag discrepancies, not just absences (e.g., if INTERSECT_TABLES references a table name different from what TRACK_REGISTRY uses)
- If fly proxy is not running, Phase 3 DB checks should be SKIPPED with a clear message, not failed
- Run curl calls in parallel where possible (batch with `&` and `wait`) to minimize total time
- Keep output actionable — every GAP line should make clear what needs to be added and where
