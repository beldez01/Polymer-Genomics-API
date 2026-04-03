# Polymer Genomics — Database Inventory & Operations

> **Created:** 2026-04-01
> **Purpose:** Systematic inventory of all data layers, their provenance, validation status, and the infrastructure that serves them.
> **Audience:** Internal reference for database management, NAR paper preparation, and operational decisions.

---

## I. Infrastructure

### Deployment Architecture

| Tier | Platform | Endpoint | Config |
|---|---|---|---|
| API | **Fly.io** (`polymer-genomics-api`, region: iad) | api.polymerbio.org | `fly.toml` |
| Database | **Fly.io Postgres 16** | Internal (via `fly proxy`) | shared-cpu-2x, 1 GB RAM |
| Frontend | **Vercel** | polymerbio.org | `viewer/vercel.json` |
| MCP Server | Local (stdio) | N/A | `mcp/server.py` |
| SDK | **PyPI** | `pip install polymer-genomics` | `sdk/python/` |

### Database Resources

| Resource | Current | Limit | Notes |
|---|---|---|---|
| Volume | 14 GB used / 20 GB | Expandable via `fly volumes extend` (no downtime) |  |
| RAM | 1 GB | Binding constraint for complex queries |  |
| CPU | shared-cpu-2x | Upgradeable via `fly machine update --vm-size` |  |
| Rows | ~53M features across 41 layers | | |

### Versions

| Component | Version | Format |
|---|---|---|
| API | 0.2.0 | Semantic (defined in `src/polymer_genomics/__init__.py`) |
| Data | 2026.03 | Calendar YYYY.MM (defined in `src/polymer_genomics/envelope.py`) |
| SDK | 0.3.0 | Semantic (PyPI: `polymer-genomics`) |
| MCP | 1.0.0 | Semantic (44 tools: 34 reference + 10 compute) |
| Frontend | Next.js 16.1.6 + React 19.2.3 | Vercel deployment |

### Tech Stack

| Layer | Technology |
|---|---|
| Web framework | FastAPI 0.115+ (async, ASGI) |
| Server | Uvicorn 0.34+ (2 workers) |
| Database driver | asyncpg 0.30+ (pool: min 2, max 10) |
| Frontend | Next.js 16 + React 19 + Tailwind 4 + Zustand 5 |
| SDK dependency | httpx >= 0.24 (only dependency) |

### Database Architecture

**12 schemas:** `ref`, `registry`, `cpg`, `gene`, `probe`, `methylation`, `biophysics`, `hla`, `evolution`, `variation`, `nuclear`, `qtl`

**Partitioning:** Two-level LIST partitioning on large tables:
- Primary: by `build` (hg37, hg38)
- Secondary: by `chr_id` (1-25)
- Affected: `gene.features`, `cpg.sites`
- Indexes: GiST on coordinate ranges (int4range), B-tree on symbol/type/build

**Content hashing:** SHA-256 of deterministic byte encoding of all rows per layer. Stored in `registry.layers.content_hash`. Updated at ingestion. Format: `sha256:<hex_digest>`.

### Security & Access

| Aspect | Implementation |
|---|---|
| Authentication | Static API key via `X-API-Key` header or `api_key` query param. Timing-safe comparison (`secrets.compare_digest`). No auth in dev mode (env var unset). |
| Rate limiting | Fly.io concurrency: 250 hard / 200 soft (requests). Statement timeout: 30s. Max region: 10 Mb. Max rows: 50,000 (returns `status: truncated` + cursor). |
| CORS | polymerbio.org, www.polymerbio.org, polymer-genomics.vercel.app, localhost:3000 |
| HTTPS | Forced on Fly.io (`force_https = true`) |
| DB roles | `api_reader` (SELECT only, 30s timeout, 64 MB work_mem); `ingest_writer` (COPY privilege, separate from API) |
| Headers | `X-Robots-Tag: noindex, nofollow` on all responses |
| Coordinate conversion | 1-based closed (external) ↔ 0-based half-open (internal), single layer in `coordinates.py` |

### Monitoring & Operations

| Aspect | Implementation |
|---|---|
| Health check (public) | `GET /ping` — no auth, returns `{"status": "ok"}`. Fly.io polls every 30s. |
| Health check (internal) | `GET /health` — requires auth, checks DB connection + chromosome count. |
| Logging | Uvicorn stdout (captured by Fly.io). No Sentry/dedicated error tracking. |
| Timing | Every response includes `query_time_ms` and `db_time_ms`. |
| Deployment | `fly deploy` from repo root |
| Local dev | `docker-compose.yml` — Postgres 16 + MinIO. **DO NOT run migrations against local DB.** |
| Frontend deploy | `cd viewer && vercel --prod` |
| SDK publish | `cd sdk/python && uv build && uv publish` |

