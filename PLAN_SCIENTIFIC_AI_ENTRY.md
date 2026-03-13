# Scientific AI Market Entry — Implementation Plan

> **Created:** 2026-03-12
> **Goal:** Make Polymer Genomics visible and useful to the scientific AI ecosystem
> **Scope:** API, MCP, frontend, developer experience, commercial readiness
> **Excludes:** Phase 2-3.5 track ingestion (deferred), foundation model building, clinical features
>
> **Status:**
> - Sprint 1 (evaluate_design + compare): COMPLETE
> - Sprint 2 (Python SDK): COMPLETE
> - Sprint 3 (Multi-key auth): DEFERRED — build when users need keys
> - Sprint 4 (Developer landing + docs): COMPLETE

## Executive Summary

Seven sprints over ~10 weeks. The plan builds outward from the single highest-leverage product (`evaluate_design`) through developer experience, commercial infrastructure, and frontend surfaces. Each sprint produces a shippable, testable artifact.

---

## Sprint 1: The Product (Week 1-2)

### 1.1 `POST /v1/evaluate` — Sequence Biophysical Evaluation

**What**: New API endpoint that accepts an arbitrary DNA sequence (not a genomic coordinate) and returns a structured biophysical assessment. This is the core product — the "physics linter."

**File**: Create `src/polymer_genomics/routers/evaluate.py`

**Endpoint spec**:
```
POST /v1/evaluate
Content-Type: application/json

Request:
{
  "sequence": "ATGCGATCGA...",          # Required, 10-100,000 bp
  "name": "my_construct",               # Optional label
  "analysis": "full"                     # Optional: "full" | "thermodynamic" | "structural"
}

Response:
{
  "status": "complete",
  "name": "my_construct",
  "length_bp": 4521,
  "summary": {
    "gc_content": 0.523,
    "mean_stacking_dG37_kcal": -1.42,
    "melting_temp_estimate_C": 84.2,
    "cpg_count": 127,
    "cpg_density": 0.028,
    "cpg_islands": [
      {"start": 1200, "end": 1850, "gc": 0.67, "obs_exp": 0.82}
    ],
    "gc_uniformity": 0.87,
    "repeat_fraction": 0.04
  },
  "thermodynamics": {
    "stacking_dG37": {
      "mean": -1.42,
      "sd": 0.31,
      "min": -2.17,
      "max": -0.58,
      "profile_100bp_windows": [-1.38, -1.45, ...]
    },
    "melting_temp": {
      "global_estimate_C": 84.2,
      "profile_100bp_windows": [78.1, 82.3, ...]
    },
    "extinction_coefficient": {
      "total_M_cm": 45200,
      "per_base_mean": 10.0
    }
  },
  "structural": {
    "form_propensity": {
      "a_form_mean": 0.12,
      "z_form_mean": 0.03,
      "z_form_hotspots": []
    },
    "groove_geometry": {
      "major_width_mean_A": 11.7,
      "minor_width_mean_A": 5.7
    },
    "curvature": {
      "mean_degrees_per_turn": 4.2,
      "high_curvature_regions": [{"start": 890, "end": 920, "curvature": 8.1}]
    }
  },
  "flags": [
    {
      "type": "warning",
      "region": "1200-1850",
      "code": "CPG_ISLAND",
      "message": "CpG island detected (GC=0.67, O/E=0.82) — susceptible to methylation-mediated silencing in mammalian cells"
    },
    {
      "type": "info",
      "region": "3100-3200",
      "code": "LOW_STABILITY",
      "message": "Low stacking stability region (mean ΔG₃₇ = -0.72 kcal/mol) — may facilitate strand separation / regulatory access"
    },
    {
      "type": "info",
      "region": "1-50",
      "code": "HIGH_GC",
      "message": "5' region GC = 0.74 — strong secondary structure potential, may impede translation initiation if in UTR"
    }
  ],
  "timing": {
    "compute_time_ms": 142
  }
}
```

