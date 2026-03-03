# Polymer Genomics — Phase 2 Implementation Plan

**Date:** 2026-03-02
**Author:** Zach Belden + Claude
**Status:** Draft for review
**Context:** Phase 1 complete (API deployed, MCP working, all base layers ingested). This plan covers blocking items for TET2 research + nice-to-have platform features from PLATFORM_ROADMAP.md.

---

## Status Corrections

Before planning, two corrections from cross-checking the codebase:

1. **R client is COMPLETE.** All 8 core functions (`pg_connect`, `pg_region`, `pg_gene`, `pg_probes`, `pg_probe_batch`, `pg_sequence`, `pg_search`, `pg_layers`, `pg_bulk`) plus GRanges converters are fully implemented. Remove from work list.

2. **Methylation ingest code is COMPLETE (846 lines).** The pipeline reads CSV/TSV with columns `probe_id, chr, pos, CD4T, CD8T, NK, Bcell, Mono, Gran`, generates per-cell-type Parquet files, pre-computes 10kb summary bins, uploads to S3/MinIO, and registers layers. The only blocker is source data.

---

## Part A: Blocking (Required for TET2 Research)

### Task A1: Source Hematopoietic Methylation Reference Data

**What:** Obtain a sorted-cell methylation reference matrix for 6 hematopoietic cell types (CD4T, CD8T, NK, Bcell, Mono, Gran) mapped to hg38.

**Why blocking:** Without this, the methylation atlas layer is empty, the viewer can't show cell-type methylation tracks, and Polymer can't contextualize TET2 methylation signatures against normal hematopoietic baselines.

**Data source options (ranked by fit):**

1. **Salas et al. 2018 (FlowSorted.Blood.EPIC)** — RECOMMENDED
   - 6 purified cell types from EPIC array, publicly available via Bioconductor
   - Already in your R ecosystem; `FlowSorted.Blood.EPIC::FlowSorted.Blood.EPIC` gives you RGChannelSet
   - Process: load → getBeta() → aggregate by cell type → export CSV
   - Coordinates: EPIC v1 manifest → hg38 (Illumina provides hg38 manifest)
   - Coverage: ~866K probes, full overlap with your EPIC v2 panel and partial overlap with 450K

2. **Reinius et al. 2012 (FlowSorted.Blood.450k)**
   - 450K platform — direct match for TCGA
   - Fewer probes (~485K) but better platform alignment for cross-study work
   - Could use as secondary reference for 450K-specific analyses

3. **Blueprint / IHEC**
   - WGBS data (not array) — higher resolution but requires different processing pipeline
   - Overkill for current needs

**Implementation steps:**

```r
# Step 1: Extract reference betas from FlowSorted.Blood.EPIC
library(FlowSorted.Blood.EPIC)
library(minfi)

# Load the reference dataset
data(FlowSorted.Blood.EPIC)
rgSet <- FlowSorted.Blood.EPIC

# Get beta values
betas <- getBeta(preprocessNoob(rgSet))

# Get cell type labels
cell_types <- pData(rgSet)$CellType
# Expected types: CD4T, CD8T, NK, Bcell, Mono, Gran (exact column names the ingest expects)

# Compute per-cell-type mean betas
cell_means <- sapply(unique(cell_types), function(ct) {
  rowMeans(betas[, cell_types == ct, drop = FALSE], na.rm = TRUE)
})

# Get probe coordinates from manifest (hg38)
library(IlluminaHumanMethylationEPICanno.ilm10b4.hg19)
# OR use sesameData for hg38 coordinates directly:
library(sesameData)
manifest <- sesameData_getManifestGRanges("EPIC")

# Build output CSV
out <- data.frame(
  probe_id = rownames(cell_means),
  chr = as.character(seqnames(manifest[rownames(cell_means)])),
  pos = start(manifest[rownames(cell_means)]),
  CD4T = cell_means[, "CD4T"],
  CD8T = cell_means[, "CD8T"],
  NK   = cell_means[, "NK"],
  Bcell = cell_means[, "Bcell"],
  Mono  = cell_means[, "Mono"],
  Gran  = cell_means[, "Gran"]
)

write.csv(out, "methylation_reference_hg38.csv", row.names = FALSE)
```

```bash
# Step 2: Place CSV in data directory
cp methylation_reference_hg38.csv /Users/zbb2/Desktop/PolymerGenomicsAPI/data/

# Step 3: Run ingest
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
uv run python -m polymer_genomics.ingest.methylation --build hg38 --input data/methylation_reference_hg38.csv
```

