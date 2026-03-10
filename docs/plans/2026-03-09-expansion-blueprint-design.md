# Polymer Genomics Platform: Expansion Blueprint Design

> **Date:** 2026-03-09
> **Status:** Approved
> **Approach:** Epistemic Schema + Moat Layers Together (Approach C)

---

## Vision

Build the most rigorous, physically grounded, and beautifully designed genomics reference instrument in existence. Polymer Genomics is not "another annotation warehouse." It is the first coherent multi-physics genomics system — where sequence-intrinsic equilibrium physics, constrained covalent state, and actively maintained chromatin are distinct, queryable, epistemically honest layers.

### Platform Soul

The platform is **agent-first**. The API exists to serve AI agents. The REST endpoints serve the frontend and bioinformaticians. The frontend is the discovery scientist's entry point — an instrument so precise and beautiful that it compels them to use the agent for deeper queries.

### Three Users (in priority order)

1. **The AI agent** — reasoning about a locus through MCP tools, composing multi-layer queries that no other API can answer. The primary consumer and the future.
2. **The discovery scientist** — exploring a region's physical personality through the browser, then using the agent for programmatic depth.
3. **The bioinformatician** — running pipelines that need rich, cross-referenced annotation in one API call.

### Design Constraints

- No clinical diagnostic claims (avoid legal/regulatory surface)
- No disease-specific branding (TET2/myeloid is a use case, not the identity)
- Aesthetics are core identity, not cosmetic
- Every layer carries machine-readable epistemic metadata
- H-class layers are protected and rare

---

## Section 1: Epistemic Schema

### 1.1 Primary Evidence Classes

Seven mutually exclusive classes describing the epistemic mode by which an object comes into being:

```sql
CREATE TYPE polymer_evidence_class AS ENUM (
  'M',  -- measured: direct experimental observation, minimal processing
  'R',  -- reference_parameter: published constant, adopted as lookup
  'D',  -- deterministic_transform: reproducible computation, same inputs = same output
  'S',  -- statistical_model: measured data processed through model with assumptions
  'K',  -- curated_knowledge: expert-assembled semantic/ontological object
  'H',  -- hypothesis_driven: theory-led construct, not yet independently validated
  'L'   -- learned_estimate: ML/statistical model output
);
```

Key distinctions that must never be collapsed:
- **D vs S**: a GC content track and a ChromHMM state are not the same kind of object
- **H vs L**: a mechanistic but unvalidated construct is not a black-box learned prediction
- **R as its own class**: imported physical knowledge is neither measured in our pipeline nor inferred by our model

### 1.2 Biological Ontology Fields

These encode the Polymer Evolution layered ontology — the biological soul of the platform:

```sql
tier               ENUM('intrinsic','constrained','active') NOT NULL
-- intrinsic: sequence-determined, equilibrium physics
-- constrained: chemically modified, capacity intrinsic but state maintained
-- active: non-equilibrium steady states requiring continuous free energy flux

equilibrium_regime ENUM('equilibrium','non_equilibrium','mixed') NOT NULL

statefulness       ENUM('reference_static','sample_specific','contextual_predicted') NOT NULL
-- reference_static: same for all humans given same genome build
-- sample_specific: varies by cell type, tissue, or individual
-- contextual_predicted: model-generated for a specific context
```

### 1.3 Provenance Modifiers

Orthogonal to primary class — describe where inputs come from:

```sql
is_composite          BOOLEAN DEFAULT false
source_count          SMALLINT DEFAULT 1
derived_from_classes  polymer_evidence_class[]  -- enum array, not free text
```

### 1.4 Validation Modifiers

```sql
validation_status ENUM(
  'canonical',                -- reference parameters (SantaLucia, Olson)
  'externally_benchmarked',   -- tested against independent gold standard
  'externally_validated',     -- reproduced/confirmed by independent group
  'internally_validated',     -- tested within platform against held-out data
  'partially_validated',      -- some aspects confirmed, others pending
  'unvalidated'               -- no validation performed yet
) NOT NULL

uncertainty_available BOOLEAN DEFAULT false
```

### 1.5 Interpretability

```sql
interpretability ENUM('direct','mechanistic','semi_interpretable','opaque') NOT NULL
```

### 1.6 Context Conditions

The anti-handwaving field. Every D and R layer must specify physical conditions. Every S layer must specify model assumptions.