**Implementation approach**:
- Reuse existing computation functions from `biophysics.py`: `compute_thermodynamics()`, `compute_extinction()`, `compute_form_propensity()`, `compute_groove_profile()`
- No database needed — pure sequence computation
- Add new functions: `detect_cpg_islands()` (sliding window: GC≥0.5, O/E≥0.6, ≥200bp), `compute_windowed_profiles()` (100bp windows), `generate_flags()` (rule-based flagging)
- Raise limit from 10kb to 100kb (the current 10kb limit in biophysics.py is for genomic queries with coordinate overhead; raw sequence compute can be larger)
- Mount in `main.py`: `app.include_router(evaluate.router, prefix="/v1")`

**Flag rules to implement** (initial set):
| Code | Trigger | Severity |
|------|---------|----------|
| `CPG_ISLAND` | CGI detected (GG≥0.5, O/E≥0.6, ≥200bp) | warning |
| `LOW_STABILITY` | Window mean ΔG₃₇ > -0.8 | info |
| `HIGH_STABILITY` | Window mean ΔG₃₇ < -1.8 | info |
| `HIGH_GC` | Window GC > 0.70 | info |
| `LOW_GC` | Window GC < 0.30 | info |
| `Z_FORM_PRONE` | Z-form propensity > 0.5 in window | warning |
| `LONG_REPEAT` | Dinucleotide/trinucleotide repeat ≥ 20bp | warning |
| `POLY_TRACT` | Homopolymer ≥ 8bp | warning |
| `HIGH_CURVATURE` | Curvature > 7°/turn in window | info |

**Tests**: Add `tests/test_evaluate.py` with synthetic sequences (high GC, low GC, CGI-containing, repeat-containing, poly-A tract).

### 1.2 `evaluate_design` MCP Tool

**File**: Add to `mcp/polymer_genomics_mcp/server.py`

```python
@mcp.tool()
async def evaluate_design(
    sequence: str,
    name: str = "unnamed",
    analysis: str = "full"
) -> str:
    """Evaluate the biophysical properties of a DNA sequence.

    Takes any DNA sequence (10-100,000 bp) and returns a comprehensive
    biophysical assessment including thermodynamic stability, structural
    properties, CpG islands, and flagged regions of concern.

    Use this tool when:
    - Evaluating a synthetic construct before synthesis
    - Checking a sequence for silencing risk (CpG islands)
    - Assessing thermodynamic stability of a region
    - Identifying structural features (curvature, Z-form propensity)

    Returns: JSON with summary, thermodynamics, structural properties,
    and actionable flags (warnings about CpG islands, low stability,
    repeat elements, etc.)
    """
    resp = await _post("/v1/evaluate", json={
        "sequence": sequence,
        "name": name,
        "analysis": analysis,
    })
    return resp
```

### 1.3 `POST /v1/compare` — Sequence Comparison

**File**: Create `src/polymer_genomics/routers/compare.py`

**Endpoint spec**:
```
POST /v1/compare
Content-Type: application/json

Request:
{
  "sequences": {
    "wildtype": "ATGCGA...",
    "variant_1": "ATGCGA...",
    "variant_2": "ATGCGA..."
  }
}

Response:
{
  "status": "complete",
  "n_sequences": 3,
  "comparison": {
    "length_bp": {"wildtype": 4521, "variant_1": 4521, "variant_2": 4518},
    "gc_content": {"wildtype": 0.523, "variant_1": 0.541, "variant_2": 0.519},
    "mean_stacking_dG37": {"wildtype": -1.42, "variant_1": -1.45, "variant_2": -1.40},
    "cpg_island_count": {"wildtype": 1, "variant_1": 1, "variant_2": 0},
    "flag_count": {"wildtype": 3, "variant_1": 2, "variant_2": 1}
  },
  "deltas_vs_first": {
    "variant_1": {
      "delta_gc": +0.018,
      "delta_mean_dG37": -0.03,
      "delta_cpg_islands": 0,
      "flags_added": [],
      "flags_removed": ["HIGH_GC at 3100-3200"],
      "substitutions": 12,
      "indels": 0
    },
    "variant_2": {
      "delta_gc": -0.004,
      "delta_mean_dG37": +0.02,
      "delta_cpg_islands": -1,
      "flags_added": [],
      "flags_removed": ["CPG_ISLAND at 1200-1850"],
      "substitutions": 8,
      "indels": 1
    }
  },
  "recommendation": "variant_2 eliminates the CpG island (silencing risk) with minimal impact on thermodynamic stability (ΔΔG = +0.02 kcal/mol)"
}
```

