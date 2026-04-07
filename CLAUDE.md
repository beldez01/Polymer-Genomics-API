# PolymerGenomicsAPI

The first production database of genome-wide DNA biophysical properties. Agent-optimized API with anti-hallucination design: epistemic metadata, provenance in every response, structured flags, and truncation warnings.

Live at polymerbio.org · API at api.polymerbio.org · SDK: `pip install polymer-genomics`

## What This Is

A curated, multi-layer genomic reference database (48 layers, hg38/hg37) that provides:
- **Material-channel DNA properties** genome-wide (stacking ΔG₃₇, Tm, curvature, groove geometry, form propensity — 64 biophysics columns at 1 kb resolution)
- **Cross-layer correlation and intersection** in a single query (no other genomic database offers this)
- **Physics linter** for evaluating synthetic constructs (13 flag types, batch mode, comparison mode)
- **Anti-hallucination responses** with evidence classes (M/R/D/S/K/H/L), provenance, and version metadata in every response

## Deployment Architecture — READ BEFORE DEPLOYING

| Tier     | Platform            | Deploy Command                           |
|----------|---------------------|------------------------------------------|
| API      | **Fly.io**          | `fly deploy`                             |
| Database | **Fly.io Postgres** | `fly postgres connect -a polymer-db`     |
| Frontend | **Vercel**          | `cd viewer && vercel --prod`             |
| MCP      | Local (stdio)       | `cd mcp && uv run server.py`             |
| SDK      | **PyPI**            | `cd sdk/python && uv build && uv publish`|

**DO NOT deploy the API to Vercel. DO NOT run migrations against the local Docker DB.**

- Migrations target Fly.io Postgres via `fly proxy` or `fly postgres connect`
- `docker-compose.yml` is for **local dev only**
- Fly app name: `polymer-genomics-api` (region: iad)
- CORS origins: polymerbio.org, polymer-genomics.vercel.app, localhost:3000

## Database Capacity (as of 2026-04-05)

- **Volume**: 20 GB, expandable via `fly volumes extend`
- **Compute**: shared-cpu-2x / 1 GB RAM — RAM is the binding constraint
- **Scale-up**: volume grows instantly (no downtime); CPU/RAM via `fly machine update --vm-size`

## Project Structure

- `src/` — FastAPI application (`polymer_genomics/`)
- `viewer/` — Next.js 16 + React 19 frontend (deployed to Vercel)
- `mcp/` — MCP server (70 tools)
- `sdk/python/` — Python SDK (PyPI: `polymer-genomics` v0.3.0)
- `engine/` — R-based methylation compute engine
- `docker/` — Local dev Postgres init scripts
- `data/` — Reference data
- `scripts/` — Ingestion and admin scripts
- `internal/` — Private docs, research, plans, experiments (gitignored)
- `fly.toml` — Fly.io deployment config (source of truth)

## The GC–Arrangement Decomposition (Foundational — Read First)

Every biophysical parameter in this platform exists on a spectrum from composition-determined to arrangement-determined. **Experiment 21** (LP proof) quantifies this exactly:

- **Arrangement-dominated (60-87%)**: Rise, minor/major groove width, twist, roll, ΔS — these carry information that GC content cannot see. They are the strongest candidates for GC-independent biological signal. Confirmed by Exp 17 (recombination AUROC 0.827 without GC) and Exp 18 (deformability partial r = -0.345).
- **Mixed (44-59%)**: Slide, ΔH, deformability — substantial contributions from both composition and arrangement.
- **Composition-dominated (9-37%)**: ΔG₃₇ (31%), A-form (33%), Z-form (9%) — predominantly GC proxies. Raw correlations with biological outcomes will largely recapitulate GC. Z-form's 9% corridor is narrow but encodes purine-pyrimidine alternation exploited for replication timing (Exp 20: partial r = 0.100, rank #1).

**Rule**: When interpreting biophysics–biology correlations, always check the parameter's arrangement capacity. Claims of "biophysics predicts X" using composition-dominated parameters (ΔG₃₇, Z-form, A-form) require GC-controlled analysis. Claims using arrangement-dominated parameters (roll, twist, rise, groove width) are inherently GC-independent.

Reference: `COMPUTATIONAL_ASSUMPTIONS.md` § FOUNDATIONAL, `internal/InSilicoExperiments/exp21_gc_conditional_variance/`

## Key Design Decisions

- **Anti-hallucination**: Every response includes `api_version`, `data_version`, evidence class, source, license, and content hash per layer. Structured flag codes (not free text) for machine parsing. `status: "truncated"` prevents agents from treating partial results as complete.
- **GRanges JSON**: All genomic data in R/Bioconductor-compatible format (seqnames, ranges, strand, mcols).
- **1-based closed coordinates**: External API uses 1-based closed. Internal DB uses 0-based half-open. Single conversion layer in `coordinates.py`.
- **Epistemic classes**: M=measured, K=curated, D=derived, S=statistical, H=hypothetical. On every layer, in every response.

## Strategic Context

- **NAR Database Issue paper** in progress (`internal/paper/nar_database_issue_2026.md`) — target July 2026
- **"First entry in an empty category"** — no other database provides material-channel DNA properties genome-wide
- **Python SDK live on PyPI** — unblocks developer outreach to FutureHouse, Asimov, Ginkgo, etc.
- **Physics linter as product** — the computation is the IP (legal clearance confirmed)