```sql
context_conditions JSONB
-- Examples:
-- {"temperature":"37C","salt":"1M_NaCl","species":"human","window_size":"1kb"}
-- {"model":"ChromHMM_15state","marks":["H3K4me3","H3K27ac","H3K27me3","H3K9me3","H3K36me3"]}
-- {"alignment":"100way_vertebrate","method":"phyloFit_neutral_model"}
```

### 1.7 H-Class Safeguards

Required when `evidence_class = 'H'`. H should remain rare and feel special.

```sql
hypothesis_banner          BOOLEAN DEFAULT false
falsification_path         TEXT     -- how to disprove this
benchmark_plan             TEXT     -- how to validate this
closest_lower_class_proxy  polymer_evidence_class  -- what class to demote to if it fails
```

### 1.8 L-Class Readiness

Nullable, required when `evidence_class = 'L'`:

```sql
model_family    TEXT   -- e.g. 'HMM', 'deep_neural_network', 'random_forest'
model_version   TEXT
training_domain TEXT   -- e.g. 'human_hg38_1kb', 'pan-vertebrate'
```

### 1.9 Classification of All Existing Layers

| Layer | Class | Tier | Equil | Statefulness | Composite | Derived From | Validation | Interpretability |
|-------|-------|------|-------|-------------|-----------|-------------|------------|-----------------|
| GTEx TPM | M | active | non_eq | reference_static | no | — | ext_validated | direct |
| Histone ChIP peaks | M | active | non_eq | sample_specific | no | — | ext_validated | direct |
| PaxDb abundance | M | active | non_eq | reference_static | no | — | ext_validated | direct |
| SILAC half-lives | M | active | non_eq | reference_static | no | — | ext_validated | direct |
| HPA tissue expr | M | active | non_eq | reference_static | no | — | ext_validated | direct |
| HPA subcellular | M | active | non_eq | reference_static | no | — | ext_validated | direct |
| Salas methylation ref | M | constrained | non_eq | reference_static | no | — | ext_validated | direct |
| SantaLucia NN | R | intrinsic | equilibrium | reference_static | no | — | canonical | direct |
| Olson step params | R | intrinsic | equilibrium | reference_static | no | — | canonical | direct |
| AA properties | R | intrinsic | equilibrium | reference_static | no | — | canonical | direct |
| Physical constants | R | intrinsic | equilibrium | reference_static | no | — | canonical | direct |
| Dinucleotide props | R | intrinsic | equilibrium | reference_static | no | — | canonical | direct |
| GC content | D | intrinsic | equilibrium | reference_static | no | {R} | ext_benchmarked | direct |
| Stacking dG37 | D | intrinsic | equilibrium | reference_static | no | {R} | ext_benchmarked | mechanistic |
| Melting temp | D | intrinsic | equilibrium | reference_static | no | {R} | ext_benchmarked | mechanistic |
| Curvature | D | intrinsic | equilibrium | reference_static | no | {R} | ext_validated | mechanistic |
| Groove width | D | intrinsic | equilibrium | reference_static | no | {R} | ext_validated | mechanistic |
| Dipole density | D | intrinsic | equilibrium | reference_static | no | {R} | int_validated | mechanistic |
| Periodicity | D | intrinsic | equilibrium | reference_static | no | {R} | int_validated | mechanistic |
| Probe crossmap | D | intrinsic | equilibrium | reference_static | no | {M} | int_validated | direct |
| Isochores (GC seg) | D | intrinsic | equilibrium | reference_static | no | {D} | int_validated | mechanistic |
| Gene costs (Akashi) | D | intrinsic | equilibrium | reference_static | yes | {R,M} | ext_validated | mechanistic |
| EWGC | D | active | non_eq | reference_static | yes | {R,M} | int_validated | mechanistic |
| Protein properties | D | intrinsic | equilibrium | reference_static | yes | {M,R} | ext_validated | mechanistic |
| PhyloP / PhastCons | S | intrinsic | equilibrium | reference_static | no | {M} | ext_benchmarked | semi_interpretable |
| ENCODE cCREs | S | active | non_eq | reference_static | yes | {M} | ext_validated | semi_interpretable |
| ChromHMM states | S | active | non_eq | sample_specific | yes | {M} | ext_validated | semi_interpretable |
| gnomAD pLI/LOEUF | S | intrinsic | equilibrium | reference_static | yes | {M} | ext_benchmarked | semi_interpretable |
| RepeatMasker | S | intrinsic | equilibrium | reference_static | no | {M} | ext_validated | semi_interpretable |
| Conservation bins | S | intrinsic | equilibrium | reference_static | no | {M} | int_validated | direct |
| GWAS associations | S | mixed | mixed | reference_static | yes | {M} | ext_validated | semi_interpretable |
| dN/dS | S | intrinsic | equilibrium | reference_static | no | {M} | ext_validated | semi_interpretable |
| Gene profile vectors | S | mixed | mixed | reference_static | yes | {M,D,S} | unvalidated | semi_interpretable |
| Gene anomalies | S | mixed | mixed | reference_static | yes | {S} | unvalidated | semi_interpretable |
| GENCODE genes | K | intrinsic | equilibrium | reference_static | yes | {M,S,K} | ext_benchmarked | direct |
| Reactome pathways | K | active | non_eq | reference_static | no | — | ext_validated | direct |
| MSigDB Hallmark | K | active | non_eq | reference_static | no | — | ext_validated | direct |