**Implementation**:
- Call the evaluate logic for each sequence
- Compute pairwise alignment (simple Needleman-Wunsch or just position-by-position if same length) to identify substitution/indel positions
- Delta computation is arithmetic on evaluate results
- `recommendation` field: simple rule-based logic (fewer flags = better, similar stability = neutral)
- Max 10 sequences per request, each ≤100kb

**MCP tool**: `compare_sequences` wrapping `POST /v1/compare`

---

## Sprint 2: Python SDK (Week 3)

### 2.1 Package: `polymer-genomics`

**Location**: Create `/Users/zbb2/Desktop/PolymerGenomicsAPI/sdk/python/`

**Structure**:
```
sdk/python/
├── pyproject.toml
├── README.md
├── src/
│   └── polymer_genomics/
│       ├── __init__.py
│       ├── client.py
│       ├── models.py
│       └── exceptions.py
└── tests/
    └── test_client.py
```

**`client.py`** core interface:
```python
import httpx
from typing import Optional

class PolymerClient:
    """Client for the Polymer Genomics API."""

    def __init__(
        self,
        api_key: str = None,
        base_url: str = "https://api.polymerbio.org",
        timeout: float = 30.0
    ):
        headers = {}
        if api_key:
            headers["X-API-Key"] = api_key
        self._client = httpx.Client(
            base_url=base_url,
            headers=headers,
            timeout=timeout
        )

    # === Core Products ===

    def evaluate(self, sequence: str, name: str = "unnamed", analysis: str = "full") -> dict:
        """Evaluate biophysical properties of a DNA sequence."""
        return self._post("/v1/evaluate", json={"sequence": sequence, "name": name, "analysis": analysis})

    def compare(self, sequences: dict[str, str]) -> dict:
        """Compare biophysical properties of multiple sequences."""
        return self._post("/v1/compare", json={"sequences": sequences})

    # === Gene Lookup ===

    def gene(self, build: str, symbol: str) -> dict:
        """Look up a gene by symbol (supports aliases)."""
        return self._get(f"/v1/genes/{build}/{symbol}")

    def gene_expression(self, build: str, symbol: str) -> dict:
        """GTEx v10 expression across 54 tissues."""
        return self._get(f"/v1/genes/{build}/{symbol}/expression")

    def gene_cost(self, build: str, symbol: str) -> dict:
        """Biosynthetic cost (Akashi-Gojobori + EWGC)."""
        return self._get(f"/v1/genes/{build}/{symbol}/cost")

    def gene_constraint(self, build: str, symbol: str) -> dict:
        """gnomAD constraint metrics (pLI, LOEUF, Z-scores)."""
        return self._get(f"/v1/genes/{build}/{symbol}/constraint")

    def gene_pathways(self, build: str, symbol: str) -> dict:
        """Reactome pathway memberships."""
        return self._get(f"/v1/genes/{build}/{symbol}/pathways")

    # === Region Queries ===

    def region(self, build: str, region: str, layers: list[str] = None) -> dict:
        """Query all features in a genomic region."""
        params = {}
        if layers:
            params["layers"] = ",".join(layers)
        return self._get(f"/v1/regions/{build}/{region}", params=params)

    def sequence(self, build: str, region: str) -> dict:
        """Get raw DNA sequence (max 100kb)."""
        return self._get(f"/v1/sequence/{build}/{region}")

    def biophysics(self, build: str, region: str) -> dict:
        """Compute per-dinucleotide biophysical properties (max 10kb)."""
        return self._get(f"/v1/biophysics/{build}/{region}")

    # === Probe Queries ===

    def probe(self, build: str, probe_id: str) -> dict:
        """Look up a methylation probe by ID."""
        return self._get(f"/v1/probes/{build}/{probe_id}")

    def batch_probes(self, build: str, probe_ids: list[str]) -> dict:
        """Look up up to 10,000 probes at once."""
        return self._post(f"/v1/probes/{build}/batch", json={"probe_ids": probe_ids})

    # === Reference Data ===

    def nn_parameters(self) -> dict:
        """SantaLucia/Xia/Sugimoto nearest-neighbor thermodynamics."""
        return self._get("/v1/reference/nn-parameters")

    def sbs_spectrum(self) -> dict:
        """96-channel COSMIC SBS mutation spectrum with ΔG perturbation."""
        return self._get("/v1/reference/sbs-spectrum")

    def clock_probes(self, clock: str = None) -> dict:
        """Epigenetic clock probe coefficients."""
        params = {"clock": clock} if clock else {}
        return self._get("/v1/reference/clock-probes", params=params)

    def amino_acid_properties(self) -> dict:
        """Amino acid MW, volume, hydrophobicity, pKa, biosynthetic cost."""
        return self._get("/v1/reference/amino-acid-properties")

    def physical_constants(self) -> dict:
        """DNA/protein physical constants (Lp, Manning ξ, elastic moduli)."""
        return self._get("/v1/reference/physical-constants")

    # === Search ===

    def search(self, query: str, build: str = "hg38") -> dict:
        """Prefix-match gene search."""
        return self._get("/v1/search", params={"q": query, "build": build})

    # === Layers ===

    def layers(self, build: str = None) -> dict:
        """List all available data layers."""
        params = {"build": build} if build else {}
        return self._get("/v1/layers", params=params)

    # === Advanced ===

    def correlate(self, build: str, region: str, layer_x: str, layer_y: str, method: str = "pearson") -> dict:
        """Cross-layer correlation analysis."""
        return self._get(f"/v1/correlate/{build}/{region}", params={
            "layer_x": layer_x, "layer_y": layer_y, "method": method
        })

    # === Internal ===

    def _get(self, path: str, params: dict = None) -> dict:
        resp = self._client.get(path, params=params)
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, json: dict = None) -> dict:
        resp = self._client.post(path, json=json)
        resp.raise_for_status()
        return resp.json()

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
```

