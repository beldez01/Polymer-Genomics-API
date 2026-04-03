# Polymer Genomics Platform — Consolidated Roadmap
*Last updated: 2026-03-17*

---

## Vision

Polymer Genomics is the first production database of genome-wide DNA biophysical properties. It is the first entry in an empty category: no existing genomic resource provides material-channel DNA properties (thermodynamic stability, mechanical stiffness, groove geometry, form propensity) genome-wide, and none enable their correlation with biological annotations in a single query.

**Three audiences, one platform:**
- **AI agents** (primary) — structured, anti-hallucination responses with epistemic metadata, provenance in every response, and structured flags. The API is designed so agents never confuse measured data with predictions.
- **Discovery scientists** — the preeminent genome browser, with biophysical tracks no other viewer offers, shareable URLs, and an embedded physics linter.
- **Bioinformaticians** — Python SDK on PyPI, REST API with OpenAPI spec, GRanges-compatible JSON, and cross-layer correlation/intersection in single queries.

**Strategic positioning:** First entry in an empty category on the Topology VC Scientific AI Map. The computation IS the IP (legal clearance confirmed). Target: NAR Database Issue (canonical registry for biological infrastructure).

---

## Architectural Invariants (Do Not Revisit)

- GiST-indexed partitioned tables (HASH(4) for >100K rows)
- 1-based closed external / 0-based half-open internal coordinates (single conversion layer)
- GRanges JSON response format with `layers_resolved` + `content_hash`
- MCP as the agent interface (not raw DB access)
- Read-only API (no write endpoints)
- Three resolutions (1kb/10kb/100kb) as ingestion invariant for continuous tracks
- Epistemic evidence classes (M/R/D/S/K/H/L) on every layer
- Provenance in every response (api_version, data_version, source, license per layer)

---

## What's Live (Complete)

### Infrastructure
| Component | Status | Notes |
|-----------|--------|-------|
| REST API | ✅ Live | 17+ endpoints, FastAPI + asyncpg, api.polymerbio.org (Fly.io iad) |
| MCP Server | ✅ Live | 44 tools (34 reference + 10 compute), FastMCP, stdio transport |
| Frontend Viewer | ✅ Live | Canvas-based multi-track, keyboard nav, polymerbio.org (Vercel) |
| Python SDK | ✅ PyPI | `pip install polymer-genomics` (v0.2.0, MIT) |
| Test Suite | ✅ | 41 files, 440+ tests |
| Epistemic Schema | ✅ | Evidence classes, tier, equilibrium, statefulness on all layers |
| Methylation Engine | ✅ | 10 compute tools, R subprocess, session management |

### Data Layers (41 on hg38)
| Layer | Source | Evidence Class | Rows |
|-------|--------|----------------|------|
| Gene models | GENCODE v44 | K | 3,039,917 |
| CpG sites | Computed | D | 29,401,795 |
| CpG islands | UCSC | D | 27,949 |
| Isochores | Computed | D | 10,307 |
| Methylation atlas | Loyfer 2023 | M | 865,859 |
| Probes: 450K / EPIC v1 / EPIC v2 | Illumina | D | 485K / 866K / 937K |
| Conservation (PhyloP/PhastCons) | UCSC 100-way | S | genome-wide |
| ENCODE cCREs v4 | ENCODE | S | genome-wide |
| ChromHMM 15-state | Roadmap | S | genome-wide |
| Histone marks | ENCODE v3 | M | genome-wide |
| GTEx v10 expression | GTEx | M | genome-wide |
| Gene constraint | gnomAD v4 | S | genome-wide |
| Reactome pathways | Reactome | K | genome-wide |
| MSigDB Hallmark | MSigDB | K | genome-wide |
| Protein abundance | PaxDb v6.0 | M | genome-wide |
| Human Protein Atlas | HPA v23 | M | genome-wide |
| Gene biosynthetic costs | Akashi-Gojobori/GTEx | D | genome-wide |
| Repeat elements | RepeatMasker | S | 5,317,291 |
| HERV proviral loci | Telescope | — | 14,203 |
| Non-B DNA structures | Computed | D | 2,937,698 |
| Fragility composite | Computed | D | 2,937,681 |
| Breakpoints | Mitelman/COSMIC | K | 49 |
| GWAS catalog | EBI | S | genome-wide |
| SBS mutation spectrum | COSMIC v3.4 | K | 96 channels |
| Epigenetic clock probes | Literature | K | multi-clock |
| **Sequence biophysics L0** | **Computed (64 cols)** | **D** | **genome-wide** |