---

## Section 2: Layer Priorities and Moat Strategy

Three waves, ordered by what makes Polymer **categorically different**, then **comprehensively useful**, then **conventionally complete**.

### Wave 1: Deepen the Moat

Things nobody else has. These define the platform identity.

| # | Layer | Class | Effort | What It Unlocks |
|---|-------|-------|--------|----------------|
| 1.0 | **Epistemic schema migration** | — | 1-2 days | Foundation for everything. Add evidence_class, tier, modifiers to registry.layers. Classify all existing layers. |
| 1.1 | **SBS Thermodynamic Spectrum** | D | 1 day | 96 COSMIC trinucleotide channels mapped to SantaLucia dG. Lookup table. Reframes mutational signatures as energy perturbations. |
| 1.2 | **Epigenetic clock coefficients** | R | 1 day | Horvath/Hannum/PhenoAge/GrimAge/DunedinPACE probe weights as queryable CpG annotations with cross-platform mapping. |
| 1.3 | **DNAshapeR tracks** (MGW, ProT, Roll, HelT) | D | 3-5 days | 4 shape features at 1kb bins alongside existing thermodynamic tracks. |
| 1.4 | **Per-position mutation dG** | H | 5-7 days | 6 SBS-type tracks: stacking energy perturbation of every possible SNV genome-wide. First "thermodynamic impact of mutation" map. |
| 1.5 | **Melting domain tracks** | H | 5-7 days | Poland-Scheraga stitch profiles. Strand separation propensity genome-wide. |
| 1.6 | **Breakpoint/fragility stack** | K+D+H | 7-10 days | Three-layer stack: catalog (K) + non-B DNA predictions (D) + fragility score (H). |
| 1.7 | **Integrated codon annotation** | D | 3-5 days | Per-codon CSC mapped to genomic coordinates alongside existing CAI/tAI. |
| 1.8 | **Metabolic burden with turnover** | D | 2-3 days | cost x expression x turnover = tissue-specific metabolic burden per gene. |

#### 1.6 Breakpoint/Fragility Stack Detail

**Layer A: Breakpoint Catalog (K)**
- Common fragile sites (~70 characterized: FRAXA, FRA3B, FRA16D, etc.)
- Recurrent translocation breakpoints (COSMIC SV: BCR-ABL, PML-RARA, MLL fusions)
- Constitutional breakpoint hotspots
- Sources: HumCFS database, COSMIC SV, Mitelman Database
- ~500-2000 curated intervals
- `tier = intrinsic`, `statefulness = reference_static`

**Layer B: Non-B DNA Structure Predictions (D)**
- G-quadruplex forming sequences (G4Hunter score, deterministic from sequence)
- Z-DNA propensity (alternating purine-pyrimidine, ZHunt algorithm)
- Cruciform/hairpin-forming inverted repeats (palindrome detection)
- R-loop forming sequences (GC skew, G-clustering on non-template strand)
- Sources: pqsfinder/G4Hunter, ZHunt, custom palindrome scan, Ginno et al.
- Genome-wide at bp resolution, served at 1kb bins
- `tier = intrinsic`, `equilibrium_regime = equilibrium`
- Connects to existing biophysics: high G4 propensity + low stacking energy + high curvature = physically interpretable fragility signature