**`pyproject.toml`**:
```toml
[project]
name = "polymer-genomics"
version = "0.1.0"
description = "Python client for the Polymer Genomics API — DNA biophysical properties and curated genomic reference data"
requires-python = ">=3.9"
dependencies = ["httpx>=0.24"]
license = "MIT"

[project.urls]
Homepage = "https://polymerbio.org"
Documentation = "https://api.polymerbio.org/docs"
Repository = "https://github.com/polymerbio/polymer-genomics-python"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**README.md** quickstart:
```markdown
# polymer-genomics

Python client for the Polymer Genomics API.

## Install
pip install polymer-genomics

## Quick Start
from polymer_genomics import PolymerClient

client = PolymerClient(api_key="your-key")

# Evaluate a construct
report = client.evaluate("ATGCGATCGATCG...")
print(report["flags"])

# Compare designs
delta = client.compare({
    "wildtype": "ATGCGA...",
    "optimized": "ATGCGA..."
})
```

### 2.2 Publish to PyPI

```bash
cd sdk/python
pip install build twine
python -m build
twine upload dist/*
```

Register `polymer-genomics` on PyPI. Ensure name is available (check first).

---

## Sprint 3: Multi-Key Auth + Usage Tracking (Week 4)

### 3.1 Multi-Key API Key System

**Current state**: Single static `POLYMER_API_KEY` env var. One key for everything.

**Target state**: Multiple API keys with metadata, stored in PostgreSQL.

**Database migration**: Create `auth` schema:
```sql
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.api_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash    TEXT NOT NULL UNIQUE,        -- SHA-256 of key
    key_prefix  TEXT NOT NULL,               -- First 8 chars for identification
    name        TEXT NOT NULL,               -- "Edison Scientific", "personal-dev"
    tier        TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'enterprise'
    created_at  TIMESTAMPTZ DEFAULT now(),
    last_used   TIMESTAMPTZ,
    is_active   BOOLEAN DEFAULT true,
    rate_limit  INTEGER DEFAULT 100,         -- requests per hour
    metadata    JSONB DEFAULT '{}'           -- email, org, notes
);

CREATE INDEX idx_api_keys_hash ON auth.api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON auth.api_keys(key_prefix);
```

**File**: Update `src/polymer_genomics/middleware.py`

Replace simple string comparison with:
1. Hash incoming key (SHA-256)
2. Look up in `auth.api_keys` by `key_hash`
3. Check `is_active`
4. Update `last_used`
5. Attach `key_id`, `tier`, `rate_limit` to request state

Keep the `POLYMER_API_KEY` env var as a fallback "master key" for backwards compatibility. If the env var is unset AND no key is provided, allow unauthenticated access (dev mode preserved).

### 3.2 Usage Tracking

**Database migration**: Add to `auth` schema:
```sql
CREATE TABLE auth.usage_log (
    id          BIGSERIAL PRIMARY KEY,
    key_id      UUID REFERENCES auth.api_keys(id),
    endpoint    TEXT NOT NULL,
    method      TEXT NOT NULL,
    status_code INTEGER,
    response_ms INTEGER,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Partition by month for performance
-- Or use a simple append-only table with periodic aggregation

CREATE INDEX idx_usage_key_date ON auth.usage_log(key_id, created_at);
```

**Implementation**: Log every request in middleware (async, non-blocking — fire-and-forget INSERT).

### 3.3 Key Management CLI

**File**: Create `src/polymer_genomics/cli/keys.py`

Simple CLI for key management (run locally or via `fly ssh`):
```bash
python -m polymer_genomics.cli.keys create --name "Edison Scientific" --tier pro --rate-limit 10000
# Output: pk_live_abc123def456...  (save this, shown once)

python -m polymer_genomics.cli.keys list
# Output: table of key_prefix, name, tier, last_used, is_active

python -m polymer_genomics.cli.keys revoke --prefix pk_live_a
```

Key format: `pk_live_` + 32 random hex chars. Store SHA-256 hash only.

### 3.4 Rate Limiting

**Implementation**: In-memory sliding window per key_id (don't need Redis at this scale).

```python
# In middleware.py
from collections import defaultdict
import time

_rate_windows: dict[str, list[float]] = defaultdict(list)

def check_rate_limit(key_id: str, limit: int) -> bool:
    now = time.time()
    window = _rate_windows[key_id]
    # Remove entries older than 1 hour
    window[:] = [t for t in window if now - t < 3600]
    if len(window) >= limit:
        return False
    window.append(now)
    return True
```

Return `429 Too Many Requests` with `Retry-After` header when exceeded.

---

## Sprint 4: Developer Landing + Docs (Week 5-6)

### 4.1 API Landing Page

**File**: Create `viewer/src/app/developers/page.tsx`

**Content**:
- **Hero**: "The Biophysical Data Layer for DNA" — one sentence: "Every AI model treats DNA as text. We compute what DNA actually does as a physical material."
- **30-second quickstart**: curl example → result (evaluate endpoint)
- **Code examples**: Python SDK, MCP tool call, raw curl
- **Use case cards** (3):
  1. "For Synthetic Biology" — evaluate constructs before synthesis, flag silencing risk
  2. "For AI Scientists" — 33 agent-composable MCP tools for biology research agents
  3. "For Epigenetic Clocks" — mechanistic context for probe selection, 5 clock coefficient sets
- **Data inventory**: Counts of what's available (29M CpGs, 937K probes, 20K genes, 54 tissues, 30+ physical constants)
- **"Try it"** section: embedded form — paste sequence, get evaluate result (calls API live)
- **Pricing placeholder**: "Free tier: 100 requests/hour. Pro: Contact us."
- **Link to Swagger UI** (`/docs`) and Python SDK

### 4.2 Update Home Page

**File**: Update `viewer/src/app/page.tsx`

Change tagline from "Curated genomic reference data" to something that communicates the unique value:
- "DNA as a physical material — computed, served, composable"
- Keep "Base-pair resolution"
- Add a 4th CTA button: "For Developers →" linking to `/developers`
- Add data layer cards for biophysics: "Stacking Energy (ΔG₃₇)", "Physical Constants", "SBS Spectrum"

### 4.3 Quickstart Guide

**File**: Create `viewer/src/app/docs/quickstart/page.tsx` (or markdown rendered via Next.js)

Structured tutorial:
1. Get an API key (link to request form or self-service)
2. Install Python SDK: `pip install polymer-genomics`
3. Evaluate your first sequence (5 lines of code → result)
4. Compare two designs (5 lines)
5. Look up a gene's biophysical neighborhood
6. Use MCP tools in Claude Code (show config)
7. Explore the genome browser

### 4.4 MCP Integration Guide

**File**: Add to docs

Show how to add Polymer Genomics MCP server to Claude Code:
```json
// ~/.claude/claude_desktop_config.json
{
  "mcpServers": {
    "polymer-genomics": {
      "command": "uvx",
      "args": ["polymer-genomics-mcp"],
      "env": {
        "POLYMER_API_URL": "https://api.polymerbio.org",
        "POLYMER_API_KEY": "your-key"
      }
    }
  }
}
```

Document each of the 33 tools with example calls and example outputs.

---

## Sprint 5: MCP Hardening (Week 6-7)

### 5.1 Summary Response Parameter

**What**: Add `?summary=true` query parameter to key endpoints (`/v1/regions`, `/v1/biophysics`, `/v1/genes`).

When enabled, prepend a natural-language summary to the response:
```json
{
  "summary": "TP53 on chr17:7668402-7687550 (19.1 kb, minus strand). GC = 42%, mean stacking ΔG₃₇ = -1.38 kcal/mol. Contains 2 CpG islands. High evolutionary constraint (mean PhyloP > 4). 12 EPIC v2 probes in region.",
  "data": { ... existing GRanges ... }
}
```

**Implementation**:
- Add `summary: bool = False` parameter to relevant route functions
- Build summary from the same data already being returned (no extra DB queries)
- Template-based string construction (not LLM-generated — deterministic and fast)

**MCP change**: Update MCP tools to pass `summary=true` by default. AI agents always benefit from the summary; programmatic API users can omit it.

### 5.2 MCP Tool Description Enhancement

**File**: Update `mcp/polymer_genomics_mcp/server.py`

For every tool, add to the docstring:
1. **Example output** (truncated but structurally complete)
2. **When NOT to use this tool** (negative capability)
3. **Output field descriptions** for key fields

Example for `lookup_gene`:
```python
@mcp.tool()
async def lookup_gene(build: str, symbol: str) -> str:
    """Look up a gene by symbol, returning exon/intron/UTR structure.

    Supports gene aliases (e.g., OCT4→POU5F1, p53→TP53).
    Returns GRanges JSON with one row per genomic feature
    (exon, intron, 5'UTR, 3'UTR, CDS).

    Example output (truncated):
    {
      "data": {"gencode_v44": {
        "seqnames": ["chr17","chr17",...],
        "ranges": {"start": [7668402,...], "end": [7669690,...]},
        "mcols": {
          "gene_symbol": ["TP53",...],
          "feature_type": ["exon","intron",...],
          "transcript_id": ["ENST00000269305",...]
        }
      }},
      "summary": "TP53: 11 exons, 19.1 kb span, minus strand chr17"
    }

    Does NOT return: expression data (use lookup_gene_expression),
    constraint scores (use lookup_gene_constraint), or biophysical
    properties (use compute_region_biophysics with the gene's coordinates).
    """
```

### 5.3 Update MCP Server Global Instructions

**File**: Update the `instructions` parameter in FastMCP initialization (`server.py` lines 25-73)

Add:
- Mention `evaluate_design` as the recommended first tool for sequence analysis
- Mention `compare_sequences` for multi-sequence comparison
- Add "WORKFLOW PATTERNS" section:
  - "Evaluate a construct": `evaluate_design` → review flags
  - "Investigate a gene": `lookup_gene` → `lookup_gene_expression` → `compute_region_biophysics`
  - "Annotate methylation hits": `batch_probes` → `lookup_gene` → `lookup_gene_expression`
  - "Cross-layer analysis": `query_region` with multiple layers → `correlate_layers`

---

## Sprint 6: Compare + Design Evaluator Frontend (Week 7-8)

### 6.1 Design Evaluator Page

**File**: Create `viewer/src/app/evaluate/page.tsx`

**Layout**:
```
┌─────────────────────────────────────────────┐
│  POLYMER GENOMICS — Design Evaluator        │
├─────────────────────────────────────────────┤
│  [Paste sequence or upload FASTA]            │
│  ┌─────────────────────────────────────┐    │
│  │ ATGCGATCGATCGATCG...                │    │
│  │                                      │    │
│  └─────────────────────────────────────┘    │
│  [Evaluate]                                  │
├─────────────────────────────────────────────┤
│  Summary Card:                               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐   │
│  │ 4521 │ │ 52%  │ │-1.42 │ │ 1 CGI    │   │
│  │  bp  │ │  GC  │ │ΔG₃₇  │ │ detected │   │
│  └──────┘ └──────┘ └──────┘ └──────────┘   │
├─────────────────────────────────────────────┤
│  Stacking Energy Profile (line chart)        │
│  ═══════╗    ╔═══╗     ╔═══════════        │
│         ╚════╝   ╚═════╝                    │
├─────────────────────────────────────────────┤
│  GC Content Profile (area chart)             │
├─────────────────────────────────────────────┤
│  Flags:                                      │
│  ⚠ 1200-1850: CpG island (silencing risk)  │
│  ℹ 3100-3200: Low stability region          │
├─────────────────────────────────────────────┤
│  [Export JSON]  [Export PDF]  [Copy Link]     │
└─────────────────────────────────────────────┘
```

**Components to create**:
- `EvaluateInput.tsx` — textarea + FASTA parser + file upload
- `EvaluateSummaryCards.tsx` — 4-6 metric cards (bp, GC, ΔG₃₇, CGIs, flags)
- `EvaluateProfileChart.tsx` — windowed line charts (stacking energy, GC, Tm)
- `EvaluateFlags.tsx` — colored flag list (warning=yellow, info=blue)
- `EvaluateExport.tsx` — JSON download, browser print-to-PDF

**Rendering**: Canvas-based profile charts (consistent with existing genome browser track rendering). No new charting dependency — draw with Canvas 2D API like existing tracks, or use a minimal SVG approach.

### 6.2 Comparison Mode

**Extension of the evaluate page**:
- "Add sequence" button adds a second (third, fourth...) input panel
- Side-by-side or overlaid profile charts
- Delta table below charts
- Highlight regions where designs differ

---

## Sprint 7: Outreach Assets (Week 9-10)

### 7.1 Preprint Draft Outline

**Title**: "The Material Channel: Genome-Wide DNA Biophysical Properties as a Computable Layer for Genetic Design"

**Target**: bioRxiv → Genome Research or Nucleic Acids Research

**Structure**:
1. Abstract — DNA biophysics matters for genetic design but no tool computes it
2. Introduction — the gap between sequence-as-text and sequence-as-material
3. The Material Channel concept (from Polymer Evolution DOGMA.md — simplified for journal)
4. Platform description — what's computed, how, what's served
5. Validation — reproduce known biology (CGI = NDR, isochore-replication timing, Kaplan nucleosome predictions)
6. Application — evaluate synthetic constructs, flag silencing risk, compare designs
7. Availability — API, Python SDK, MCP tools, genome browser
8. Discussion — limitations, future (Phase 2-3.5 tracks coming)

**Figures** (4-6):
- Fig 1: Schematic — symbolic vs material channel, what the API computes
- Fig 2: Genome browser screenshot showing material channel tracks
- Fig 3: Evaluate endpoint demo — before/after for a construct with a CGI
- Fig 4: Validation — GC-replication timing correlation, TSS biophysical signatures
- Fig 5: MCP tool composition diagram (agent workflow)

### 7.2 Conference Target List

| Conference | Date | Submission Type | Relevance |
|-----------|------|----------------|-----------|
| IWBDA (Int'l Workshop on Bio-Design Automation) | Sep 2026 | Talk/poster | Synbio audience, Cello/Asimov people |
| ASHG | Oct 2026 | Poster | Genomics audience, clock developers |
| AGBT | Feb 2027 | Poster | Sequencing/diagnostics audience |
| NeurIPS Workshop (AI4Science) | Dec 2026 | Extended abstract | AI scientist audience |

### 7.3 Outreach Email Templates

**For FutureHouse/Edison** (AI scientist tools):
> Subject: Material-channel data layer for biology AI agents
>
> We built a 33-tool MCP server that computes DNA biophysical properties — stacking energy, persistence length, groove geometry, nucleosome mechanics, CpG island detection, mutation thermodynamics — and serves them as agent-composable tools. We noticed Edison is building biology AI agents and thought this might be useful as a data layer. Happy to demo.

**For Asimov** (synthetic biology):
> Subject: Physics linter for genetic circuit design
>
> We built an API that evaluates DNA sequences for biophysical properties that affect circuit performance — CpG island silencing risk, thermodynamic stability uniformity, structural features. No existing tool does this. Would love to show how it could integrate with your design pipeline.

**For Owkin** (Anthropic partnership):
> Subject: Polymer Genomics MCP server — genomic biophysics tools for Claude
>
> We saw your Pathology Explorer launch with Anthropic Claude. We built an MCP server with 33 genomic biophysics tools — the kind of physical context that could augment pathology AI with mechanistic interpretation. Interested in exploring integration?

---

## Dependency Graph

```
Sprint 1 (evaluate_design, compare) ──────────────────────┐
    │                                                       │
    ▼                                                       │
Sprint 2 (Python SDK) ── uses evaluate/compare endpoints   │
    │                                                       │
    ▼                                                       │
Sprint 3 (Auth + Usage) ── SDK needs API keys              │
    │                                                       │
    ▼                                                       │
Sprint 4 (Developer Landing) ── needs SDK + auth to demo ──┤
    │                                                       │
Sprint 5 (MCP Hardening) ── independent, can parallel ─────┤
    │                                                       │
    ▼                                                       │
Sprint 6 (Frontend evaluate page) ── needs evaluate API ───┘
    │
    ▼
Sprint 7 (Outreach) ── needs everything above
```

**Parallelizable**: Sprints 4+5 can run concurrently. Sprint 6 can start after Sprint 1.

---

## Success Metrics

| Metric | Week 4 | Week 8 | Week 12 |
|--------|--------|--------|---------|
| `evaluate_design` calls/day | Exists | 10+ | 50+ |
| API keys issued | 0 | 5 | 20+ |
| PyPI downloads | Published | 50+ | 200+ |
| MCP tool integrations | 1 (us) | 2 | 5+ |
| Outreach emails sent | 0 | 0 | 10+ |
| Preprint | Outline | Draft | Submitted |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| evaluate_design compute too slow for 100kb sequences | Medium | Medium | Profile early, batch dinucleotide computation, cache windowed results. Start with 10kb limit, raise as performance allows |
| PyPI name `polymer-genomics` taken | Low | Low | Check immediately. Alternatives: `polymerbio`, `polymer-bio`, `polymer-dna` |
| No adoption after outreach | Medium | High | Target 3 specific people, not mailing lists. Offer to compute on their sequences for free |
| Rate limiting too aggressive for legitimate use | Low | Medium | Default 100/hr for free tier is generous. Monitor and adjust |
| Preprint scooped | Very Low | Medium | No one else is building this. The platform IS the novelty |
