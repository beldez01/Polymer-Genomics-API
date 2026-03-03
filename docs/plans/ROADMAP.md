# Polymer Genomics Platform — Development Roadmap
*Last updated: 2026-03-03*

---

## Vision

Build the most state-of-the-art, richly integrated, correlative genomics database in the world — with complete API integration that makes measurable biology maximally computable.

This means:
- Every layer of biological measurement that has been systematically published belongs in this database.
- All layers are queryable together, correlated, and aggregatable via a single unified API contract.
- Human researchers can explore it visually. Bioinformaticians can query it programmatically. AI agents can use it as a reference oracle.
- Nothing is included that isn't grounded in experimentally validated data.

---

## Current Foundation (Complete)

The core infrastructure is production-ready and live at **polymerbio.org** / **api.polymerbio.org**. Do not re-architect any of this.

| Component | Status | Notes |
|-----------|--------|-------|
| REST API | ✅ Live | 12 endpoints, FastAPI + asyncpg, response envelope |
| MCP Server | ✅ Live | 9 tools, FastMCP, stdio transport |
| Frontend Viewer | ✅ Live | Canvas-based, multi-track, keyboard nav, Zustand |
| R Client | ✅ Live | 8 functions, httr2, GRanges output |
| Data Ingestion | ✅ Live | genes (3M features), CpG sites (29M), probes (EPIC v2/v1/450K), isochores |
| Test Suite | ✅ Live | 21 files, 4,088 LOC, unit + integration |
| Docker / Fly.io + Vercel | ✅ Live | API on Fly.io, viewer on Vercel, auto-deploy |
| Schema | ✅ Live | Partitioned GiST-indexed tables, cross-platform probe mapping |
| Gene detail page | ✅ Live | `/gene/[build]/[symbol]` — transcript diagram, locus/CpG panels |
| Atlas page | ✅ Live | `/atlas` — 25-chromosome cards with density stats |
| Track registry | ✅ Live | Declarative `TRACK_REGISTRY` in `queries.py` — zero if/elif dispatch |
| Shareable URLs | ✅ Live | `?layers=` param synced to viewport; Copy Link button |
| Probe search | ✅ Live | `cg`/`ch` ID detection in search bar → navigate to probe ±500bp |
| Gene → gene page link | ✅ Live | RegionContextPanel gene symbol links to `/gene/{build}/{symbol}` |
| Agent harness cmd | ✅ Live | `.claude/commands/bioinfo.md` — coordinate conventions, tool composition patterns |

**Architectural invariants — do not revisit:**
- GiST-indexed partitioned tables (not MongoDB, not generic SQL)
- 1-based closed external / 0-based half-open internal coordinate convention
- GRanges JSON response format with `layers_resolved` + `content_hash` (reproducibility contract)
- MCP as the agent interface (not raw DB access)
- Read-only API (no write endpoints)
- Single coordinate conversion layer (serializer only, tested round-trips)

---

## Phase 1 — Go Live + Essential UX ✅ COMPLETE

**Completed 2026-03-03.** All Phase 1 items are live in production.

### ✅ 1.1 Deploy to Production
- API live at `api.polymerbio.org` (Fly.io), viewer live at `polymerbio.org` (Vercel)
- `POLYMER_API_KEY` configured; MCP server connects to deployed API
- Health endpoint returning `{"status":"ok","chromosome_count":25}`

### ✅ 1.2 Track Registry Refactor
- Declarative `TRACK_REGISTRY` in `queries.py` — each entry has `query_fn` + `convert_fn`
- `regions.py` and `tiles.py` both updated; zero if/elif dispatch chains remain
- `LAYER_QUERY_MAP` retained as backwards-compat alias; all tests pass
- `methylation` type pre-registered in registry (ready for data)

### ✅ 1.3 Methylation Reference Track (infrastructure complete, data pending)
- `docker/postgres/migrations/002_methylation_reference.sql` — partitioned `ref.methylation_reference` table with GiST indexes
- `scripts/export_methylation_reference.R` — exports Salas 2018 FlowSorted.Blood.EPIC betas to ingestion CSV
- `viewer/src/components/tracks/MethylationReferenceTrack.tsx` — canvas heatmap, 6 cell-type rows, beta→color scale
- Registered in `TrackStack.tsx` under layer key `methylation_atlas`
- **Remaining:** Run migration on production DB, run R export, run ingest to populate data

### ✅ 1.4 Shareable Viewer URLs
- `?layers=` param synced to viewport on every layer toggle
- Copy Link button in brand bar — copies URL with active layers

### ✅ 1.5 Probe Search in Viewer
- `cg\d{7,8}` / `ch\.\d+\.\d+` detection in HeaderBar search
- Navigates to probe ±500bp window on Enter

