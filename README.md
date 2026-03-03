# Polymer Genomics

Curated genomic reference data at base-pair resolution.

Polymer Genomics is an integrated genomic reference database with an interactive genome browser and REST API. It serves bioinformaticians, biologists, and AI agents with high-performance queries across multiple annotation layers — genes, CpG sites, methylation probes, and isochores — for the human genome.

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
| `GET /v1/genes/{build}/{symbol}` | Look up a gene by symbol |
| `GET /v1/sequence/{build}/{region}` | Retrieve raw DNA sequence |
| `GET /v1/probes/{build}/{probe_id}` | Look up a methylation probe |
| `POST /v1/probes/{build}/batch` | Batch probe lookup |
| `GET /v1/tiles/{build}/{chr}/tile/{res}/{idx}` | Deterministic tiled data |
| `GET /v1/aggregation/{build}/{region}` | Binned density statistics |
| `GET /v1/layers` | List available annotation layers |
| `GET /v1/search?q=&build=` | Search gene symbols |

All endpoints return 1-based closed intervals in a uniform response envelope with timing metadata.

## Viewer

Interactive genome browser at [polymerbio.org/view/hg38/chr16:70699930-70700000](https://polymerbio.org/view/hg38/chr16:70699930-70700000). Navigate with arrow keys, +/- to zoom, click-and-drag to pan.

## Data Layers

- **Genes** — GENCODE v44, 63,000 transcripts
- **CpG Sites** — Islands, shores, shelves, 28M sites
- **Probes** — EPIC v2, v1, 450K methylation arrays
- **Isochores** — GC composition structure

Supports hg38 and hg37 genome builds.

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

FastAPI + PostgreSQL 16 backend, Next.js 16 + React 19 frontend with canvas-based track rendering. Deployed on Fly.io (API) and Vercel (viewer).

## License

TBD