**Validation:**
- Confirm 6 rows in `methylation.atlas_layers` table
- Confirm Parquet files in S3/MinIO (`meth_CD4T_hg38.parquet`, etc.)
- Query: `curl localhost:8000/v1/layers?type=methylation` → 6 layers returned
- Query: `curl localhost:8000/v1/regions/hg38/chr16:70699000-70700000?layers=meth_Mono` → returns beta values

**Estimated time:** 2-4 hours (R extraction ~1hr, troubleshooting coordinates ~1hr, ingest + validate ~1hr)

**Output:** `data/methylation_reference_hg38.csv` (~50-80 MB)

---

### Task A2: Also Generate 450K Reference Matrix (for TCGA compatibility)

**What:** Repeat A1 using `FlowSorted.Blood.450k` to produce a 450K-native reference. This is critical for TCGA analyses where probes are 450K-only.

**Why:** Your 35-probe TCGA panel and future N>=30 Phase II will use 450K data. Cell-type reference betas should come from the same platform to avoid cross-platform artifacts.

**Implementation:**

```r
library(FlowSorted.Blood.450k)
# Same pipeline as A1 but with 450K reference
# Output: methylation_reference_450k_hg38.csv
```

**Decision:** Either ingest as a separate layer set (e.g., `meth_Mono_450k`) or merge with EPIC reference at overlapping probes. Recommend separate layers — keeps provenance clean.

**Estimated time:** 1-2 hours (pipeline already written from A1)

---

### Task A3: Methylation Heatmap Track for Viewer

**What:** Canvas-based track component that renders per-CpG beta values as a color-coded heatmap, with one row per cell type.

**Why blocking:** The viewer currently has 6 track types but no methylation visualization. This is the "TET2 story" track — without it, the viewer can't show what TET2 LOF does to methylation across cell types.

**Design:**

```
MethylationTrack layout (for a region with, say, 200 visible CpGs):

Cell type labels (left)     Beta value heatmap (right, canvas)
─────────────────────────────────────────────────────────────
  Gran  │ ████████████████████████████████████████████████
  Mono  │ ████████████████████████████████████████████████
  CD4T  │ ████████████████████████████████████████████████
  CD8T  │ ████████████████████████████████████████████████
    NK  │ ████████████████████████████████████████████████
 Bcell  │ ████████████████████████████████████████████████

Color scale: 0.0 (blue/unmethylated) → 0.5 (white) → 1.0 (red/methylated)
```

**File:** `viewer/src/components/tracks/MethylationTrack.tsx`

**Implementation:**

1. **Data fetching:** Query `/v1/regions/{build}/{region}?layers=meth_Mono,meth_Gran,...` (or a dedicated methylation endpoint if the region router supports it). The response returns per-probe beta values keyed by cell type.

2. **Canvas rendering:**
   - 6 rows (one per cell type), each ~20px tall
   - Each CpG site renders as a 1-pixel-wide column (or wider at high zoom)
   - Color mapping: linear interpolation blue (beta=0) → white (beta=0.5) → red (beta=1.0)
   - At low zoom (>100kb), render 10kb summary bins instead of individual CpGs
   - Cell type labels rendered as static text on the left margin

3. **Interaction:**
   - Hover tooltip: probe ID, beta value, cell type, CpG context
   - No click-through for V1

4. **Integration:**
   - Add to `TrackStack.tsx` conditional render chain (alongside existing 6 tracks)
   - Add `meth_*` layer toggles to sidebar layer panel
   - Default: methylation tracks OFF (opt-in, since they add visual density)

**Dependencies:** Task A1 must complete first (needs data in the database).

**Estimated time:** 3-4 hours (canvas rendering ~2hr, API integration ~1hr, sidebar/toggles ~1hr)

---

### Task A4: MCP Server — Add Methylation Tools

**What:** Extend the MCP server with tools to query methylation data, so Claude can answer questions like "What's the monocyte methylation level at cg08796240?"

**File:** `mcp/polymer_genomics_mcp/server.py`

**New tools:**

```python
@mcp.tool()
async def query_methylation(
    build: str,
    region: str,
    cell_types: str | None = None,
) -> dict:
    """Query cell-type-specific methylation values in a genomic region.

    Returns per-CpG beta values for each requested cell type (CD4T, CD8T,
    NK, Bcell, Mono, Gran). Useful for understanding methylation patterns
    in normal hematopoietic cells.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region in format 'chr16:70699930-70700000' (1-based closed).
        cell_types: Optional comma-separated cell types (e.g. 'Mono,Gran,Bcell').
                    Omit to query all 6 cell types.
    """
    params = {}
    if cell_types:
        params["cell_types"] = cell_types
    return await _get(f"/v1/regions/{build}/{region}", params | {"layers": "meth_" + ",meth_".join((cell_types or "CD4T,CD8T,NK,Bcell,Mono,Gran").split(","))})
```