---

## Phase 2 — Data Depth (Next)

**Goal:** Layer by layer, become the richest genomics reference database available. Every addition is a validated, publicly available dataset ingested via a reproducible pipeline.

Priority order is by biological utility and ingestion complexity.

### 2.0 Methylation Reference Data Population ← **START HERE**
*~2–4 hrs. Infrastructure from 1.3 is complete; this is just data.*
- Run `002_methylation_reference.sql` migration on production Fly.io DB
- Run `scripts/export_methylation_reference.R` to generate `data/methylation_reference_hg38.csv`
- Run `uv run python -m polymer_genomics.ingest.methylation` to populate `ref.methylation_reference`
- Register layer in `registry.layers` with `layer_key=methylation_atlas`
- Verify `MethylationReferenceTrack` renders in viewer at probe-resolution zoom

### 2.1 Gene Bioenergetics Layer
*~6–8 days total.*
- **Backend:** `bioenergetics.gene_costs` table (Akashi-Gojobori aa costs, CAI, tAI, GTEx EWGC, elemental composition), region router entry in `TRACK_REGISTRY`, gene cost detail endpoint `GET /v1/genes/{build}/{symbol}/cost`, MCP tool `lookup_gene_cost`
- **Frontend:** CostTrack canvas component (cost-graded color, height ∝ log2(c_protein)), TrackStack integration, gene detail page COST section
- **Source data:** Published — Akashi & Gojobori 2002, GTEx v10 (all experimentally validated)

### 2.2 Python Client Library
*~6–8 hrs.*
- Mirrors R client API exactly: `pg_query_region`, `pg_lookup_gene`, `pg_lookup_probe`, etc.
- httpx (async) + pandas DataFrames
- PyPI publishable (`pip install polymer-genomics`)
- No heavy bio dependencies (no Biopython, no pysam)

### 2.3 Proximity Query Endpoint
*~4–8 hrs.*
- `GET /v1/query?build=hg38&gene=TP53&radius=5000&layers=cpg_sites,probe_epic_v2`
- Resolves gene symbol → coordinates → expands by radius → calls region router
- Critical for regulatory analysis (e.g., "what CpGs are within 5kb of this promoter?")

### 2.4 MCP Server — PyPI Publish + Enhanced Descriptions
*~3–4 hrs. See AGENT_HARNESS.md for full spec.*
- Add `pyproject.toml` entry point: `polymer-genomics-mcp`
- One-line install: `uv tool install polymer-genomics-mcp`
- Enhance all 9 tool docstrings with "Use this when..." hints and example invocations

### 2.5 Gene Expression Layer (GTEx)
*~1–2 weeks.*
- Source: GTEx v10 median TPM per gene per tissue (54 tissues)
- New layer_type: `expression`
- Schema: `expression.gene_tpm(gene_symbol, tissue, median_tpm, log2_tpm)` partitioned by build
- Region query returns expression values for all genes overlapping region, all tissues
- **Unlock:** First true cross-layer correlation (methylation ↔ expression at same locus)

### 2.6 Chromatin Accessibility Layer (ENCODE DHS)
*~1–2 weeks.*
- Source: ENCODE Master DHS List (hg38, ~3.5M sites, 1,800 biosamples)
- New layer_type: `accessibility`
- Per-DHS: score, summit, cell_type_count, peak_biosample_list
- **Unlock:** Methylation ↔ accessibility at CpG sites; probe context interpretation

### 2.7 Regulatory Elements (ENCODE SCREEN RE2)
*~1 week.*
- Source: ENCODE SCREEN v3 candidate regulatory elements (cCREs)
- Classes: PLS (promoter), pELS (proximal enhancer), dELS (distal enhancer), CTCF-only, DNase-H3K4me3
- **Unlock:** Classify any queried region by regulatory context

### 2.8 Conservation Scores (PhyloP / PhastCons)
*~1 week.*
- Source: UCSC 100-way vertebrate alignment
- Stored as tiled float tracks (1kb resolution for display, per-base for precision query)
- **Unlock:** Evolutionary constraint layer for variant and CpG interpretation

---

## Phase 3 — Correlation Engine (Weeks 9–16)

**Goal:** The database becomes correlative. Multi-layer statistical queries are first-class.

### 3.1 Cross-Layer Correlation Endpoint
- `GET /v1/correlate?build=hg38&region=chr16:1-90000000&layer_a=cpg_sites&layer_b=dhs&stat=overlap_fraction`
- Supported stats: `overlap_fraction`, `co_occurrence`, `pearson_r` (for continuous tracks), `fisher_exact`
- Powers research questions like: "In this region, what fraction of CpG islands overlap ENCODE DHS?"

