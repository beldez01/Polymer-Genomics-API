# Polymer Genomics Platform — Consolidated Roadmap
*Last updated: 2026-03-15*

---

## Vision

The most richly integrated, correlative genomics reference database — with complete API integration that makes measurable biology maximally computable. Agent-first: AI agents are the primary consumer. Discovery scientists explore via the browser. Bioinformaticians query programmatically.

**Rule:** Every layer must have a published, citable source. No theoretically-derived quantities until independently validated and published.

---

## Architectural Invariants (Do Not Revisit)

- GiST-indexed partitioned tables (HASH(4) for >100K rows)
- 1-based closed external / 0-based half-open internal coordinates (single conversion layer)
- GRanges JSON response format with `layers_resolved` + `content_hash`
- MCP as the agent interface (not raw DB access)
- Read-only API (no write endpoints)
- Three resolutions (1kb/10kb/100kb) as ingestion invariant for continuous tracks
- Epistemic evidence classes (M/R/D/S/K/H/L) on every layer

---

## What's Live (Complete)

### Infrastructure
| Component | Notes |
|-----------|-------|
| REST API | 14+ endpoints, FastAPI + asyncpg, live at api.polymerbio.org (Fly.io) |
| MCP Server | 33 tools (23 reference + 10 compute), FastMCP, stdio transport |
| Frontend Viewer | Canvas-based, multi-track, keyboard nav, Zustand, live at polymerbio.org (Vercel) |
| R Client | 8 functions, httr2, GRanges output |
| Test Suite | 24 files, 440+ tests |
| Track Registry | Declarative `TRACK_REGISTRY` in queries.py — zero if/elif dispatch |
| Shareable URLs | `?layers=` param synced to viewport; Copy Link button |
| Probe Search | `cg`/`ch` ID detection → navigate to probe ±500bp |
| Gene Detail Page | `/gene/[build]/[symbol]` — transcript diagram, locus/CpG panels |
| Atlas + GeneCard | `/atlas` — karyotype cards, GeneCard (11 sections A-K), UniProt protein domains |
| Agent Harness | `.claude/commands/bioinfo.md` + AGENT.md — coordinate conventions, tool composition |
| Methylation Compute Engine | 10 tools, 8 R scripts, async subprocess bridge, session management |
| Epistemic Schema | Evidence classes (M/R/D/S/K/H/L), tier, equilibrium, statefulness on all layers |

### Data Layers Live
| Layer | Source | Evidence Class |
|-------|--------|---------------|
| Gene models | GENCODE v44 | K |
| CpG sites / islands | Sequence-derived | D |
| Methylation probes | EPIC v2, v1, 450K (Illumina) | D |
| Isochores | GC-computed segmentation | D |
| Cell-type methylation ref | FlowSorted Salas 2018 | M |
| Gene bioenergetics | Akashi-Gojobori / GTEx / UniProt | D |
| Gene expression | GTEx v10 (54 tissues) | M |
| Regulatory elements | ENCODE cCREs V4 (926K) | S |
| Conservation | PhyloP/PhastCons 100-way | S |
| Gene constraint | gnomAD pLI/LOEUF/Z-scores | S |
| Gene pathways | Reactome | K |
| Gene sets | MSigDB Hallmark | K |
| Protein abundance | PaxDb | M |
| Protein atlas | HPA tissue + subcellular | M |
| SBS thermodynamic spectrum | SantaLucia NN × COSMIC channels | D |
| Epigenetic clock coefficients | Horvath/Hannum/PhenoAge/GrimAge/DunedinPACE | R |
| Metabolic burden w/ turnover | Cost × expression × half-life | D |
| DNAshapeR tracks | MGW, ProT, Roll, HelT (1kb bins) | D |
| Sequence biophysics (L0) | Stacking dG, Tm, GC, curvature, groove, dipole, periodicity | D |
| NN parameters | SantaLucia/Xia/Sugimoto lookup | R |
| Dinucleotide properties | Extinction, groove geometry, form propensity | R |
| Amino acid properties | MW, volume, hydrophobicity, pKa, cost | R |
| Physical constants | Lp, Manning, elastic moduli, enzymatic rates | R |