### Ingestion Pipeline

**53 modules in 8 tiers**, total ingestion time ~12-16 hours.

| Tier | Name | Modules | Duration |
|---|---|---|---|
| 0 | Init | 1 | <5s |
| 1 | Foundation | 5 | 1-2h |
| 2 | Core Biophysics | 1 | 30-90m |
| 3 | Extended Biophysics | 14 | 2-4h |
| 4 | Conservation/Regulatory | 8 | 1.5-2.5h |
| 5 | Expression/Cost/Constraint | 11 | 30-60m |
| 6 | Cross-reference | 3 | 30-45m |
| 7 | 3D Genome | 7 | 2-4h |
| 8 | Reference | 4 | 1-5m |

CLI: `./scripts/ingest_all.sh [--step N] [--tier N] [--module NAME] [--dry-run]`

### Migration Strategy

- **Hand-written SQL** in `scripts/migrations/` (not Alembic ORM)
- 3 migrations to date (gene_type column, crossmap constraint, CGI layer type)
- Execution via `scripts/run_prod_migrations.py` against Fly.io Postgres
- Init schema: `docker/postgres/init.sql` (idempotent, uses `IF NOT EXISTS`)
- **NEVER** run migrations against local Docker DB

---

## II. Data Layers — Complete Inventory

### Biophysics (Core Novel Contribution)

| Layer | Type | Source | Version | Features | Evidence | License | Validation |
|---|---|---|---|---|---|---|---|
| `sequence_biophysics_l0` | 64 columns at 1kb | Polymer Evolution Phase 1-3.5 | v1.0 | 2,937,992 windows | D (Derived) | Proprietary computation | Gold: NN params exact match SantaLucia 1998. Engine: 7/7 test sequences pass. |

**Columns (64):**
- Core (8): GC, stacking_dg37, melting_temp, curvature, dipole_density, minor_groove_width, periodicity_power, deformability
- DNAshape (8): MGW, ProT, Roll, HelT + positional derivatives
- Methylation perturbation (10): cpg_density, cpg_obs_exp, meth_delta_dg, meth_delta_tm, meth_sensitivity, meth_capacity, demeth_cost, cpg_context metrics
- Green's function (4): correlation_length, integrated_response, perturbation_reach, response_asymmetry
- Extended (13): g4_density, g4_max_score, kmer_complexity, dinuc_entropy, dominant_period, additional structural

| Layer | Type | Source | Features | Evidence | Validation |
|---|---|---|---|---|---|
| `nonb_dna_v1` | Non-B structures | Predicted (G4, Z-DNA, cruciform, triplex) | 2.9M | D | **NOT VALIDATED** against wet-lab G4 data |
| `fragility_composite_v1` | Integrated fragility | Composite of non-B + thermodynamics + curvature | 2.9M | D | **NOT VALIDATED** experimentally |

### Gene Annotations

| Layer | Source | Version | Features | Evidence | Validation |
|---|---|---|---|---|---|
| `gencode_v44` | GENCODE | v44 | 3.0M (exons, introns, UTRs, CDS) | K (Curated) | Gold: TP53, BRCA1, ALB verified. Minor end-coordinate discrepancies (~3-8bp) vs Ensembl v115. |
| `gene_constraint_v1` | gnomAD | v4 (v2.1.1 scores) | Genome-wide | S (Statistical) | Gold: 12/12 genes exact match to gnomAD API. Full constraint spectrum validated. |
| `gene_expression_v1` | GTEx | v10 | 54 tissues | M (Measured) | Gold: 10/10 genes perfect tissue-specificity patterns. |
| `gene_cost_v1` | Akashi-Gojobori + GTEx | Derived | Genome-wide | D | Gold: 6/6 protein lengths match UniProt, CAI correct. ECPA + tissue-weighted EWGC. |

### CpG & Methylation

| Layer | Source | Version | Features | Evidence | Validation |
|---|---|---|---|---|---|
| `cpg_sites_v1` | Derived from hg38 | - | 29.4M | D | Verified: island/shore/shelf/open_sea context correct. |
| `cpg_islands_v1` | Derived | - | 27,949 | D | Cross-checked with UCSC CGI track. |
| `methylation_atlas_v1` | Loyfer et al. 2023 | Nature | 865,859 | M | Cell-type betas from published source. |
| `probe_450k` | Illumina | - | 485,545 | K | Gold: 8/10 probes verified against SeSAMe index. |
| `probe_epic_v1` | Illumina | - | 865,876 | K | Cross-platform mapping included. |
| `probe_epic_v2` | Illumina | - | 937,053 | K | Verified. One duplicate entry noted (non-critical). |
| `epigenetic_clocks_v1` | Multiple sources | Horvath 2013, Hannum 2013, PhenoAge, GrimAge, DunedinPACE, Retro-Age | Multiple | K | **CORRUPTED** — dual-loading bug. All 5 clocks have extra spurious probes (10-15 each). Fix script created (`fix_all_clocks.sql`), pending re-ingestion. PhenoAge PMID corrected. |

