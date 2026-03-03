# Polymer Genomics — Platform Roadmap

## Current State

What exists today:
- **API**: FastAPI backend with 11 endpoints, GRanges response format, PostgreSQL + FASTA
- **Viewer**: Next.js genome browser with canvas rendering, 6 track types, keyboard nav
- **MCP Server**: Fully built, 9 tools, stdio transport — ready for Claude Code integration
- **R Client**: Complete `polymergenomics` package with native GRanges returns via Bioconductor
- **Data**: GENCODE v44, CpG sites (28M), EPIC v2/v1/450K probes, isochores, hg38 reference

What's missing: Python client, shareable state, rich search, documented MCP, extensibility story.

---

## Phase 1: Python Client Library (ship this week)

**Goal**: `pip install polymer-genomics` gives bioinformaticians a zero-friction way to query Polymer from notebooks and scripts.

### Design

The client mirrors the R package's API surface exactly — same function names, same arguments, same mental model. A user who knows one knows both.

```python
import polymer

polymer.connect("https://api.polymerbio.org")

# Query a region — returns dict of DataFrames keyed by layer
region = polymer.region("hg38", "chr17:7668421-7687490", layers=["gencode_v44", "cpg_sites"])
region["gencode_v44"]  # pandas DataFrame with chr, start, end, strand, gene_symbol, ...
region["cpg_sites"]    # pandas DataFrame with chr, start, end, context, gc_content

# Gene lookup
tp53 = polymer.gene("hg38", "TP53")  # DataFrame

# Probe lookup
probe = polymer.probe("hg38", "cg00000029")  # dict with 'probe' DataFrame + 'crossmap' DataFrame

# Batch probes
probes = polymer.probe_batch("hg38", ["cg00000029", "cg00000108"])  # DataFrame

# Sequence
seq = polymer.sequence("hg38", "chr17:7676000-7676100")  # str

# Search
polymer.search("BRC", build="hg38")  # list of dicts

# Layer discovery
polymer.layers(build="hg38")  # DataFrame

# Aggregation
agg = polymer.aggregate("hg38", "chr17:7000000-8000000", layers=["cpg_sites"], resolution=10000)
```

### Implementation

**Package structure:**
```
polymer-genomics/
├── pyproject.toml
├── src/polymer_genomics_client/
│   ├── __init__.py       # Re-exports all public functions
│   ├── client.py         # Connection state, HTTP calls via httpx
│   ├── converters.py     # JSON → DataFrame conversion (GRanges → tabular)
│   └── types.py          # TypedDict definitions for response shapes
```