### 3.2 Genetic Variants (gnomAD + ClinVar)
- Source: gnomAD v4 common variants (AF > 0.01), ClinVar pathogenic/likely-pathogenic
- Schema: `variant.sites(chrom, pos, ref, alt, af, consequence, clinvar_sig)`
- **Unlock:** Sequence context interpretation, probe SNP flagging, disease-variant overlay

### 3.3 Histone Modification Consensus Tracks (ENCODE)
- Source: ENCODE histone ChIP-seq consensus (H3K4me3, H3K27ac, H3K4me1, H3K27me3, H3K9me3)
- Per-mark, per-cell-type: peak score, signal enrichment
- **Unlock:** Epigenomic state classification (active promoter, enhancer, heterochromatin)

### 3.4 3D Genome Context (Hi-C TADs + Compartments)
- Source: Rao 2014 Hi-C TAD calls + A/B compartment scores (GM12878, IMR90, K562)
- **Unlock:** Long-range regulatory context for any locus

### 3.5 GWAS Catalog Overlay
- Source: EBI GWAS Catalog (curated, p < 5e-8)
- Schema: trait, study PMID, beta, p-value, linked gene
- **Unlock:** Any region query shows trait-associated variants in context

### 3.6 Cell Type Specificity (Roadmap Epigenomics)
- Source: Roadmap 111 epigenomes — 5-mark chromatin state model
- 15-state ChromHMM per cell type
- **Unlock:** Cell-type-specific regulatory annotation at any locus

---

## Phase 4 — Viewer + Interface Polish (Parallel with Phase 3)

These improve usability for human researchers. Can be worked on concurrently with data layer additions.

### 4.1 Multi-Track Comparison Mode
- Side-by-side view of two genomic regions or two builds
- Use case: before/after, tissue A vs tissue B

### 4.2 Track Export
- PNG/SVG for current viewport (for figures)
- BED/BEDgraph/CSV for current data (for downstream analysis)

### 4.3 Enhanced Search
- Autocomplete with debounce
- Detect probe IDs, coordinates, gene aliases
- Badge display showing match type (gene / probe / coordinate)

### 4.4 Annotation Track Ordering
- Drag-to-reorder tracks in sidebar
- Per-track scale settings (log, linear, percentile)

---

## Data Layers — Target State

| Layer | Source | Status | Phase |
|-------|--------|--------|-------|
| Gene models (GENCODE v44) | GENCODE | ✅ Live | — |
| CpG sites / islands | Sequence-derived | ✅ Live | — |
| Methylation probes (EPIC v2, v1, 450K) | Illumina (derived) | ✅ Live | — |
| Isochores | GC-computed | ✅ Live | — |
| Cell-type methylation reference | FlowSorted Salas 2018 | 🔶 Schema+track done; data pending | 2.0 |
| Gene bioenergetics | Akashi-Gojobori / GTEx | Planned | 2.1 |
| Gene expression (GTEx) | GTEx v10 | Planned | 2.5 |
| Chromatin accessibility (DHS) | ENCODE | Planned | 2.6 |
| Regulatory elements | ENCODE SCREEN | Planned | 2.7 |
| Conservation (PhyloP/PhastCons) | UCSC 100-way | Planned | 2.8 |
| Genetic variants (gnomAD/ClinVar) | gnomAD v4, ClinVar | Planned | 3.2 |
| Histone modifications | ENCODE | Planned | 3.3 |
| 3D genome (TADs/compartments) | Rao 2014 | Planned | 3.4 |
| GWAS catalog | EBI GWAS | Planned | 3.5 |
| Chromatin states (ChromHMM) | Roadmap | Planned | 3.6 |

**Rule:** Every layer must have a published, citable source. No theoretically-derived quantities are included until they have independent experimental validation and publication.

---

## Explicitly Out of Scope

These are deferred indefinitely or excluded by design:

| Item | Reason |
|------|--------|
| User data uploading / server-side comparison | Requires auth, storage, privacy infrastructure — tackle after Phase 2 |
| Polymer Evolution L0–L3 physics tracks (stacking_dG, wrapping_energy, etc.) | Theoretically computed; need independent experimental validation before becoming reference layers |
| MethSig channel endpoint | Depends on unvalidated physics quintiles |
| Multi-user OAuth / JWT | Static API key sufficient until public launch |
| hg37 build | Add when explicitly requested by a user |
| Write / annotation editing endpoints | Read-only platform by design |
| Real-time streaming / WebSocket | REST + tiles cover all current use cases |
| Epistemic OS / BiologicalEntity schema | Research concept; not a platform feature |