**Note:** The exact implementation depends on how the region router exposes methylation layers. If methylation layers follow the standard `layers=meth_Mono,meth_Gran` pattern, the existing `query_region` tool already works — just need to document the layer keys. May only need a convenience wrapper, not a new endpoint.

**Estimated time:** 1 hour (may be as simple as adding documentation to existing tools)

---

## Part B: Nice-to-Have (Platform Quality)

### Task B1: Python Client Library

**What:** `pip install polymer-genomics` — a thin httpx-based client that mirrors the R client's API surface. Returns pandas DataFrames.

**Why:** PLATFORM_ROADMAP Phase 1. Bioinformaticians working in Python notebooks need a first-class client, not raw HTTP calls. The MCP server is agent-facing; this is human-facing.

**Package structure:**

```
python-client/
├── pyproject.toml
├── src/polymer_genomics_client/
│   ├── __init__.py        # Re-exports: connect, region, gene, probe, ...
│   ├── client.py          # PolymerClient class + module-level singleton
│   ├── converters.py      # GRanges JSON → pandas DataFrame
│   └── types.py           # TypedDict definitions
└── tests/
    ├── test_client.py
    └── test_converters.py
```

**Public API (mirrors R client exactly):**

```python
import polymer

polymer.connect("https://api.polymerbio.org", build="hg38")

# All return pandas DataFrames
region = polymer.region("chr17:7668421-7687490", layers=["gencode_v44"])
gene   = polymer.gene("TP53")
probe  = polymer.probe("cg08796240")        # dict: {'probe': DataFrame, 'crossmap': DataFrame}
batch  = polymer.probe_batch(["cg08796240", "cg27457201"])
seq    = polymer.sequence("chr17:7676000-7676100")   # str
hits   = polymer.search("BRC")              # list of dicts
layers = polymer.layers()                   # DataFrame
agg    = polymer.aggregate("chr17:7000000-8000000", resolution=10000)
```

**Key decisions (from PLATFORM_ROADMAP):**
- Import as `import polymer`
- Dependencies: `httpx`, `pandas` only. No bio deps.
- Sync httpx client. Async later if needed.
- Module-level singleton for connection state
- `PolymerError` exception class wrapping API errors

**Implementation steps:**

1. Create `python-client/` directory + pyproject.toml
2. Implement `client.py`: connection state, HTTP methods, each public function
3. Implement `converters.py`: GRanges JSON → DataFrame flattening
4. Implement `types.py`: TypedDict for response shapes
5. Write tests (mock httpx responses)
6. Publish to PyPI

**Estimated time:** 6-8 hours

---

### Task B2: Shareable Viewer URLs

**What:** URL query params capture active layers and panel state. `replaceState` syncs on viewport change. Copy-link button in header.

**Why:** PLATFORM_ROADMAP Phase 3. Currently the URL only captures `build` and `region` — layer selections are ephemeral. A shareable URL should reconstruct the exact view.

**URL format:**
```
/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,meth_Mono&ctx=1
```

**Implementation steps:**

1. **URL → State (mount):** In the `[region]/page.tsx` component, parse `searchParams` for `layers` and `ctx`. Hydrate Zustand store before first render.

2. **State → URL (change):** Subscribe to Zustand store changes. On layer toggle or context panel toggle, call `window.history.replaceState()` with updated query params. Debounce 500ms to avoid URL thrash during rapid toggling.

3. **Copy link button:** Small link/share icon in `HeaderBar.tsx`. `navigator.clipboard.writeText(window.location.href)` on click. Brief "Copied" tooltip (1.5s fade).

**Files to modify:**
- `viewer/src/app/view/[build]/[region]/page.tsx` — parse searchParams on mount
- `viewer/src/stores/viewport.ts` — add URL sync subscription
- `viewer/src/components/HeaderBar.tsx` — add copy button

**Estimated time:** 3-4 hours

---

### Task B3: Probe Search in Viewer

**What:** The viewer's search bar currently handles gene symbols and `chr:start-end` coordinates. Extend to detect probe IDs (`cg\d+`, `ch\d+`) and navigate to the probe's genomic position.