**Layer C: Fragility Score (H)**
- Composite integrating: non-B DNA propensity, stacking energy landscape, curvature, replication timing, methylation state dependence
- The constrained tier modulates intrinsic tier fragility — direct embodiment of the Polymer Evolution thesis
- H-class safeguards:
  - `hypothesis_banner = true`
  - `falsification_path = "Compare predicted fragility scores against observed breakpoint density in PCAWG whole-genome structural variant calls"`
  - `benchmark_plan = "ROC analysis: fragility score vs PCAWG SV breakpoint enrichment at 10kb resolution"`
  - `closest_lower_class_proxy = 'D'`
- The K layer provides ground truth for benchmarking the H layer

### Wave 2: Strategic Data Depth

Layers that **connect to** the biophysical foundation — give the physics context to interpret.

| # | Layer | Class | Effort | Why Strategic (not commodity) |
|---|-------|-------|--------|------------------------------|
| 2.1 | **Loyfer cell-type methylation atlas** | M | 5-7 days | 39 cell types. Constrained tier data. The atlas_layers table already exists. |
| 2.2 | **ABC enhancer-gene predictions** | S | 3-5 days | 6.3M enhancer-gene links across 131 biosamples. Connects regulatory biophysics to target genes. |
| 2.3 | **JASPAR TF binding profiles** | S | 3-5 days | TF motifs are sequence-intrinsic recognition events interacting directly with the energy surface. |
| 2.4 | **Cross-layer intersection endpoint** | — | 5-7 days | The API feature that makes the moat queryable. |

### Wave 3: Conventional Completeness (Gated)

Each must pass: **does ingesting this serve our three users better than linking out to the source?**

| Layer | Decision Framework |
|-------|-------------------|
| gnomAD v4 variants | Ingest common (AF>0.001) only? Or proxy gnomAD's API and serve a pre-joined biophysical context view? |
| ClinVar | Proxy vs ingest. Small enough to ingest (~500 MB). Value is in cross-referencing with biophysics. |
| GTEx eQTLs | High value but massive volume. Consider: ingest significant eQTLs only (p < 1e-5). |
| Hi-C TADs/compartments | Ingest — connects to Polymer Evolution Phase 3.5 (correlation length, mechanical connectivity). |
| AlphaMissense | L-class. Available elsewhere. Proxy candidate unless cross-layer queries demand local data. |

---

## Section 3: API & MCP Expansion

### 3.1 Cross-Layer Intersection Queries

The killer feature. No genomics API offers this.

```
POST /v1/query/intersect
{
  "build": "hg38",
  "region": "chr16:70000000-71000000",
  "filters": [
    {"layer": "biophysics", "field": "stacking_dG37", "op": "<", "value": -1.8},
    {"layer": "cpg_islands", "op": "overlaps"},
    {"layer": "conservation", "field": "phylop_mean", "op": ">", "value": 2.0}
  ],
  "return_layers": ["encode_ccre_v4", "gencode_v44"]
}
```

Returns regions satisfying ALL filters, annotated with requested layers. Server-side GiST intersection across partitioned tables. MCP tool: `intersect_layers`.

### 3.2 Statistical Summary Endpoint

```
GET /v1/regions/{build}/{region}/summary?layers=biophysics,conservation
```

Returns: mean, median, sd, min, max, quantiles (5th/25th/75th/95th) per track. Agents characterize a region's physical personality without fetching every row.

### 3.3 MCP Structured Output

Every tool declares its output schema via MCP `structuredContent` (spec 2025-06-18). Every response includes epistemic metadata in `layers_resolved`:

```json
{
  "layers_resolved": [
    {
      "layer_key": "biophysics_l0",
      "evidence_class": "D",
      "tier": "intrinsic",
      "validation_status": "externally_benchmarked",
      "context_conditions": {"temperature": "37C", "salt": "1M_NaCl"}
    }
  ]
}
```

### 3.4 Epistemic Filtering

New parameter on `query_region` and `list_layers`:

```
list_layers(evidence_class=["M","D"], tier="intrinsic")
query_region(region="chr16:70699000-70700000", min_validation="internally_validated")
```

Agents constrain reasoning to layers of a given epistemic quality. Unique — no other genomics API supports this.

### 3.5 Comparative Queries

```
GET /v1/compare?build=hg38&region_a=chr16:70699000-70700000&region_b=chr17:7668421-7687490&layers=biophysics
```

Side-by-side summary statistics for two regions.

### 3.6 Deferred