### API Features Live
| Feature | Endpoint | Notes |
|---------|----------|-------|
| Region queries | `GET /v1/regions/{build}/{region}` | GRanges JSON, cursor pagination, field selection |
| Summary statistics | `GET /v1/stats/{build}/{region}` | Mean/median/sd/percentiles per layer |
| Platform summary | `GET /v1/stats/summary` | Total layers, rows, builds — for NAR reviewers |
| Cross-layer correlation | `GET /v1/correlate/{build}/{region}` | Pearson, Spearman, overlap, Jaccard, Fisher |
| Cross-layer intersection | `POST /v1/query/intersect` | Boolean AND across up to 10 layers |
| Region profile | `GET /v1/profile/{build}/{region}` | All layers + significance flags |
| Query recipes | `GET /v1/query/recipes` | 5 prebuilt cross-layer queries |
| Physics linter | `POST /v1/evaluate` | 13 flag types, CpG islands, thermodynamics |
| Batch evaluate | `POST /v1/evaluate/batch` | Up to 100 sequences |
| Sequence comparison | `POST /v1/compare` | 2–10 variants with deltas |
| Layer license/provenance | `GET /v1/layers/{key}/license` | Source, license, ODbL flag, citation |
| Gene lookup + aliases | `GET /v1/genes/{build}/{symbol}` | p53→TP53, OCT4→POU5F1 |
| Sequence retrieval | `GET /v1/sequence/{build}/{region}` | Max 100 kb |
| Aggregation | `GET /v1/aggregation/{build}/{region}` | Binned density for large regions |

### Viewer Pages Live
| Page | URL | Notes |
|------|-----|-------|
| Genome browser | `/view/{build}/{region}` | Canvas multi-track, shareable URLs |
| Physics linter | `/evaluate` | Evidence badges, PNG export |
| Methylation atlas | `/atlas` | Karyotype overview, GeneCards |
| Gene detail | `/gene/{build}/{symbol}` | Transcript diagram, locus panels |
| DMP viewer | `/dmp` | Differential methylation results |
| API docs | `/developers` | Quickstart, endpoint reference |
| Data sources | `/data-sources` | Per-layer citations |

---

## Next Milestone: NAR Database Issue Paper

**The single highest-leverage action.** NAR Database Issue is the IANA of biology — BLAST, CLUSTAL, Primer3, UniProt all live there. Publishing Polymer Genomics places it in that registry permanently.

**Status:** Draft manuscript at `docs/paper/nar_database_issue_2026.md`
**Deadline:** July–August 2026 for January 2027 issue
**Platform readiness:** All engineering prerequisites complete (provenance, stats/summary, SDK on PyPI, versioned responses)

**Remaining work:**
- [ ] Finalize manuscript text (~3,500 words, 30 references)
- [ ] Prepare 3-4 figures (architecture, physics linter output, cross-layer example, comparison table)
- [ ] Internal review
- [ ] Submit via academic.oup.com/nar

---

## Active Work

