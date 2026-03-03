# Polymer Genomics — Agent Harness Architecture
*Last updated: 2026-03-02*

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
| MCP Server — 9 tools, FastMCP, stdio | ✅ Complete |
| R Client — 8 functions, httr2, GRanges | ✅ Complete |
| Tool docstrings — basic, accurate | ✅ Adequate but sparse |
| Domain context pre-loading | ❌ Missing |
| Tool composition patterns | ❌ Not documented |
| R/Bioconductor bridge | ❌ Not formalized |
| Output contracts (Pydantic models) | ❌ Returns bare dict |
| MCP Resources for static context | ❌ Not implemented |
| PyPI publishable | ❌ Pending |

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

### Step 0 — Bioinformatics Harness Slash Command
*2–4 hrs. Implement first — tests all routing patterns with the current API.*

Create `.claude/commands/bioinfo.md` at the project root. This is a Claude Code slash command that pre-loads domain knowledge when a user types `/bioinfo` before starting a genomics session.

**Content to encode:**

```markdown
# Polymer Genomics — Bioinformatics Agent Context

## Coordinate System
- API is 1-based CLOSED. Region chr16:70699929-70700500 = 572 bp including both endpoints.
- Internal DB is 0-based half-open (handled automatically by the API).
- Never manually shift coordinates. Trust the API response values.

## GRanges Response Format
All region/gene/probe queries return GRanges-structured JSON:
{
  "seqnames": ["chr16", "chr16", ...],    # chromosome
  "ranges": {"start": [n,...], "end": [n,...]},  # 1-based closed
  "strand": ["+", "-", "*", ...],
  "mcols": { "gene_symbol": [...], "feature_type": [...], ... }  # layer-specific columns
}
- "start" and "end" are already 1-based closed in the response.
- mcols keys vary by layer_type. Always inspect before accessing.

## Truncation Recovery
- If status == "truncated", the query hit the row limit (default 1000, max 50000).
- Recovery options (in order of preference):
  1. Use aggregate_region with resolution=1000 for an overview first.
  2. Split the region into sub-regions and query each.
  3. Add layers= filter to reduce results per request.
  4. Use bulk_download for full layer data.
- NEVER report a truncated result as complete data.

## Tool Selection Guide

| Task | Primary Tool | Notes |
|------|-------------|-------|
| Find gene coordinates | lookup_gene | Returns exons, introns, UTRs |
| What annotations are available | list_layers | Filter by layer_type |
| Everything in a region | query_region | Use layers= to filter |
| Probe by ID | lookup_probe | Returns chr, pos, gene, CpG context |
| Multiple probes | batch_probes | Up to 10,000 per call |
| Density overview of large region | aggregate_region | Use resolution=10000 or 100000 |
| Gene symbol lookup / autocomplete | search | Prefix match |
| Raw DNA sequence | get_sequence | Max 100,000 bp |
| Full layer data | bulk_download | Returns presigned URL |

## Tool Composition Patterns

**Pattern: Analyze a gene locus**
1. search(query=symbol) → verify gene exists
2. lookup_gene(symbol) → get coordinates and structure
3. query_region(region=gene_bounds, layers="cpg_sites,probe_epic_v2,dhs") → overlapping features
4. aggregate_region(region=expanded_bounds, resolution=1000) → density profile

**Pattern: Probe-to-locus context**
1. lookup_probe(probe_id) → get coordinates
2. query_region(region=probe±2kb, layers="gencode_v44,cpg_sites") → surrounding context
3. get_sequence(region=probe±200bp) → raw sequence for manual inspection

**Pattern: Large region overview → drill down**
1. aggregate_region(region, resolution=100000) → coarse density
2. Identify interesting subregion from density peaks
3. query_region(subregion, layers=relevant_layers) → fine-grained features

## Common Errors and Recovery

| Error | Cause | Recovery |
|-------|-------|----------|
| REGION_TOO_LARGE | Region > 10Mb | Split into sub-regions |
| BUILD_MISMATCH | Layer not available for requested build | list_layers to confirm build support |
| LAYER_NOT_FOUND | layer_key not registered | list_layers to see valid keys |
| status=truncated | Row limit hit | See Truncation Recovery above |
| probe not found | Probe not on this array platform | Check probe_id prefix and platform |

## R/Bioconductor Integration
Some analyses require R tools beyond what the API provides:
- Cell type deconvolution (minfi, FlowSorted packages)
- Differential methylation (limma, missMethyl)
- IDAT-level QC (minfi, ewastools)
- Bioconductor annotation packages (TxDb, org.Hs.eg.db)

For R tasks in Claude Code: use the Bash tool to run R scripts.
Standard pattern:
  Rscript /path/to/script.R --args param1 param2

API and R are complementary:
- Use API for: reference lookups, coordinate queries, region annotation, probe metadata
- Use R for: statistical testing, normalization, cell deconvolution, IDAT processing
- Combine: query API for probe coordinates → run R deconvolution → query API for locus context
```

---

### Step 1 — Enhanced MCP Tool Descriptions
*2–4 hrs. Improves agent performance immediately with no infrastructure changes.*

For each of the 9 tools in `mcp/polymer_genomics_mcp/server.py`, enhance the docstring to include:

1. **When to use this tool** (vs. alternatives)
2. **Returns** — format, fields, and what truncation means
3. **Common patterns** — one or two example invocations
4. **Edge cases** — known quirks, error conditions