- **GraphQL** — REST with `fields=` gives 80% of benefit. Revisit only if agent patterns demand it.
- **Beacon v2** — valuable for interoperability but not agent-first. Phase 4+.
- **Refget v2** — trivial but low priority. Add when GA4GH compliance becomes strategic.
- **VEP proxy** — don't reimplement. Agents can call Ensembl directly. Consider thin cache later.

---

## Section 4: UI/UX

### 4.1 Design Principles

- **Metrology-grade aesthetic** — dark mode, high contrast, information-dense. Think oscilloscope, not dashboard.
- **Physics-first visual language** — biophysical tracks look like energy surfaces, not generic bar charts. Color encodes meaning (teal/amber/violet layer coding).
- **Progressive disclosure** — chromosome → region → base-pair, semantic zoom revealing detail.
- **The browser sells the API** — every track makes the scientist think "I want to query this programmatically."

### 4.2 Priority Features

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 4.1 | **SVG/PNG export with figure legend** | LOW | HIGH — one-click publication-quality export with auto-generated legend, coordinates, sources, evidence classes |
| 4.2 | **Linked table-browser cross-selection** | LOW | HIGH — click probe in table → browser navigates; lasso region → table filters. Bidirectional event dispatch. |
| 4.3 | **Evidence class badges** | LOW | HIGH — every track label shows M/R/D/S/K/H/L badge. H-class tracks get dashed border / hypothesis icon. |
| 4.4 | **Multi-sample methylation heatmap track** | MODERATE | HIGH — cell-type × CpG beta heatmap. Visual signature of constrained tier. |
| 4.5 | **Semantic zoom** | MODERATE | MEDIUM — auto-select 1kb/10kb/100kb resolution. Aggregate → individual → sequence context. |
| 4.6 | **Natural language search** (capstone) | HIGH | VERY HIGH — "conserved CpG islands with low stacking energy near TET2" → browser navigation + filters. MCP infrastructure exists. LLM orchestration layer needed. |

### 4.3 Deferred

- 3D chromatin visualization — tangential to core experience
- Circos/chord diagrams — publication tool, not primary browser
- Mobile/responsive — desktop scientific instrument
- Collaborative features — premature without auth

---

## Section 5: Infrastructure

### 5.1 RAM Strategy

| Phase | Config | Trigger |
|-------|--------|---------|
| Current | shared-cpu-2x / 1 GB | — |
| Pre-Wave 2 | shared-cpu-4x / 2 GB | Loyfer atlas ingestion |
| Pre-Wave 3 (if gnomAD) | Evaluate dedicated-cpu / 4 GB | Variant table creation |

### 5.2 Disk Strategy

| Phase | Volume | Projected Usage |
|-------|--------|----------------|
| Wave 1 complete | 20 GB (current) | ~16-17 GB |
| Pre-Wave 2 | Extend to 40 GB | ~25-30 GB |
| Pre-Wave 3 | Extend to 60 GB | ~45-55 GB |

Volume expansion is instant on Fly.io — no downtime.

### 5.3 Architectural Invariants for New Layers

- HASH(4) sub-partitions for tables >100K rows
- GiST index on `(chr_id, coord)` for range queries
- New biophysics tracks share `biophysics.sequence_properties` partitioning (same 1kb windows, same chromosome structure)
- **Every new continuous track served at three resolutions from ingestion**: 1kb, 10kb, 100kb bins
- Pre-computed aggregations as architectural invariant, not optimization

### 5.4 Caching

- **Application**: LRU cache for frequently queried genes (TP53, BRCA1, TET2)
- **HTTP**: `Cache-Control: public, max-age=86400` for reference data
- **CDN**: S3/CloudFront with range-request support for BigWig files

---

## Section 6: Validation Framework

Validation is a peer of ingestion, not an afterthought.

### 6.1 Structure

```
src/polymer_genomics/
  ingest/
    biophysics_tracks.py
    conservation.py
    ...
  validation/
    biophysics_tracks_validate.py
    conservation_validate.py
    ...
```

### 6.2 Validation Protocols by Evidence Class

**M-class (measured):**
- Row count sanity (expected vs actual)
- Coordinate range validation (within chromosome bounds)
- Distribution sanity (no negative TPM, betas in [0,1])
- Cross-reference spot checks (100 random values vs source)
- Null/NA accounting (explicit, never silent)

**R-class (reference parameters):**
- Exact match against published tables (byte-level where possible)
- Citation verification (every parameter traceable to DOI)
- Unit consistency check

