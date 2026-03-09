# Polymer Genomics — Agent Harness Architecture
*Last updated: 2026-03-09*

---

## Purpose

The Polymer Genomics API is a correlative genomics reference engine. The agent harness is the domain knowledge layer that makes AI agents expert-level bioinformaticians when using it.

Without a harness, even a capable model with tool access makes systematic errors:
- Confuses 0-based and 1-based coordinate conventions
- Misinterprets GRanges truncation as complete data
- Calls `query_region` when `aggregate_region` is appropriate
- Doesn't know how to chain tools for multi-step analyses
- Doesn't know which tasks require R/Bioconductor vs. API calls alone

The harness solves this through pre-loaded domain context, explicit tool composition patterns, and a well-designed R/Bioconductor bridge.

---

## Current State

| Component | Status |
|-----------|--------|
| MCP Server — 33 tools (23 reference + 10 compute), FastMCP, stdio | ✅ Complete |
| R Client — 8 functions, httr2, GRanges | ✅ Complete |
| Tool docstrings — enhanced with "Use this when" patterns | ✅ Complete |
| Domain context pre-loading (`/bioinfo` slash command) | ✅ Complete |
| Tool composition patterns (AGENT.md + bioinfo.md) | ✅ Complete |
| R/Bioconductor bridge (async subprocess, JSON I/O) | ✅ Complete |
| Methylation compute engine (10 tools, 8 R scripts) | ✅ Complete |
| Output contracts (Pydantic models) | ❌ Returns bare dict |
| MCP Resources for static context | ❌ Not implemented |
| PyPI publishable | ❌ Pending |
| Docker image for non-R users | ✅ Dockerfile ready (not yet built/published) |

---

## Architecture

The harness has five layers. Each is independent and can be implemented in order.

```
Layer 5: MCP Resources          Static context served to agents at session start
Layer 4: R/Bioconductor Bridge  Async subprocess pattern for R tool calls
Layer 3: Domain Context         Slash command / AGENT.md / system prompt
Layer 2: Output Contracts       Pydantic models for typed, schema-validated responses
Layer 1: MCP Tools              9 tools (already complete)
```

---

## Implementation Plan

### Step 0 — Bioinformatics Harness Slash Command ✅ COMPLETE
*Completed 2026-03-02.*

`.claude/commands/bioinfo.md` created with coordinate conventions, tool selection guide, composition patterns, truncation recovery, and R/Bioconductor integration guidance. Updated 2026-03-09 with compute tool section.

---

### Step 1 — Enhanced MCP Tool Descriptions ✅ COMPLETE
*Completed 2026-03-02.*

All 23 reference tool docstrings include "Use this when" hints, return format descriptions, and edge case notes. 10 compute tools added 2026-03-09 with full descriptions.

---

### Step 2 — AGENT.md ✅ COMPLETE
*Completed 2026-03-02. Updated 2026-03-09 with compute tools section.*

`mcp/AGENT.md` co-deployed with MCP server. Covers coordinate conventions, 33-tool selection guide, composition patterns (including full methylation analysis workflow), layer catalog, and graceful degradation notes. Updated to include compute tool workflow pattern and "Without R Installed" section.

---

### Step 3 — Pydantic Output Contracts
*4–6 hrs. Makes tools schema-aware: agents can see field names and types before calling.*

Replace bare `dict` return types with Pydantic models in `server.py`. FastMCP auto-generates JSON schemas from these, which Claude sees during tool selection.

Key models to define:

```python
class GeneFeature(BaseModel):
    seqnames: list[str]
    start: list[int]
    end: list[int]
    strand: list[str]
    gene_symbol: list[str]
    feature_type: list[str]   # "exon", "intron", "UTR", "transcript"
    transcript_id: list[str]

class GeneResponse(BaseModel):
    status: Literal["complete", "truncated"]
    build: str
    symbol: str
    features: GeneFeature
    layers_resolved: list[dict]
    timing: dict

class ProbeAnnotation(BaseModel):
    probe_id: str
    build: str
    seqnames: str
    start: int        # 1-based
    end: int          # 1-based (= start for single-base probes)
    strand: str
    gene_symbol: str | None
    cpg_context: str  # "island", "shore", "shelf", "open_sea"
    platforms: list[str]   # ["epic_v2", "epic_v1", "450k"]

class RegionResponse(BaseModel):
    status: Literal["complete", "truncated"]
    build: str
    region: str
    feature_count: int
    layers_resolved: list[dict]
    data: dict        # GRanges format, keys vary by layer_type
    coordinate_system: dict
    timing: dict
```

Priority order: `lookup_gene` → `lookup_probe` → `query_region` → `aggregate_region` → `batch_probes`

---

### Step 4 — R/Bioconductor Bridge ✅ COMPLETE
*Completed 2026-03-09. This is the core deliverable of the Polymer Methylation Ecosystem plan.*

**Architecture:** async subprocess pattern (not rpy2), exactly as specified.

**Implementation:**

- `mcp/polymer_genomics_mcp/compute.py` — async subprocess runner + session manager (~150 lines)
  - `call_r(script, args, timeout)` — runs Rscript with `cwd=R_SCRIPTS`, JSON I/O
  - `create_session()` / `session_dir()` / `cleanup_session()` — session lifecycle
  - `r_available()` / `require_r()` — graceful degradation when R not installed
  - Sessions stored in `/tmp/polymer/sessions/{id}/` with `.rds` checkpoints

- `mcp/polymer_genomics_mcp/compute_tools.py` — 10 MCP tool definitions (~250 lines)
  - Imported by `server.py` via `_register_compute_tools()` at module load
  - Registration wrapped in try/except — reference tools work even if compute module fails