Template:
```python
@mcp.tool()
async def query_region(build: str, region: str, layers: str | None = None) -> dict:
    """Query genomic features in a chromosomal region.

    Returns all annotation features (genes, CpG sites, probes, isochores) that
    overlap the specified region. Results are in GRanges format with 1-based
    closed coordinates.

    Use this when:
    - You need all annotations overlapping a specific genomic interval.
    - You already know the coordinates (use lookup_gene first if you only have a symbol).
    - Prefer aggregate_region for regions > 500kb (summary statistics are faster).

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region in format 'chr16:70699930-70700000' (1-based closed).
        layers: Comma-separated layer keys to query (e.g. 'cpg_sites,gencode_v44').
                Omit to query all active layers. See list_layers() for valid keys.

    Returns:
        GRanges-structured JSON. Check status field: 'truncated' means row limit
        was hit and results are incomplete. Use aggregate_region for overview,
        then drill down into sub-regions.

    Common patterns:
        query_region('hg38', 'chr16:70699929-70700500')
        query_region('hg38', 'chr7:117548628-117548880', layers='gencode_v44,cpg_sites')
    """
```

Also add progress reporting to `aggregate_region` and `batch_probes` (long-running tools):
```python
async def aggregate_region(..., ctx: Context | None = None) -> dict:
    if ctx:
        await ctx.report_progress(0.0, 1.0, "Fetching binned statistics...")
    result = await _get(...)
    if ctx:
        await ctx.report_progress(1.0, 1.0, "Complete")
    return result
```

---

### Step 2 — AGENT.md
*2–3 hrs. Portable: works with any MCP client, not just Claude Code.*

Create `mcp/AGENT.md` co-deployed with the MCP server. Any MCP client that implements the emerging AGENT.md convention will automatically load this as context.

Content: coordinate conventions, layer types, GRanges format, common workflow patterns — portable version of the slash command without Claude Code–specific syntax.

**Rule:** The slash command (Step 0) is for Claude Code users. AGENT.md is for any MCP client. Keep them in sync but don't duplicate at the expense of one being incomplete.

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

### Step 4 — R/Bioconductor Bridge
*1–2 days. Enables R tool calls from within the MCP server for tasks that genuinely require Bioconductor.*

**Architecture decision: async subprocess pattern (not rpy2).**

Rationale:
- R crashes don't hang the MCP server
- R dependencies isolated via `renv`
- Scripts run identically from R console or MCP
- Deployment flexibility (R can be on a different machine)
- rpy2 has GIL blocking issues and complex Bioconductor dependency chains

**Implementation:**

```python
# mcp/polymer_genomics_mcp/r_bridge.py
import asyncio
import json
import subprocess
from pathlib import Path

R_SCRIPTS = Path(__file__).parent / "r_scripts"

async def call_r(script: str, args: dict, timeout: int = 120) -> dict:
    """Call an R script asynchronously with JSON I/O."""
    cmd = ["Rscript", str(R_SCRIPTS / f"{script}.R"), json.dumps(args)]
    result = await asyncio.to_thread(
        subprocess.run, cmd, capture_output=True, text=True, timeout=timeout
    )
    if result.returncode != 0:
        raise RuntimeError(f"R error in {script}: {result.stderr.strip()}")
    return json.loads(result.stdout)
```

**R script convention** (`r_scripts/*.R`):
```r
#!/usr/bin/env Rscript
args <- jsonlite::fromJSON(commandArgs(trailingOnly=TRUE)[1])
# ... Bioconductor operations using args ...
result <- list(...)
cat(jsonlite::toJSON(result, auto_unbox=TRUE))
```

**Initial R tools to implement:**

| Tool | Script | Bioconductor packages | Use case |
|------|--------|-----------------------|----------|
| `cell_deconvolution` | `cell_deconv.R` | minfi, FlowSorted.Blood.EPIC | Estimate cell type proportions from beta values |
| `run_limma_dmps` | `limma_dmps.R` | limma, minfi | Differential methylation (two-group) |
| `probe_qc` | `probe_qc.R` | minfi, ewastools | Flag probes by detection p, SNP overlap, crosshybridization |

These are additive to the existing 9 MCP tools and do not replace them.

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

| Step | What | Time | Unlock |
|------|------|------|--------|
| 0 | Bioinformatics slash command | 2–4 hrs | Immediate agent quality improvement |
| 1 | Enhanced tool descriptions | 2–4 hrs | Better tool selection, fewer errors |
| 2 | AGENT.md | 2–3 hrs | Portable across all MCP clients |
| 3 | Pydantic output contracts | 4–6 hrs | Schema-aware tool composition |
| 4 | R/Bioconductor bridge | 1–2 days | Cell deconvolution, DMP testing from MCP |
| 5 | MCP Resources | 3–4 hrs | Session-start context loading, reduced tool calls |
| — | PyPI publish | 2–3 hrs | One-line install for any user |

Steps 0–2 are purely additive documentation. Steps 3–5 require code changes. Do them in order.

---

## What Is Excluded and Why

| Item | Reason |
|------|--------|
| Polymer Evolution L0–L3 as API layers (stacking_dG, wrapping_energy, curvature, etc.) | Computed from first-principles sequence parameters. Phase 1 external validation (AUROC 0.72) confirmed GC content predicts accessibility — but GC is already captured in the isochore layer. The derived physics quantities need independent, cross-platform experimental validation before becoming reference layers. |
| MethSig channel assignment endpoint | Requires physics quintiles (excluded above) |
| BiologicalEntity schema | Speculative research concept; not a production platform feature |
| rpy2 Python-R integration | GIL blocking, complex dependency chains, less reproducible than subprocess; use async subprocess instead |
| Fragmented cfDNA integration | Too early; no validated endpoint in current data |