### Expansion Phase 1A-1B (Complete, commits documented in archive)
- Phase 1A: Epistemic ENUMs migration, layer classification, API/MCP epistemic metadata, test suite (48 fixes)
- Phase 1B: SBS spectrum, clock coefficients, metabolic burden, DNAshapeR tracks

---

## Active Work — Expansion Wave 1 Remaining

### Phase 1C: Biophysical Depth
| Task | Class | Effort | Status |
|------|-------|--------|--------|
| Melting domain tracks (Poland-Scheraga stitch profiles) | H | 5-7 days | Not started |
| Per-position mutation dG (6 SBS-type tracks, stacking perturbation per SNV) | H | 5-7 days | Not started |

### Phase 1D: Breakpoint/Fragility Stack
| Task | Class | Effort | Status |
|------|-------|--------|--------|
| Breakpoint catalog (CFS, COSMIC SV, constitutional hotspots) | K | 2-3 days | Not started |
| Non-B DNA predictions (G4, Z-DNA, cruciform, R-loop) | D | 3-5 days | Not started |
| Fragility score (composite: non-B + stacking + curvature + replication timing) | H | 3-5 days | Not started |

**H-class safeguards for fragility score:**
- `falsification_path`: Compare predicted fragility vs PCAWG SV breakpoint density (ROC/AUC at 10kb)
- `closest_lower_class_proxy`: D (demote if benchmark fails)

### Phase 1E: Validation (Parallel)
| Task | Status |
|------|--------|
| Validation framework scaffold (per-class protocols) | Not started |
| Validation scripts for new Wave 1 layers | Not started |
| Retrofit validation for existing layers | Not started |