**Why:** PLATFORM_ROADMAP Phase 4. When you're working with your 35-probe panel, you want to type `cg08796240` and jump directly to VAC14.

**Implementation steps:**

1. **Pattern detection in search input handler:**
   ```typescript
   const isCgProbe = /^cg\d{6,8}$/i.test(query);
   const isChProbe = /^ch\.\d+/i.test(query);
   ```

2. **Probe resolution:** If probe ID detected, call `/v1/probes/{build}/{probe_id}` → extract coordinates → navigate to `chr:pos-500` to `chr:pos+500` (1kb window centered on probe).

3. **Autocomplete type badges:** Show `[Gene]`, `[Probe]`, or `[Region]` badges in search dropdown to disambiguate result types.

**Files to modify:**
- `viewer/src/components/HeaderBar.tsx` — search input handler + autocomplete display
- `viewer/src/lib/api.ts` — add `fetchProbe()` client function (if not present)

**Estimated time:** 2-3 hours

---

### Task B4: Proximity Query Endpoint

**What:** New API endpoint: `GET /v1/query?gene=TP53&radius=5000&layers=cpg_sites,probe_epic_v2&build=hg38`

**Why:** PLATFORM_ROADMAP Phase 4. Currently getting "everything near gene X" requires: (1) look up gene → get coordinates, (2) expand by radius, (3) query region with layers. This collapses it into one call — which is what bioinformaticians actually want.

**Implementation:**

1. **New router:** `src/polymer_genomics/routers/query.py`
2. **Logic:** Accept `gene` OR `probe` OR `region` as anchor. Accept `radius` (default 5000bp). Look up anchor coordinates, expand by radius, delegate to existing region query logic.
3. **Response:** Standard envelope with `layers_resolved` + multi-layer data.

```python
@router.get("")
async def proximity_query(
    build: str = Query(...),
    gene: str | None = None,
    probe: str | None = None,
    region: str | None = None,
    radius: int = Query(default=5000, le=1_000_000),
    layers: str | None = None,
):
    # Resolve anchor to coordinates
    if gene:
        # lookup gene → get span → expand by radius
    elif probe:
        # lookup probe → get position → expand by radius
    elif region:
        # parse region → expand by radius
    else:
        raise HTTPException(400, "Provide gene, probe, or region")

    # Delegate to region query logic
    ...
```

4. **Register router** in `main.py`
5. **Add MCP tool** wrapping this endpoint
6. **Update Python + R clients**

**Estimated time:** 4-5 hours

---

### Task B5: Track Registry Refactor

**What:** Replace the hardcoded if/else chain in `TrackStack.tsx` with a registry map that associates layer keys to track components.

**Why:** PLATFORM_ROADMAP Phase 5 prep. Currently adding a new track (e.g., MethylationTrack) means modifying `TrackStack.tsx`. A registry makes track addition declarative — critical for the user data overlay feature planned later.

**Current pattern (hardcoded):**
```typescript
{data?.layers?.gencode_v44 && <GeneTrack data={...} />}
{data?.layers?.cpg_sites && <CpgTrack data={...} />}
// ... 6 conditionals
```

**Target pattern (registry):**
```typescript
const TRACK_REGISTRY: Record<string, React.ComponentType<TrackProps>> = {
  gencode_v44: GeneTrack,
  cpg_sites: CpgTrack,
  cpg_islands: CpgIslandTrack,
  probe_epic_v2: ProbeTrack,
  isochores: IsochoreTrack,
  sequence: SequenceTrack,
  gc_content: GCTrack,
  // Methylation tracks registered dynamically from layer discovery
};

// Render: iterate activeLayers, look up component, render
{activeLayers.map(key => {
  const Track = TRACK_REGISTRY[key];
  return Track ? <Track key={key} data={data?.layers?.[key]} ... /> : null;
})}
```

**Files to modify:**
- `viewer/src/components/TrackStack.tsx` — refactor to registry
- Possibly extract `TrackProps` interface to shared types

**Estimated time:** 2-3 hours

---

### Task B6: MCP Server PyPI Publishability

**What:** Add `pyproject.toml` to `mcp/` so the MCP server installs via `pip install polymer-genomics-mcp` with a `polymer-genomics-mcp` CLI entry point.

**Why:** PLATFORM_ROADMAP Phase 2. Frictionless installation for any Claude Code user. Currently requires cloning the repo and running via `uv`.

**Implementation:**

