# Polymer Genomics

**The first production database of genome-wide DNA biophysical properties.**

Polymer Genomics is an integrated genomic reference database that treats DNA as a physical polymer — not just an information-carrying sequence. It provides genome-wide thermodynamic stability, groove geometry, form propensity, curvature, and mechanical properties alongside 48 curated annotation layers, all queryable through a unified REST API designed for AI agents, bioinformaticians, and discovery scientists.

Live at [polymerbio.org](https://polymerbio.org) · API at [api.polymerbio.org](https://api.polymerbio.org/docs)

## Why This Exists

Every major genomic database treats DNA as a symbolic sequence: genes, variants, regulatory elements, expression levels. None provide the material-channel properties — stacking free energy, persistence length, groove width, melting temperature — that determine how DNA *physically behaves*. And none let you correlate those properties with biological annotations in a single query.

Polymer Genomics fills this gap.

## Quick Start

```bash
pip install polymer-genomics
```

```python
from polymer_genomics import PolymerClient

client = PolymerClient()

# Physics linter — evaluate any DNA sequence
report = client.evaluate("ATGCGATCGATCG" * 100)
print(report["flags"])           # actionable warnings
print(report["summary"])         # GC, ΔG₃₇, Tm, CpG islands

# Look up a gene
tp53 = client.gene("hg38", "TP53")

# Query biophysical properties genome-wide
data = client.region("hg38", "chr17:7668402-7687550",
                     layers=["sequence_biophysics_l0"])

# Cross-layer correlation
corr = client.correlate("hg38", "chr17:7668402-7687550",
                        layer_x="sequence_biophysics_l0",
                        layer_y="phylop_phastcons_100way")

# Region profile — everything about a region in one call
profile = client.region_profile("hg38", "chr17:7668402-7687550")

# Batch evaluate 100 sequences
batch = client.batch_evaluate({"v1": seq1, "v2": seq2, "v3": seq3})
```

## Core Capabilities

### Anti-Hallucination Design

Every response carries epistemic metadata so AI agents never confuse measured data with predictions:

- **Evidence classes** on every layer: Measured (M), Curated (K), Derived (D), Statistical (S), Hypothetical (H)
- **Provenance** in every response: source database, license, content hash, validation status
- **Structured flags** instead of free text — machines parse codes, not prose
- **Truncation warnings** — `status: "truncated"` prevents agents from reporting incomplete data as complete
- **Version metadata** — `api_version` and `data_version` in every envelope

### Cross-Layer Correlation Engine

The killer feature: correlate and intersect heterogeneous data layers in a single query. No other genomic database offers this.

- `GET /v1/correlate/{build}/{region}` — Pearson, Spearman, overlap enrichment, Jaccard, Fisher exact
- `POST /v1/query/intersect` — boolean AND across multiple layers with field-level filtering
- `GET /v1/query/recipes` — prebuilt queries for common biological questions
- `GET /v1/profile/{build}/{region}` — all layers at once with significance flags

### The Physics Linter

Evaluate any DNA sequence (10–100,000 bp) against biophysical criteria. Returns thermodynamic stability, structural properties, CpG islands, and 13 actionable flag types — including direct/inverted repeats, extreme GC windows, Z-form propensity, and silencing risk. Designed for synthetic biology: evaluate before you synthesize.

- `POST /v1/evaluate` — single sequence
- `POST /v1/evaluate/batch` — up to 100 sequences
- `POST /v1/compare` — side-by-side delta analysis (2–10 variants)

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /v1/regions/{build}/{region}` | Query features across annotation layers (GRanges JSON) |
| `GET /v1/stats/{build}/{region}` | Summary statistics (mean/median/sd/percentiles) |
| `GET /v1/stats/summary` | Platform-wide statistics (total layers, rows, builds) |
| `GET /v1/profile/{build}/{region}` | Comprehensive region profile across all layers |
| `GET /v1/correlate/{build}/{region}` | Cross-layer correlation analysis |
| `POST /v1/query/intersect` | Multi-layer boolean intersection |
| `GET /v1/query/recipes` | Prebuilt cross-layer query recipes |
| `GET /v1/genes/{build}/{symbol}` | Gene lookup with alias resolution (p53 → TP53) |
| `GET /v1/sequence/{build}/{region}` | Raw DNA sequence (max 100 kb) |
| `GET /v1/probes/{build}/{probe_id}` | Methylation probe lookup |
| `POST /v1/probes/{build}/batch` | Batch probe lookup (up to 10,000) |
| `POST /v1/evaluate` | Physics linter — biophysical sequence evaluation |
| `POST /v1/evaluate/batch` | Batch evaluation (up to 100 sequences) |
| `POST /v1/compare` | Side-by-side sequence comparison with deltas |
| `GET /v1/layers` | List available data layers with epistemic metadata |
| `GET /v1/layers/{key}/license` | Full provenance, license, citation for a layer |
| `GET /v1/aggregation/{build}/{region}` | Binned density for large regions |

All endpoints return 1-based closed coordinates with provenance, version metadata, and timing. Data endpoints use a full envelope (`status`, `query`, `layers_resolved`, `data`, `timing`). Metadata and search endpoints use a lighter envelope (`api_version`, `data_version`, `data`, optional `timing`).

## Data Layers (48 on hg38)

### Unique to Polymer Genomics
- **Sequence Biophysics L0** — 64 columns: stacking ΔG₃₇, melting temp, curvature, groove geometry, form propensity, periodicity, DNAshape, methylation perturbation field, Green's function mechanical connectivity
- **Non-B DNA Structures** — G-quadruplex, Z-DNA, cruciform, triplex, slipped strand (2.9M features)
- **Fragility Composite** — integrated fragility score from non-B + stacking + curvature
- **Gene Biosynthetic Costs** — Akashi-Gojobori + expression-weighted metabolic burden
- **Epigenetic Clock Coefficients** — Horvath, Hannum, PhenoAge, GrimAge, DunedinPACE, Retro-Age
- **SBS Mutation Thermodynamics** — 96-channel ΔΔG per trinucleotide context

### Curated from Authoritative Sources
- **Genes** — GENCODE v44 (3M features, 63K transcripts)
- **CpG Sites** — 29.4M sites with island/shore/shelf context
- **Methylation Probes** — EPIC v2, v1, 450K with cross-platform mapping
- **Conservation** — PhyloP + PhastCons 100-way
- **Regulatory** — ENCODE cCREs v4
- **Chromatin States** — ChromHMM 15-state
- **Histone Marks** — ENCODE v3 ChIP-seq peaks
- **Expression** — GTEx v10 (54 tissues)
- **Constraint** — gnomAD v4 (pLI, LOEUF, Z-scores)
- **Repeats** — RepeatMasker (5.3M elements)
- **GWAS** — EBI GWAS Catalog
- **Protein** — PaxDb abundance, Human Protein Atlas
- **Pathways** — Reactome, MSigDB Hallmark
- **HERV** — Telescope proviral loci
- **Breakpoints** — COSMIC structural variant breakpoints
- **HLA** — 22,259 alleles across 6 loci with expression correlation
- **ClinVar** — Pathogenic/likely pathogenic variants
- **TFBS** — ENCODE transcription factor binding site peaks
- **gnomAD SV** — Structural variant sites
- **TADs** — Topologically associating domains (108 cell types)
- **Recombination** — Crossover and non-crossover hotspots

## Viewer

Interactive genome browser at [polymerbio.org](https://polymerbio.org). Canvas-based multi-track rendering with keyboard navigation.

- `/view/{build}/{region}` — genome browser with shareable URLs
- `/evaluate` — physics linter UI with evidence badges and PNG export
- `/atlas` — methylation atlas with karyotype overview and GeneCards
- `/gene/{build}/{symbol}` — gene detail pages with transcript diagrams
- `/developers` — API documentation and quickstart
- `/data-sources` — per-layer citations and licenses

## MCP Server (70 tools)

AI agent integration via Model Context Protocol. Reference tools + compute tools for methylation analysis (IDAT → normalize → limma → visualize), HLA analysis, recombination queries, and more.

```bash
cd mcp && uv run server.py
```

Tools include: `evaluate_design`, `compare_sequences`, `batch_evaluate`, `region_profile`, `query_recipe`, `platform_summary`, `query_region`, `correlate_layers`, `intersect_layers`, `lookup_gene`, `lookup_gene_expression`, `compute_region_biophysics`, and 33 more.

## Python SDK

```bash
pip install polymer-genomics
```

Published on PyPI as [`polymer-genomics`](https://pypi.org/project/polymer-genomics/) (v0.3.0). MIT license. Full client surface covering all API endpoints.

## Architecture

FastAPI + PostgreSQL 16 + asyncpg backend. Next.js 16 + React 19 frontend with canvas-based track rendering. Deployed on Fly.io (API, iad region) and Vercel (viewer). Sub-100ms query latency.

## Development

```bash
# Backend
docker compose -f docker/docker-compose.yml up -d
uv sync
uv run uvicorn polymer_genomics.main:app --reload

# Frontend
cd viewer && npm install && npm run dev

# MCP server
cd mcp && uv run server.py
```

## License

MIT — see [LICENSE](LICENSE) for the source code (API, SDK, MCP, frontend).

**The MIT license does not apply to data served through the API.** Data layers carry their own upstream licenses, including non-commercial restrictions, copyleft obligations, and patent encumbrances. See [DATA_LICENSE.md](DATA_LICENSE.md) for the complete commercial use classification.

Per-layer license information is available programmatically at `/v1/layers/{layer_key}/license` and at [polymerbio.org/data-sources](https://polymerbio.org/data-sources).