### Agent Harness — Remaining Items
| Task | Effort | Status |
|------|--------|--------|
| Pydantic output contracts (GeneResponse, ProbeAnnotation, RegionResponse) | 4-6 hrs | Not started |
| MCP Resources for static context (polymer://layers, polymer://conventions/*) | 3-4 hrs | Not started |
| PyPI publish (`uv tool install polymer-genomics-mcp`) | 2-3 hrs | Not started |
| Docker image build + publish | 2-3 hrs | Dockerfile ready |

---

## Planned — Expansion Wave 2: Strategic Depth (~4-6 weeks)

### Data Layers
| Layer | Class | Effort | Why Strategic |
|-------|-------|--------|---------------|
| Loyfer cell-type methylation atlas (39 cell types) | M | 5-7 days | Constrained tier data; atlas_layers table exists |
| ABC enhancer-gene predictions (6.3M links, 131 biosamples) | S | 3-5 days | Connects regulatory biophysics to target genes |
| JASPAR TF binding profiles | S | 3-5 days | TF motifs as sequence-intrinsic recognition on energy surface |

### API Features
| Feature | Effort | Description |
|---------|--------|-------------|
| Cross-layer intersection endpoint (`POST /v1/query/intersect`) | 5-7 days | Multi-filter GiST intersection. MCP tool: `intersect_layers` |
| Statistical summary endpoint | 2-3 days | Mean/median/sd/quantiles per track for a region |
| Comparative query endpoint | 2-3 days | Side-by-side stats for two regions |

### UI Enhancements
| Feature | Effort |
|---------|--------|
| Evidence class badges (M/R/D/S/K/H/L on track labels) | Low |
| SVG/PNG export with auto-generated figure legend | Low |
| Linked table-browser cross-selection | Low |
| Multi-sample methylation heatmap track | Moderate |

**Infrastructure:** Upgrade to 2 GB RAM, extend volume to 40 GB before data ingestion.

---

## Planned — Embedded Agent Chat (Phase 5)

> Full design: `archive/PHASE5_AGENT_CHAT.md`

Browser chat panel on polymerbio.org — users ask questions about what they're viewing. Agent calls internal Python query functions directly (no HTTP round-trip per tool call).

| Step | What | Effort |
|------|------|--------|
| 1 | Backend `/v1/chat` endpoint (SSE streaming, Anthropic Messages API) | 1 day |
| 2 | System prompt (domain knowledge, page context) | 2 hrs |
| 3 | Tool definitions + dispatcher (10-tool launch set) | 4 hrs |
| 4 | Frontend ChatPanel (drawer, SSE client) | 2 days |
| 5 | Methylation upload flow (`/analyze` page, R worker) | 3-4 days (deferred post-MVP) |
| 6 | Genomics wiki (curated articles, `search_wiki` tool) | Ongoing |

**Cost:** ~$30-50/mo at current scale. Steps 1-4 are the MVP (~4 days).

---

## Planned — Expansion Wave 3: Selective Completeness (Gated)

Each must pass: **does ingesting this serve our users better than linking to the source?**

| Layer | Decision Framework |
|-------|-------------------|
| gnomAD v4 variants | Ingest common (AF>0.001) only? Or proxy gnomAD API with biophysical context? |
| ClinVar | Small enough to ingest (~500 MB). Value in cross-referencing with biophysics. |
| GTEx eQTLs | Massive volume. Ingest significant only (p < 1e-5)? |
| Hi-C TADs/compartments | Ingest — connects to Polymer Evolution correlation length. |
| AlphaMissense | L-class. Proxy unless cross-layer queries demand local. |
| Histone modifications (ENCODE) | 5 marks × cell types. Enables ChromHMM. |
| Chromatin states (ChromHMM) | 15-state per cell type. Requires histone marks first. |
| GWAS catalog (EBI) | Curated, p < 5e-8. Trait association overlay. |

### UI Capstones
- Semantic zoom (auto 1kb/10kb/100kb resolution selection)
- Natural language search ("conserved CpG islands with low stacking energy near TET2")

**Infrastructure:** Evaluate 4 GB RAM, extend volume to 60 GB if needed.

---

## Viewer Polish (Parallel with Any Phase)

| Feature | Status |
|---------|--------|
| Multi-track comparison mode (side-by-side regions) | Planned |
| Track export (PNG/SVG/BED/CSV) | Planned |
| Enhanced search (autocomplete, match-type badges) | Planned |
| Drag-to-reorder tracks, per-track scale settings | Planned |
| CostTrack canvas component (cost-graded color per gene) | Planned |

---

## Out of Scope

| Item | Reason |
|------|--------|
| Polymer Evolution L0-L3 as API layers | Need independent experimental validation first |
| MethSig channel endpoint | Depends on unvalidated physics quintiles |
| BiologicalEntity / Epistemic OS schema | Research concept, not platform feature |
| hg37 build | Add when explicitly requested |
| Multi-user OAuth / JWT | API key sufficient until public launch |
| Write / annotation editing endpoints | Read-only by design |
| Real-time streaming / WebSocket | REST + tiles sufficient |
| rpy2 integration | Subprocess is better (no GIL, reproducible) |
| GraphQL | REST with `fields=` gives 80% of benefit |
| Mobile / responsive | Desktop scientific instrument |

---

## Archive

Historical plan documents preserved in `docs/plans/archive/`:
- `ROADMAP_legacy.md` — original Phase 1-4 roadmap (superseded by this file)
- `2026-03-09-expansion-blueprint-design.md` — epistemic schema design, layer classification table, wave strategy (approved, concepts absorbed here)
- `2026-03-09-expansion-implementation-plan.md` — task-by-task implementation with commit SHAs for Phase 1A-1B
- `AGENT_HARNESS.md` — 5-layer harness architecture, R bridge details, Pydantic model specs
- `PHASE5_AGENT_CHAT.md` — full embedded chat design (architecture, system prompt, tool dispatch, upload flow)
- `2026-02-25-genomics-api-design.md` — original V1 architecture spec (foundational, still accurate)
- `2026-02-25-implementation-plan.md` — original V1 scaffold plan (historical)
- `2026-02-27-strategic-dev-plan.md` — strategic reframing ("stop starting, start shipping")
- `2026-03-02-phase2-implementation-plan.md` — Phase 2 task breakdown (superseded)
- `2026-03-02-harness-architecture-plan.md` — agent harness vision, BiologicalEntity concept
- `2026-03-02-gene-cost-layer-implementation.md` — gene bioenergetics 11-step implementation record
- `PLATFORM_ROADMAP.md` — early 6-phase plan (superseded)