**Key decisions:**
- Import as `import polymer` (package name `polymer-genomics`, import name `polymer`)
- Dependencies: `httpx`, `pandas`. Nothing else. No heavy bio deps in core.
- GRanges JSON → DataFrame conversion: flatten seqnames, ranges.start, ranges.end, ranges.width, strand, and all mcols columns into a single DataFrame
- Connection state stored in module-level singleton (same pattern as R client's pkg.env)
- All functions accept optional `build` override; default from `connect()` call
- Sync httpx client in v1. Keep it simple. Async later if demand exists.
- Error handling: raise `PolymerError` with the API's error message

**Publish to PyPI.** `pip install polymer-genomics` must work on day one.

---

## Phase 2: MCP Server Polish + Documentation (same week)

**Goal**: Any AI agent can use Polymer as its genomic context layer, and it's documented well enough that developers integrate it in minutes.

### What exists
The MCP server at `mcp/` is fully functional with 9 tools. It works.

### What's needed

1. **Installation docs on the site**: New page at `/docs/mcp` with the exact JSON snippet to paste into Claude Code's MCP config. Same branded aesthetic as the API docs.

2. **Enriched tool descriptions**: Each tool docstring gets a "when to use this" hint that helps the LLM pick the right tool. Example: `query_region` should say "Use this when you need to know what genes, CpG sites, or probes exist in a specific chromosomal region."

3. **Example prompts**: 5-10 natural language prompts showing what an agent can do:
   - "What genes are near chr17:7668421-7687490?"
   - "Look up the CpG context for probe cg00000029"
   - "Is TP53 in a CpG island?"
   - "What's the GC content around BRCA1?"

4. **PyPI installability**: Add `pyproject.toml` to `mcp/` so the server installs via `pip install polymer-genomics-mcp`. Frictionless setup: `polymer-genomics-mcp` as the command entry point.

---

## Phase 3: Shareable Viewer State (next 1-2 weeks)

**Goal**: A URL reconstructs the exact viewer state — region, active layers, context panel, everything.

### URL format
```
/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites&ctx=1
```

The region is already in the path. Query params capture:
- `layers`: comma-separated active layer keys
- `ctx`: context panel visible (0 or 1)

Clean enough to paste into Slack or a paper's supplementary materials.

### Implementation

1. **State → URL**: When viewport state changes, `window.history.replaceState` with updated query params (debounced 500ms). No page reload.
2. **URL → State on mount**: Parse query params and hydrate Zustand store before first data fetch.
3. **Copy link button**: Small link icon in the header bar. Click → copies current URL to clipboard. Brief "Copied" tooltip fades after 1.5s.

---

## Phase 4: Rich Search + Cross-Layer Queries (2-3 weeks)

**Goal**: The search bar becomes a discovery tool, not just a gene name resolver.

### Probe search in the viewer

The header bar currently handles `chr:start-end` and gene symbols. Extend to detect probe IDs (`cg\d+`, `ch\d+`) → call probe lookup → navigate to probe's genomic position with appropriate zoom.

### Richer autocomplete

The search dropdown shows type badges alongside results:
```
[Gene]  TP53
[Gene]  TP53BP1
[Probe] cg00000029    (if probe search added)
```

### Proximity query — new API endpoint

```
GET /v1/query?gene=TP53&radius=5000&layers=cpg_sites,probe_epic_v2&build=hg38
```

A single call that says "give me everything interesting near this gene." Returns the standard multi-layer envelope. This is what bioinformaticians currently cobble together with 3-4 separate calls.

### Implementation
- Extend `search` router to accept probe IDs and coordinate strings
- Add `query` router for proximity/cross-layer lookups
- Update `HeaderBar.tsx` search input to detect probe ID patterns
- Add type badges to autocomplete dropdown
- Update MCP tools, Python client, and R client with new endpoints

---

## Phase 5: User Data Overlays — Architecture Design (future, not building yet)

### Vision

A researcher drags a CSV onto the viewer. Their probe-level methylation values or region-level measurements render as a new track, layered on top of curated reference data. Like IGV's "load from file" but browser-native, with Polymer's context underneath.

### Key architectural principle: client-side only

User data never leaves their machine. The browser parses the file, matches identifiers to existing track positions, and renders locally. This is both a privacy feature and a simplicity feature — no upload infrastructure, no storage costs, no auth.

### Two overlay modes (eventually)

**Probe-keyed**: User uploads `probe_id, beta_value`. The viewer matches against known probe positions (already loaded from the API) and renders as a color-coded heatmap track. Covers 90% of methylation array workflows.

**Region-keyed**: User uploads `chr, start, end, value`. Generic BED-like format. Works for any genomic data type. Rendered as bar chart or heatmap.

### Preparatory refactors to do now (in earlier phases)

These changes keep the door open for overlays without building the feature:

1. **Track registry in TrackStack.tsx**: Replace the current hardcoded if/else chain with a registry that maps layer keys to track components. When overlays arrive, they register as a new track type without modifying TrackStack.

2. **Zustand store supports arbitrary layer keys**: Currently `activeLayers` contains known keys like `gencode_v44`. It already works with arbitrary strings, but the sidebar's layer list is partially hardcoded. Make the sidebar fully data-driven.

3. **UserTrack component stub**: Create the component interface that an overlay track would implement. Renders nothing yet. Establishes the contract.

---

## Phase 6: Platform Infrastructure (parallel, ongoing)

### API keys and usage tracking
- Issue API keys for programmatic users (simple table + middleware — the auth middleware already exists but is optional)
- Log usage per key: endpoint, region, layers, timestamp, latency
- Rate limiting: 100 req/min anonymous, 1000 req/min keyed
- Usage data tells you who depends on what — that's your roadmap signal

### CI/CD
- TypeScript check + lint on PR (viewer)
- pytest on PR (API)
- R CMD check on PR (r-client)
- Preview deployments for frontend (Vercel already supports this)

### Monitoring
- Expose `/health` as a status page on the site
- Track query latency P50/P95/P99
- Alert on error rate spikes

---

## Implementation Order

```
Week 1:  Python client → publish to PyPI
         MCP docs page on site + enriched tool descriptions
         Shareable URLs (query param sync + copy button)

Week 2:  Probe ID search in viewer search bar
         Autocomplete type badges
         MCP server → publish to PyPI
         Track registry refactor (prep for overlays)

Week 3:  Proximity query endpoint (/v1/query)
         Update all clients with new endpoints
         API key issuance + usage logging
         CI/CD pipeline

Future:  User data overlay implementation
         Community layers
         Comparative multi-region view
```

---

## What We Are NOT Doing

- No accounts or user authentication. Open access is the identity.
- No server-side uploads. Overlays are client-side only, when they come.
- No social features, comments, or annotations. Too early, no user base yet.
- No multi-region comparative view. Compelling but scope-heavy; defer.
- No mobile-optimized viewer. Desktop is the primary surface for genomics work.