- `engine/r_scripts/` — 8 R scripts (~500 lines total), JSON-in/JSON-out contract:
  - `utils.R` — shared helpers (parse_args, emit_json, stop_json, checkpoint I/O)
  - `load_idats.R` — IDAT loading, array detection (450K/EPIC/EPICv2), initial QC
  - `normalize.R` — 5 methods (openSesame, funnorm, quantile, noob, raw)
  - `filter_probes.R` — detection p-val, SNP, sex chr, cross-reactive filtering
  - `run_limma.R` — limma eBayes on M-values with delta-beta computation
  - `volcano_plot.R` — ggplot2 volcano with base64 PNG output
  - `cluster_probes.R` — ComplexHeatmap/heatmap clustering of top variable probes
  - `get_values.R` — beta/M-value extraction (inline <=100 probes, CSV for more)

- `engine/Dockerfile` — rocker/r-ver:4.5.0 + Bioconductor + Python MCP (~1.4 GB)
- `engine/requirements_r.txt` — 11 R packages (minfi, sesame, limma, ComplexHeatmap, etc.)

**10 compute tools registered:**

| Tool | R Script | Purpose |
|------|----------|---------|
| `load_idats` | `load_idats.R` | Load IDATs, create session |
| `normalize` | `normalize.R` | Normalize (openSesame/funnorm/etc.) |
| `filter_probes` | `filter_probes.R` | QC filtering |
| `run_limma` | `run_limma.R` | Differential methylation |
| `get_betas` | `get_values.R` | Extract beta values |
| `get_m_values` | `get_values.R` | Extract M-values |
| `volcano_plot` | `volcano_plot.R` | Volcano plot visualization |
| `cluster_probes` | `cluster_probes.R` | Clustering heatmap |
| `session_status` | (Python only) | Check pipeline progress |
| `cleanup_session_tool` | (Python only) | Remove session data |

**Session state machine:**
```
load_idats → [raw.rds] → normalize → [normalized.rds] → filter → [filtered.rds]
                                                              ↓
                                                       run_limma → [dmps.rds]
                                                              ↓
                                                   volcano_plot / cluster_probes
```

**Verified:** All R scripts parse clean, Python→R bridge tested end-to-end (session create → R call → error handling → cleanup), 33 total tools register on MCP server.

---

### Step 5 — MCP Resources for Static Context
*3–4 hrs. Optimization: agents inspect static data once at session start rather than making repeated tool calls.*

Add three Resources to `server.py`:

```python
@mcp.resource("polymer://layers/{build}")
async def layer_catalog(build: str) -> str:
    """All available annotation layers for a genome build.

    Load this at the start of a session to understand what data is available
    before querying regions. Returns JSON list of layer metadata.
    """
    data = await _get(f"/v1/layers", params={"build": build})
    return json.dumps(data, indent=2)

@mcp.resource("polymer://conventions/coordinates")
def coordinate_conventions() -> str:
    """Polymer Genomics coordinate conventions.

    Read this to understand the coordinate system before making any queries.
    External API uses 1-based closed intervals. Example: chr16:70699929-70700500
    """
    return COORDINATE_CONVENTIONS  # inline string constant

@mcp.resource("polymer://conventions/granges")
def granges_format() -> str:
    """GRanges JSON response format reference.

    Explains the structure of all region/gene/probe query responses.
    """
    return GRANGES_FORMAT_REFERENCE  # inline string constant
```

---

## PyPI Publication

Once Steps 1–3 are complete, publish to PyPI:

```toml
# mcp/pyproject.toml
[project]
name = "polymer-genomics-mcp"
version = "1.0.0"

[project.scripts]
polymer-genomics-mcp = "polymer_genomics_mcp.server:main"
```

Install:
```bash
uv tool install polymer-genomics-mcp
```

Configure in Claude Code (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "polymer-genomics": {
      "command": "polymer-genomics-mcp",
      "env": {
        "POLYMER_API_BASE": "https://polymer-api.fly.dev",
        "POLYMER_API_KEY": "your-key"
      }
    }
  }
}
```

---

## Implementation Sequence

| Step | What | Time | Status |
|------|------|------|--------|
| 0 | Bioinformatics slash command | 2–4 hrs | ✅ Complete (2026-03-02) |
| 1 | Enhanced tool descriptions | 2–4 hrs | ✅ Complete (2026-03-02) |
| 2 | AGENT.md | 2–3 hrs | ✅ Complete (2026-03-02, updated 2026-03-09) |
| 3 | Pydantic output contracts | 4–6 hrs | ❌ Pending |
| 4 | R/Bioconductor bridge + compute engine | 1–2 days | ✅ Complete (2026-03-09) |
| 5 | MCP Resources | 3–4 hrs | ❌ Pending |
| — | PyPI publish | 2–3 hrs | ❌ Pending |
| — | Docker image build + publish | 2–3 hrs | Dockerfile ready, not yet built |

Steps 0–2, 4 are complete. Steps 3, 5, and PyPI publish remain.

---

## What Is Excluded and Why

| Item | Reason |
|------|--------|
| Polymer Evolution L0–L3 as API layers (stacking_dG, wrapping_energy, curvature, etc.) | Computed from first-principles sequence parameters. Phase 1 external validation (AUROC 0.72) confirmed GC content predicts accessibility — but GC is already captured in the isochore layer. The derived physics quantities need independent, cross-platform experimental validation before becoming reference layers. |
| MethSig channel assignment endpoint | Requires physics quintiles (excluded above) |
| BiologicalEntity schema | Speculative research concept; not a production platform feature |
| rpy2 Python-R integration | GIL blocking, complex dependency chains, less reproducible than subprocess; use async subprocess instead |
| Fragmented cfDNA integration | Too early; no validated endpoint in current data |
