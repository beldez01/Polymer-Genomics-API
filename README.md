# Polymer Genomics

Curated genomic reference data at base-pair resolution.

Polymer Genomics is an integrated genomic reference database with an interactive genome browser, REST API, Python SDK, and MCP server. It serves bioinformaticians, biologists, and AI agents with high-performance queries across 26 annotation layers for the human genome.

Live at [polymerbio.org](https://polymerbio.org)

## Quick Start

```bash
docker compose up -d
curl http://localhost:8000/v1/regions/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites
```

## API

| Endpoint | Description |
|---|---|
| `GET /v1/regions/{build}/{region}` | Query a genomic region with annotation layers |
| `GET /v1/genes/{build}/{symbol}` | Look up a gene by symbol (case-insensitive, aliases supported) |
| `GET /v1/sequence/{build}/{region}` | Retrieve raw DNA sequence |
| `GET /v1/probes/{build}/{probe_id}` | Look up a methylation probe |
| `POST /v1/probes/{build}/batch` | Batch probe lookup (up to 10,000) |
| `POST /v1/evaluate` | Biophysical sequence evaluation ("physics linter") |
| `POST /v1/compare` | Side-by-side sequence comparison with deltas |
| `GET /v1/tiles/{build}/{chr}/tile/{res}/{idx}` | Deterministic tiled data |
| `GET /v1/aggregation/{build}/{region}` | Binned density statistics |
| `GET /v1/layers` | List available annotation layers |
| `GET /v1/search?q=&build=` | Search gene symbols |

All endpoints return 1-based closed intervals in a uniform response envelope with timing metadata.

## Viewer

Interactive genome browser at [polymerbio.org/view/hg38/chr16:70699930-70700000](https://polymerbio.org/view/hg38/chr16:70699930-70700000). Navigate with arrow keys, +/- to zoom, click-and-drag to pan.

Additional pages: `/evaluate` (design evaluator with evidence badges + PNG export), `/atlas` (methylation atlas), `/developers` (API docs + quickstart), `/dmp` (differential methylation viewer).

## Data Layers (26 on hg38)

- **Genes** — GENCODE v44, 63,000 transcripts + gene aliases
- **CpG Sites** — Islands, shores, shelves, 28M sites
- **Probes** — EPIC v2, v1, 450K methylation arrays + cross-mapping
- **Isochores** — GC composition structure
- **Methylation Atlas** — Population reference (blood)
- **Gene Expression** — GTEx v10 (54 tissues)
- **Protein Abundance** — PaxDb tissue-specific PPM
- **Gene Constraint** — gnomAD pLI, LOEUF, Z-scores
- **Gene Pathways** — Reactome pathway memberships
- **Gene Sets** — MSigDB Hallmark
- **Protein Atlas** — HPA tissue expression + subcellular localization
- **Epigenetic Clocks** — Horvath, Hannum, PhenoAge, GrimAge, DunedinPACE, Retro-Age
- **SBS Spectrum** — 96-channel mutation thermodynamics
- **DNAshape** — Minor groove width, propeller twist, roll, helix twist (absolute + methylation delta)
- **Gene Cost** — Akashi-Gojobori biosynthetic cost + GTEx EWGC
- **Conservation** — PhyloP / phastCons
- **Chromatin States** — ChromHMM
- **Non-B DNA** — G-quadruplex, Z-DNA, cruciform, triplex, slipped
- **HERV Loci** — Human endogenous retrovirus insertions
- **Breakpoints** — COSMIC structural variant breakpoints
- **Repeats** — LINE, SINE, LTR, DNA transposons + probe overlap cross-reference
- **NN Thermodynamics** — SantaLucia nearest-neighbor parameters
- **Physical Constants** — Persistence length, Manning parameter, elastic moduli

Supports hg38 and hg37 genome builds.

## MCP Server (39 tools)

Claude Code integration via MCP (Model Context Protocol). 29 reference tools + 10 compute tools for methylation analysis (IDAT loading, normalization, filtering, limma DMP, visualization).

```bash
cd mcp && uv run server.py
```

## Python SDK

```bash
pip install polymer-genomics  # not yet on PyPI — install from sdk/python/
```

```python
from polymer_genomics import PolymerClient
client = PolymerClient("http://localhost:8000")
gene = client.gene("hg38", "TP53")
result = client.evaluate("ATGCGATCGA...")
```

## R Client

```r
# install.packages("r-client", repos = NULL, type = "source")
library(polymergenomics)
pg_connect("http://localhost:8000")
gene <- pg_gene("hg38", "TP53")
```

## Compute Engine

R-based methylation analysis pipeline (minfi, sesame, limma). Supports EPICv2, EPIC, and 450K arrays with automatic detection.

```bash
cd engine && docker build -t polymer-engine .
```

## Development

```bash
# Backend
docker compose up -d db
uv sync
uv run uvicorn polymer_genomics.main:app --reload

# Frontend
cd viewer
npm install
npm run dev
```

## Architecture

FastAPI + PostgreSQL 16 backend, Next.js + React 19 frontend with canvas-based track rendering. Deployed on Fly.io (API) and Vercel (viewer). MinIO/S3 for object storage.

## Current Status (2026-03-14)

**Completed:**
- Sprints 1-6 of the Scientific AI Market Entry plan (see `PLAN_SCIENTIFIC_AI_ENTRY.md`)
- Expansion Blueprint: all 16 tasks + bonus work (gene aliases, HERV, repeats, probe-repeat xref)
- 35 database migrations (002-035)
- Full codebase audit: 48 bugs fixed (3 critical, 8 high, 13 medium, 17 low)

**Next Steps:**

1. **Rotate production DB password** — credential was exposed in git history during audit; needs rotation on Fly.io Postgres
2. **Sprint 7: Outreach Assets** — preprint outline, conference targets (IWBDA Sep 2026, ASHG Oct 2026, NeurIPS AI4Science Dec 2026), outreach emails to FutureHouse/Edison/Ginkgo
3. **PyPI publish** — Python SDK (`sdk/python/`) is built and tested (24 tests) but not yet published
4. **Compare frontend** — `/v1/compare` API exists but has no frontend UI
5. **Quickstart + MCP integration guides** — dedicated doc pages not yet created
6. **Transaction wrapping** — multi-step ingestion scripts lack transaction boundaries
7. **Memory optimization** — repeats/chromatin ingest can pressure RAM on large chromosomes
8. **Usage tracking** — no request logging beyond Fly.io metrics; build alongside multi-key auth (Sprint 3)

## License

MIT — see [LICENSE](LICENSE) for the source code license.

Data served by this platform is subject to the licenses of the original data providers. See [Data Sources](https://polymerbio.org/data-sources) for details.