### Viewer Enhancements (Goal: preeminent genome browser)
| Feature | Effort | Status |
|---------|--------|--------|
| Compare sequences frontend UI | 2-3 days | API exists, frontend missing |
| Semantic zoom (auto resolution selection) | 2-3 days | Planned |
| Track export (PNG/SVG/BED/CSV) | 1-2 days | Planned |
| Drag-to-reorder tracks, per-track settings | 1-2 days | Planned |
| Enhanced search (autocomplete, match-type badges) | 1-2 days | Planned |
| Multi-track comparison mode | 2-3 days | Planned |

### Developer Adoption
| Feature | Effort | Status |
|---------|--------|--------|
| Jupyter notebook examples (3-5 notebooks) | 1-2 days | Not started |
| Landing page + comparison table (vs UCSC/Ensembl/ENCODE) | 1 day | Not started |
| Quickstart guide ("3 API calls") | 1 day | Not started |
| MCP integration guide | 1 day | Not started |

### Data Depth
| Task | Class | Effort | Status |
|------|-------|--------|--------|
| Fragility composite score | D | — | ✅ Complete (2,937,681 rows, `layers=fragility_composite`) |
| Non-B DNA structures | D | — | ✅ Complete (2,937,698 rows) |
| Breakpoint catalog | K | — | ✅ Complete (49 CFS + translocations) |
| Melting domain tracks (Poland-Scheraga) | H | — | ✅ Complete (bubble_propensity, melting_width, melting_cooperativity) |
| CpG context annotation columns (CGI/shore/shelf × genic × isochore) | D | 3-5 days | Not started |
| Per-position mutation dG (4 SBS channels) | H | — | ✅ Complete (sbs_c_to_{a,g,t}_ddg, sbs_t_to_a_ddg, genome-wide) |
| ABC enhancer-gene predictions | S | 3-5 days | Not started |
| JASPAR TF binding profiles | S | 3-5 days | Not started |

### Agent Harness
| Task | Effort | Status |
|------|--------|--------|
| Embedded agent chat (Phase 5) | 4 days MVP | Design complete, not started |
| Pydantic output contracts | 4-6 hrs | Not started |
| MCP Resources for static context | 3-4 hrs | Not started |
| MCP server PyPI publish | 2-3 hrs | Not started |

---

## Planned — Expansion Wave 3 (Gated)

Each must pass: **does ingesting this serve our users better than linking to the source?**

| Layer | Decision Framework |
|-------|-------------------|
| gnomAD v4 variants | Ingest common (AF>0.001) only? Or proxy with biophysical context? |
| ClinVar | Small (~500 MB). Value in cross-referencing with biophysics. |
| GTEx eQTLs | Massive. Ingest significant only (p < 1e-5)? |
| Hi-C TADs/compartments | Connects to correlation length / mechanical connectivity |
| AlphaMissense | L-class. Proxy unless cross-layer queries demand local. |

---

## Out of Scope

| Item | Reason |
|------|--------|
| Polymer Evolution L1-L3.5 as API layers | Need independent experimental validation + publication first |
| MethSig NMF decomposition | Needs TCGA pan-cancer data + Phase II clinical |
| ThermAge composite score | Needs MethSig + fragmentomics + clinical validation |
| BiologicalEntity S4 class | Research concept, not platform feature |
| Multi-user OAuth / JWT | API key sufficient until public launch |
| Write / annotation editing endpoints | Read-only by design |
| Real-time streaming / WebSocket | REST + tiles sufficient |
| GraphQL | REST with `fields=` gives 80% of benefit |
| Mobile / responsive | Desktop scientific instrument |

These are the NEXT platform, not enhancements to THIS platform.

---

## Infrastructure

- **API:** Fly.io, shared-cpu-2x, 1 GB RAM, iad region
- **Database:** Fly.io Postgres 16, 20 GB volume (14 GB used, 70%)
- **Frontend:** Vercel
- **Object Storage:** AWS S3
- **Scale-up path:** Volume grows instantly; CPU/RAM via `fly machine update --vm-size`

---

## Archive

Historical plan documents in `docs/plans/archive/`.
