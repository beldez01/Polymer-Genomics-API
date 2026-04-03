# PolymerGenomicsAPI

The first production database of genome-wide DNA biophysical properties. Agent-optimized API with anti-hallucination design: epistemic metadata, provenance in every response, structured flags, and truncation warnings.

Live at polymerbio.org · API at api.polymerbio.org · SDK: `pip install polymer-genomics`

## What This Is

A curated, multi-layer genomic reference database (41 layers, hg38/hg37) that provides:
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

## Database Capacity (as of 2026-03-17)

- **Volume**: 20 GB, 14 GB used (70%), expandable via `fly volumes extend`
- **Compute**: shared-cpu-2x / 1 GB RAM — RAM is the binding constraint
- **Scale-up**: volume grows instantly (no downtime); CPU/RAM via `fly machine update --vm-size`

## Project Structure

- `src/` — FastAPI application (`polymer_genomics/`)
- `viewer/` — Next.js 15 + React 19 frontend (deployed to Vercel)
- `mcp/` — MCP server (44 tools: 34 reference + 10 compute)
- `sdk/python/` — Python SDK (PyPI: `polymer-genomics` v0.2.0)
- `engine/` — R-based methylation compute engine
- `docker/` — Local dev Postgres init scripts
- `data/` — Reference data
- `scripts/` — Ingestion and admin scripts
- `docs/paper/` — NAR Database Issue manuscript draft
- `fly.toml` — Fly.io deployment config (source of truth)

## Key Design Decisions

- **Anti-hallucination**: Every response includes `api_version`, `data_version`, evidence class, source, license, and content hash per layer. Structured flag codes (not free text) for machine parsing. `status: "truncated"` prevents agents from treating partial results as complete.
- **GRanges JSON**: All genomic data in R/Bioconductor-compatible format (seqnames, ranges, strand, mcols).
- **1-based closed coordinates**: External API uses 1-based closed. Internal DB uses 0-based half-open. Single conversion layer in `coordinates.py`.
- **Epistemic classes**: M=measured, K=curated, D=derived, S=statistical, H=hypothetical. On every layer, in every response.

## Strategic Context

- **NAR Database Issue paper** in progress (`docs/paper/nar_database_issue_2026.md`) — target July 2026
- **"First entry in an empty category"** — no other database provides material-channel DNA properties genome-wide
- **Python SDK live on PyPI** — unblocks developer outreach to FutureHouse, Asimov, Ginkgo, etc.
- **Physics linter as product** — the computation is the IP (legal clearance confirmed)