### Regulatory & Chromatin

| Layer | Source | Version | Features | Evidence | Validation |
|---|---|---|---|---|---|
| `encode_ccre_v4` | ENCODE | v4 | 926,535 | S | Gold: 3/3 regions tested (TP53 PLS, HBB LCR, OCT4). |
| `chromhmm_15state_v1` | Roadmap Epigenomics | 15-state | Genome-wide | S | Source: Nature 2015. |
| `histone_peaks_encode_v1` | ENCODE | v3 | 1,350,188 | M | ChIP-seq peaks. |

### Conservation & Repeats

| Layer | Source | Version | Features | Evidence | Validation |
|---|---|---|---|---|---|
| `phylop_100way_v1` | UCSC | 100-way mammalian | Genome-wide | S | Pollard et al. 2010. |
| `phastcons_100way_v1` | UCSC | 100-way | Genome-wide | S | Standard source. |
| `repeatmasker_v1` | RepeatMasker | hg38 | 5.3M elements | S | Gold: Element types, strands, divergence validated. ~43% coverage matches published ~45%. |
| `herv_loci_v1` | Telescope | - | 14,203 | K | Bendall et al. 2019. |

### Protein

| Layer | Source | Version | Features | Evidence | Validation |
|---|---|---|---|---|---|
| `paxdb_v1` | PaxDb | v6.0 | Tissue-specific PPM | M | Gold: secreted protein caveat documented (IHC artifact for albumin). |
| `protein_atlas_v1` | HPA | v23 | Tissue expression + localization | M | 4/5 genes correct. ALB known artifact. |

### Pathways & Gene Sets

| Layer | Source | Version | Features | Evidence | Validation |
|---|---|---|---|---|---|
| `reactome_v1` | Reactome | Current | Genome-wide | K | Gold: 5/5 genes, pathway IDs correct, hierarchy correct. |
| `msigdb_hallmark_v1` | MSigDB | Hallmark (50 sets) | Genome-wide | K | Gold: 10/10 genes, source GMT file faithfully reproduced. |

### Disease & Mutation

| Layer | Source | Version | Features | Evidence | Validation |
|---|---|---|---|---|---|
| `gwas_catalog_v1` | EBI GWAS Catalog | Current | Genome-wide | S | Standard source. |
| `sbs_spectrum_v1` | COSMIC | v3.4 | 96 trinucleotide channels | K | Gold: 24+ channels arithmetically verified against NN parameters. |
| `breakpoints_v1` | Mitelman/COSMIC | - | 49 features | K | Limited validation. |

### Genome Structure

| Layer | Source | Version | Features | Evidence | Validation |
|---|---|---|---|---|---|
| `isochores_v1` | Derived | - | 10,307 | D | Bernardi classification. |
| `tad_domain_v1` | ENCODE Arrowhead | - | 348K domains, 108 cell types | S | Loaded from ENCODE. |
| `hic_compartment_v1` | 4DN | - | A/B compartment PC1 | S | Standard source. |
| `insulation_score_v1` | 4DN | - | Diamond insulation | S | Standard source. |

### Reference Constants (Not Layers, But Queryable)

| Resource | Source | Validation |
|---|---|---|
| SantaLucia NN parameters | PNAS 1998 | Gold: ALL 10 ΔH/ΔS/ΔG₃₇ EXACT MATCH. Symmetries validated. |
| Physical constants (40) | Literature | Gold: Lp, Manning ξ, nucleosome wrap, MW/bp, overstretching force all verified. |
| Amino acid properties (20) | Multiple | Gold: Kyte-Doolittle all 20 exact. Akashi-Gojobori all 20 exact. Wimley-White 18/20 (2 corrected). |
| Dinucleotide properties | El Hassan & Calladine 1996/1997 | Published source. |

---

## III. Known Issues