```toml
# mcp/pyproject.toml
[project]
name = "polymer-genomics-mcp"
version = "0.1.0"
description = "MCP server for Polymer Genomics — genomic reference lookups for AI agents"
requires-python = ">=3.11"
dependencies = [
    "mcp>=1.0.0",
    "httpx>=0.28.0",
]

[project.scripts]
polymer-genomics-mcp = "polymer_genomics_mcp.server:main"
```

**Also:**
- Enrich tool docstrings with "when to use this" hints (PLATFORM_ROADMAP Phase 2)
- Write 5-10 example prompts in README
- Ensure the package works with `uvx polymer-genomics-mcp` for zero-install use

**Estimated time:** 2-3 hours

---

## Implementation Order

```
Week 1 (blocking — TET2 research)
├── A1: Source methylation reference (Salas EPIC)           2-4 hrs
├── A2: Generate 450K reference matrix                      1-2 hrs
├── A3: Methylation heatmap track                           3-4 hrs
└── A4: MCP methylation tools                               1 hr
                                                    Total:  7-11 hrs

Week 2 (nice-to-have — platform polish)
├── B5: Track registry refactor (do BEFORE adding meth track) 2-3 hrs
├── B2: Shareable viewer URLs                               3-4 hrs
├── B3: Probe search in viewer                              2-3 hrs
└── B6: MCP server PyPI publish                             2-3 hrs
                                                    Total:  9-13 hrs

Week 3 (nice-to-have — clients + API)
├── B1: Python client library                               6-8 hrs
└── B4: Proximity query endpoint                            4-5 hrs
                                                    Total:  10-13 hrs
```

**Revised order note:** Task B5 (track registry refactor) should be done BEFORE Task A3 (methylation track). If you're going to add a 7th track type, do the refactor first so the methylation track is the first track registered via the new pattern rather than the last one crammed into the old if/else chain.

Revised sequence:
```
Day 1:  A1 + A2 (data sourcing — R scripts, ~3-5 hrs)
Day 2:  B5 (track registry refactor, ~2-3 hrs)
Day 3:  A3 (methylation track, now uses registry, ~3-4 hrs)
Day 4:  A4 + B6 (MCP polish, ~3 hrs)
Day 5:  B2 + B3 (viewer UX — URLs + probe search, ~5-7 hrs)
Day 6-7: B1 (Python client, ~6-8 hrs)
Day 8:  B4 (proximity query, ~4-5 hrs)
```

---

## What This Plan Does NOT Cover

These items from the strategic plan and PLATFORM_ROADMAP are explicitly deferred:

- **hg37 support** — Legacy build, no current demand
- **User data overlays** (PLATFORM_ROADMAP Phase 5) — Depends on track registry (B5) but overlay feature itself is future work
- **Authentication / rate limiting** (PLATFORM_ROADMAP Phase 6) — No external users yet
- **CI/CD pipelines** (PLATFORM_ROADMAP Phase 6) — Useful but not blocking anything
- **Monitoring / status page** (PLATFORM_ROADMAP Phase 6) — Personal use, manual checks sufficient
- **Mobile responsive viewer** — Desktop is the primary surface
- **RDS bulk exports** — Parquet works; R client can convert locally
- **Public API documentation website** — No external users yet

---

## Dependencies

```
A1 (methylation data)
 └── A2 (450K data) [independent, can run in parallel]
 └── A3 (methylation track) [blocked by A1]
      └── A4 (MCP tools) [blocked by A1, can run in parallel with A3]

B5 (track registry) → A3 (methylation track uses registry)

B1-B4, B6 are independent of each other and of Part A
```

---

## Success Criteria

**Part A complete when:**
- [ ] `curl .../v1/layers?type=methylation` returns 6 cell-type layers (or 12 if 450K separate)
- [ ] Viewer shows methylation heatmap at `/view/hg38/chr16:70699000-70700000` with visible beta gradients
- [ ] MCP query "What's the monocyte methylation at cg08796240?" returns a numeric beta value
- [ ] VAC14 region in viewer shows methylation context alongside gene model + probes

**Part B complete when:**
- [ ] `pip install polymer-genomics` works and `polymer.gene("hg38", "TP53")` returns a DataFrame
- [ ] Viewer URL `?layers=gencode_v44,meth_Mono` reconstructs exact view on page load
- [ ] Typing `cg08796240` in viewer search bar navigates to chr16:70699429-70700429
- [ ] `/v1/query?gene=VAC14&radius=10000&layers=cpg_sites` returns features in one call
- [ ] `pip install polymer-genomics-mcp` works for zero-friction Claude Code setup