**D-class (deterministic transforms):**
- Reproducibility: recompute 3 random chromosomes from scratch, must be bit-identical
- Boundary conditions (telomeres, centromeres, N-gaps)
- Known-answer tests at well-characterized loci (TP53, BRCA1) vs published measurements

**S-class (statistical models):**
- Source version pinning (gnomAD v4.1, not "gnomAD")
- Model assumption documentation
- Distribution comparison vs source (KS test on random sample)

**H-class (hypothesis-driven):**
- Falsification test suite: `falsification_path` field points to actual test script
- Benchmark against ground truth (e.g., fragility score vs PCAWG breakpoint density, ROC/AUC)
- Sensitivity analysis: score change with +/-10% parameter perturbation
- Comparison to `closest_lower_class_proxy`: how much does H add over D alone?

**K-class (curated knowledge):**
- Version tracking (Reactome v85, not "Reactome")
- Coverage reporting (fraction of genes with annotations)
- Cross-reference validation (symbols match GENCODE)

### 6.3 Validation Reporting

Every validation run produces a structured, queryable report:

```json
{
  "layer_key": "biophysics_l0_stacking",
  "validation_date": "2026-03-15",
  "evidence_class": "D",
  "checks": [
    {"name": "reproducibility_chr22", "status": "pass", "detail": "bit-identical"},
    {"name": "boundary_telomere", "status": "pass"},
    {"name": "known_answer_TP53", "status": "pass", "expected": -1.42, "actual": -1.42}
  ],
  "overall": "pass",
  "next_validation_due": "2026-06-15"
}
```

### 6.4 Continuous Validation

- **On ingestion**: validation runs automatically. Ingestion fails if validation fails.
- **On schedule**: quarterly re-validation against source checksums.
- **On upgrade**: when a source updates (GTEx v10 → v11), validation runs before layer promotion.

---

## Implementation Sequence

### Wave 1: Deepen the Moat (~6-8 weeks)

**Phase 1A: Epistemic Foundation (Week 1)**
1. Epistemic schema migration (registry.layers extension)
2. Classify all existing layers
3. Update API response envelope to include epistemic metadata
4. Update MCP tool responses

**Phase 1B: Quick Moat Wins (Weeks 2-3)**
5. SBS Thermodynamic Spectrum (D, 1 day)
6. Epigenetic clock coefficients (R, 1 day)
7. Metabolic burden with turnover (D, 2-3 days)
8. Integrated codon annotation (D, 3-5 days)

**Phase 1C: Biophysical Depth (Weeks 4-5)**
9. DNAshapeR tracks — MGW, ProT, Roll, HelT (D, 3-5 days)
10. Melting domain tracks (H, 5-7 days)

**Phase 1D: Mutation Physics + Fragility (Weeks 6-8)**
11. Per-position mutation dG tracks (H, 5-7 days)
12. Breakpoint catalog (K, 2-3 days)
13. Non-B DNA structure predictions (D, 3-5 days)
14. Fragility score (H, 3-5 days)

**Phase 1E: Validation (Parallel with 1B-1D)**
15. Validation framework scaffold
16. Validation scripts for all new layers
17. Validation scripts for existing layers (retrofit)

### Wave 2: Strategic Depth (~4-6 weeks)

**Phase 2A: Data (Weeks 9-12)**
18. Loyfer cell-type methylation atlas (M)
19. ABC enhancer-gene predictions (S)
20. JASPAR TF binding profiles (S)

**Phase 2B: API Power (Weeks 11-14)**
21. Cross-layer intersection endpoint + MCP tool
22. Statistical summary endpoint
23. Comparative query endpoint
24. Epistemic filtering in MCP

**Phase 2C: UI (Parallel with 2A-2B)**
25. Evidence class badges on all tracks
26. SVG/PNG export with figure legend
27. Linked table-browser cross-selection
28. Multi-sample methylation heatmap track

**Infrastructure:** Upgrade to 2 GB RAM, extend volume to 40 GB before Phase 2A.

### Wave 3: Selective Completeness (~4-6 weeks, gated)

**Phase 3A: Ingest vs Proxy Decisions**
29. Evaluate each commodity layer against the gate: ingest vs proxy vs link
30. gnomAD common variants (if ingest)
31. ClinVar (if ingest)
32. Hi-C TADs/compartments (ingest — connects to Polymer Evolution)

**Phase 3B: UI Capstone**
33. Semantic zoom
34. Natural language search bar

**Infrastructure:** Evaluate 4 GB RAM, extend volume to 60 GB if needed.