| Issue | Severity | Status | Action |
|---|---|---|---|
| Epigenetic clock dual-loading | **Critical** | Fix script created | Pending re-ingestion via `fix_all_clocks.sql` |
| PhenoAge PMID | Minor | Fixed in code | 29507958 → 29676998 |
| Rise per bp | Minor | Fixed | 3.32 → 3.4 Angstrom |
| Glycine MW | Minor | Fixed | 57.05 → 57.02 Da |
| Wimley-White Asp/Glu | Minor | Fixed | Values corrected |
| Z-form propensity scale | Minor | Fixed | Ordinal → Z-Hunt AS-AS energies |
| BRCA1 transcript canonical | Info | Documented | gnomAD canonical vs MANE Select |
| Probe crossmap duplicate | Info | Documented | One epic_v2 entry appears twice |
| Non-B DNA unvalidated | Warning | Acknowledged | No wet-lab comparison done |
| Fragility composite unvalidated | Warning | Acknowledged | No experimental validation |

---

## IV. Compute Capabilities

### Physics Linter (`evaluate_design`, `compare_sequences`, `batch_evaluate`, `evaluate_construct`)
- Input: arbitrary DNA sequence (10-100,000 bp)
- Output: windowed thermodynamic properties + 13 flag types
- Flags: CpG islands, homopolymers (>=8, >=12), dinucleotide repeats, direct/inverted repeats, extreme GC (>80% or <15%), Z-form propensity, silencing risk
- Batch: up to 100 sequences
- Comparison: 2-10 variants with delta analysis
- Construct: multi-part with junction analysis
- Validated: 7/7 test sequences pass arithmetic validation

### Methylation Pipeline (10 MCP compute tools)
- `load_idats` → `normalize` → `filter_probes` → `run_limma` → `volcano_plot` / `cluster_probes`
- Auto-detects array type (450K, EPIC v1, EPIC v2)
- Normalization: openSesame (EPICv2), funnorm (450K/EPIC)
- Local R + Bioconductor engine

### Cross-Layer Analysis
- `correlate_layers`: Pearson, Spearman, overlap enrichment, Jaccard, Fisher exact
- `intersect_layers`: multi-layer boolean AND with field-level filtering
- `query_recipe`: prebuilt cross-layer queries (silencing-prone regions, unusual CGIs, etc.)

### TE Analysis
- `analyze_te_methylation`: beta values → per-family methylation scores + reactivation risk
- `te_platform_coverage`: which TE families covered on each array platform
- `transposome_families` / `transposome_family`: TE family metadata and statistics

---

## V. Upgrade & Scaling Strategy

### Data Updates
- Layer sources (GENCODE, gnomAD, GTEx, ENCODE) release new versions annually
- Update procedure: new ingestion module → staging validation → swap in production
- Content hash comparison (SHA-256) to detect changes vs previous version
- Single-module re-ingestion: `./scripts/ingest_all.sh --module <name>`

### Scaling Path

```bash
# Volume expansion (instant, no downtime)
fly volumes extend <vol_id> -s <new_size_gb>

# CPU/RAM upgrade (brief restart)
fly machine update <machine_id> --vm-size performance-2x

# View logs
fly logs -a polymer-genomics-api

# DB access
fly postgres connect -a polymer-db
```

- **RAM is binding constraint**: Complex cross-layer queries may need shared-cpu-4x / 2 GB
- **Horizontal scaling**: Currently single machine. Multi-machine would require load balancer + shared DB.

### Known Limitations (from source code)

| Limitation | Impact | Planned Fix |
|---|---|---|
| Single static API key | No multi-user support | OAuth2/JWT |
| No error tracking service | Errors only in stdout | Sentry integration |
| No caching layer | All queries hit DB | Redis for reference data |
| Hand-written migrations | No automated rollback | Consider Alembic |
| No per-user rate limiting | Only global concurrency limits | Per-key throttling |

### Build Considerations
- GRCh37 support maintained for legacy probe compatibility (pyliftover)
- New layers should target GRCh38 primary, with liftover to GRCh37 where feasible
- Coordinate conversion is the single point of truth for build mapping

---

## VI. Integration Points

| Integration | Status | Priority |
|---|---|---|
| PyPI SDK (`polymer-genomics`) | Live, v0.3.0 | Maintained |
| MCP Server (44 tools) | Live, stdio | Maintained |
| Bioconductor AnnotationHub | Planned, not submitted | Medium |
| OpenAPI spec (`/docs`) | Live | Maintained |
| Viewer (polymerbio.org) | Live, Vercel | Maintained |

---

## VII. Maintenance Commitment

NAR Database Issue requires 5-year maintenance commitment (stated in manuscript). Infrastructure plan:

- **Fly.io**: Pay-as-you-go, no minimum term
- **Vercel**: Free tier sufficient for current traffic
- **PyPI**: No maintenance cost
- **Data updates**: Annual review of source database versions
- **Monitoring**: Health check endpoint, Fly.io dashboard alerts
