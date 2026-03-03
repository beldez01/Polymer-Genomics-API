# Polymer Genomics — Harness Architecture & Machine-Readable Biology Plan

**Date:** 2026-03-02
**Author:** Zach Belden + Claude
**Status:** Strategic vision — not yet in implementation queue

---

## What This Document Is

This plan emerged from a single architectural insight: the Polymer Genomics API is not just a reference lookup — it is a **physics-based reference expectation engine**. That property makes it uniquely suited to be the data backend for a new class of agentic bioinformatics systems. This document captures the full concept and lays out a concrete development path.

---

## Part I: The Harness Concept

### Background

The AI engineering community has begun distinguishing between two different problems in building useful agents:

1. **Tool exposure** — making capabilities available to a model (MCP, function calling, OpenAPI)
2. **Agent harness** — the structural scaffold that makes an agent *reliable and domain-competent*

The "harness" is everything that is not the model and not the individual tools. It is:

- **Pre-loaded domain context** — what the agent knows before calling any tool
- **Task routing logic** — which tools get called in what order for which classes of problem
- **Execution loop policy** — when to stop, when to retry, when to narrow scope
- **Output contracts** — what shape the agent commits to returning
- **Error recovery patterns** — what to do when results truncate, coordinates mismatch, probes aren't found

A model with access to 8 tools but no harness will make systematic errors in any domain with complex semantics. A model with the same 8 tools plus a well-designed harness becomes a domain expert.

### Current State of the Polymer Stack

The Polymer Genomics API currently has three layers:

```
REST API (FastAPI)          ← data and business logic, 9 routers
    ↓
MCP Server (server.py)      ← protocol adapter, 9 tools exposed to Claude
    ↓
Claude (Claude Code / API)  ← model that can call those tools
```

The MCP server is the **interface layer** — it tells Claude what tools exist and how to call them. What's missing is the **harness layer** between the model and the tools: the structured domain knowledge that makes the agent reason correctly about biology.

Without a harness, a naive agent using the API will:
- Confuse coordinate systems (0-based vs 1-based)
- Misinterpret GRanges `mcols` structure
- Call `query_region` without specifying layers (returns all, slow and noisy)
- Not know what to do with `status: "truncated"` responses
- Miss that `MaterialLayer` physics data represents *reference expectation*, not measurement

With a harness, the agent reasons in the domain: it understands that a beta value is a departure from a physics-predicted state, that departure maps to a MethSig channel, and that the channel assignment requires cross-referencing isochore class, CpG context, and wrapping energy simultaneously.

---

## Part II: The BiologicalEntity Connection

### The Key Insight

The `BiologicalEntity` data object described in `machine-readable-biology.md` and the agent harness are **the same architectural idea at two different levels of abstraction**:

| BiologicalEntity layer | Harness equivalent |
|---|---|
| `MaterialLayer` — reference expectation, always computable from sequence | Pre-loaded context — what the agent knows *before* any query |
| `EpigenomicLayer` — what assays actually measure | Tool call results — what the agent discovers |
| `CellularLayer` — composition, clonal architecture | Assembled context — what the agent constructs across turns |
| `SystemLayer` — ThermAge, MethSig exposures | Output contract — what the agent commits to returning |

The `BiologicalEntity` object defines the **schema of what can be known** about a biological entity. A harness defines the **schema of what an agent knows and how it reasons**. They are isomorphic.

The harness is the **runtime instantiation process** that populates a `BiologicalEntity` from live API queries.

### What Makes the MaterialLayer Unique

Every other genomics API (ENSEMBL, UCSC, Bioconductor annotation packages) serves the same class of data: coordinates and annotations. They tell you what is *there*.

The PolymerGenomics API will be unique when Phase 1–3.5 Polymer Evolution tracks are loaded as layers: it serves **reference expectation**. It tells you what *should be there*, from first principles of polymer physics.

When `query_region` returns L0 stacking energies, L1 CpG densities, L2 wrapping energies, and L3 Green's function correlation lengths alongside CpG annotations, an agent can compute — for any measured beta value — the departure from physics-predicted state. **That departure is the signal. No other API provides this interpretive frame.**

---

## Part III: The MethSig–API Correspondence

### MethSig Channel Space Maps to API Layers

The proposed MethSig channel space (from `machine-readable-biology.md`):

```
CpG location × Genic context × Isochore class × Expression quintile
```

Every dimension is already a registered layer type in the API or a natural join of existing layers:

| MethSig dimension | API layer |
|---|---|
| CpG location (CGI/Shore/Shelf/Open sea) | `cpg_sites` with `context` field |
| Genic context (Promoter/UTR/Gene body) | `gencode_v44` with `feature_type` |
| Isochore class (L1/L2/H1/H2/H3) | `isochores` with `isochore_class` |
| Expression quintile | `methylation` atlas (proxy via cell type) |

The physics channels — stacking energy quintile, wrapping energy quintile, snap competence — are Polymer Evolution L0/L2 tracks. When loaded as layers, `query_region` with `layers="l0_stacking,l2_wrapping,cpg_sites,isochores"` returns everything needed to compute MethSig channel assignments for any probe in a single call.

### The Decomposition Workflow

A harnessed agent performing MethSig decomposition on a probe set:

```
1. batch_probes(probe_ids=[...], build="hg38")
        → coordinates, gene symbols, CpG contexts for all probes

2. For each probe region: query_region(region=±2kb, layers="l0_stacking,l2_wrapping,
                                        l2_occupancy,cpg_sites,isochores")
        → MaterialLayer reference + annotation context

3. Cross-tabulate: probe × [cpg_location, genic_context, isochore_class,
                              stacking_quintile, wrapping_quintile]
        → MethSig channel assignment vector per probe

4. Apply delta_beta matrix (measurement − age-matched reference)
        → Input to NMF decomposition

5. Output: per-sample MethSig signature exposure vector
        → BiologicalEntity.SystemLayer.ProcessSignatureExposures
```

Steps 1–3 are entirely API-driven. Step 4 uses the experimental data. Step 5 is the agent's synthesis output. The harness encodes this sequence so it executes reliably without the user specifying each step.

---

## Part IV: The Full Harness Architecture

### Schematic

```
┌──────────────────────────────────────────────────────────────────┐
│                   BIOINFORMATICS AGENT HARNESS                    │
│                                                                  │
│  Pre-loaded domain context (injected before any tool call):      │
│  • Coordinate system: 1-based, closed intervals                  │
│  • GRanges model: seqnames/ranges/strand/mcols; mcols = metadata │
│  • Status "truncated" → narrow region or add layer filter        │
│  • MaterialLayer = reference expectation (NOT measurement)        │
│  • Delta(measurement, MaterialLayer) = the signal                │
│  • Build default: hg38; use hg37 only for legacy probe sets      │
│                                                                  │
│  Task router (intent → tool sequence):                           │
│  "Annotate probe X"     → lookup_probe → query_region (±2kb)    │
│  "MethSig channel"      → batch_probes → query_region (phys)    │
│  "Gene neighborhood"    → lookup_gene → query_region (gene_model)│
│  "Physics at locus"     → query_region (l0_* + l2_* layers)     │
│  "BiologicalEntity"     → all of the above, assembled in order  │
│                                                                  │
│  Output contracts:                                               │
│  → Structured tables (not narrative), layer-attributed           │
│  → Explicit coordinate provenance (build, 1-based closed)        │
│  → BiologicalEntity partial JSON where applicable               │
└────────────────────────────┬─────────────────────────────────────┘
                             │ tool calls
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                  POLYMER GENOMICS MCP SERVER                      │
│  list_layers / query_region / batch_probes / lookup_gene /       │
│  lookup_probe / get_sequence / aggregate_region / search /        │
│  bulk_download                                                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTP
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                  POLYMER GENOMICS REST API                        │
│                                                                  │
│  Current layers: cpg | gene_model | probe | isochore | methylation│
│                                                                  │
│  Planned layers:                                                 │
│  • l0_gc_content, l0_stacking_dG, l0_melting_temp               │
│  • l0_curvature, l0_periodicity, l0_persistence_length           │
│  • l1_cpg_density, l1_delta_stacking, l1_delta_Lp               │
│  • l2_wrapping_energy, l2_predicted_occupancy, l2_ndr_score      │
│  • l3_correlation_length, l3_perturbation_reach                  │
│  • methsig_atlas (when built)                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Harness Artifact Form

The harness is not a framework or library. It is a **deployable specification** — a text artifact that can take three forms depending on the use context:

| Form | Use case | Location |
|---|---|---|
| Claude Code slash command (`/bioinfo`) | Interactive research sessions in Claude Code | `.claude/commands/bioinfo.md` |
| Agent system prompt (Claude API) | Programmatic agent calls from R/Python | Alongside `mcp/` directory |
| AGENT.md co-deployed with MCP server | Self-contained agent definition for distribution | `mcp/AGENT.md` |

All three forms contain the same core content: domain knowledge, task routing patterns, output contracts, and error recovery logic. The slash command form is the right starting point — it is testable immediately in the current Claude Code session, costs nothing to ship, and generates the empirical feedback needed to refine the routing patterns before formalizing them.

---

## Part V: Development Plan

### Prerequisites (already done)

- [x] Phase 1–3.5 Polymer Evolution: all L0–L3 tracks computed, genome-wide, BigWig + RDS
- [x] Polymer Genomics REST API: 9 routers, GRanges envelope, PostgreSQL + FASTA
- [x] MCP server: 9 tools, stdio transport, Claude Code integration
- [x] MethSig conceptual signatures: A (aging), T (TET2 LOF), D (DNMT3A), I (IDH), S (stochastic), C (composition), F (inflammation), B (batch)
- [x] TET2 project empirical validation: 69 threshold probes, TCGA AUC 0.767, ZCCHC14 + SEMA6B cross-platform

### Step 0: Bioinformatics Harness Slash Command

**What:** Write `.claude/commands/bioinfo.md` — a Claude Code slash command that injects the domain harness context before any genomics task.

**Contents:**
- Coordinate system and GRanges interpretation rules
- Layer semantics (what each layer type means, when to filter)
- Standard task patterns (probe annotation, gene neighborhood, physics query)
- Truncation recovery logic
- Output format contracts (structured tables, not narrative)

**Why first:** This is zero-infrastructure cost, immediately testable in Claude Code sessions, and generates the empirical feedback needed to know which routing patterns actually work before any code is written. Analogous to the `/boris` and `/evo` skills in the Polymer Evolution project.

**Effort:** 2–4 hours.

---

### Step 1: Load Polymer Evolution Tracks as API Layers

**What:** Ingest Phase 1–3.5 BigWig/RDS output into the Polymer Genomics database as registered layers.

**Layer registration:**

```
l0_gc_content          (layer_type: "physics", resolution: 1kb/10kb/100kb)
l0_stacking_dG37       (layer_type: "physics")
l0_melting_temp        (layer_type: "physics")
l0_curvature           (layer_type: "physics")
l0_periodicity         (layer_type: "physics")
l2_wrapping_energy     (layer_type: "physics")
l2_predicted_occupancy (layer_type: "physics")
l2_ndr_score           (layer_type: "physics")
l3_correlation_length  (layer_type: "physics")
l3_perturbation_reach  (layer_type: "physics")
```

**Why this is the critical unlock:** Once these layers are queryable, `query_region` returns MaterialLayer data alongside annotation. The API becomes the reference expectation engine. Every downstream component — MethSig channel assignment, fragmentomics deviation analysis, ThermAge computation — depends on this.

**Schema considerations:**
- Physics tracks are continuous, not feature-based → store as value-per-bin, not GRanges features
- Need a `physics` layer_type in `LAYER_QUERY_MAP` (currently: cpg, gene_model, probe, isochore, methylation)
- Response format: columnar array of `[start, end, value]` triples, can slot into GRanges `mcols`

**Effort:** 2–4 days (ingestion pipeline + schema extension + router update + tests).

---

### Step 2: MethSig Channel Assignment Endpoint

**What:** A new endpoint (or layer query pattern) that, given a list of probe coordinates, returns the full MethSig channel assignment for each — the cross-tabulation of CpG location × genic context × isochore class × physics quintiles.

```
POST /v1/methsig/channels/{build}
Body: { "probe_ids": ["cg06545761", "cg16972240", ...] }

Response: {
  "channels": [
    {
      "probe_id": "cg06545761",
      "cpg_location": "island",
      "genic_context": "3utr",
      "isochore_class": "H2",
      "stacking_quintile": 4,
      "wrapping_quintile": 3,
      "snap_competent": true,
      "channel_id": "CGI:3UTR:H2:Q4:Q3:snap"
    },
    ...
  ]
}
```

**Why this endpoint:** It encapsulates the multi-layer join that an agent would otherwise have to orchestrate across 4–5 separate tool calls. Single call, structured output, MethSig-ready. This is the API surface that makes the harness clean — the agent calls one endpoint and gets the channel assignment, rather than joining results itself.

**Effort:** 1–2 days (after Step 1 physics layers are available).

---

### Step 3: BiologicalEntity Partial Population (Agent Output Contract)

**What:** Define a JSON schema for `BiologicalEntity` partial objects — the structured output the harness agent commits to returning. Not a full S4 class implementation; a JSON schema that captures the layer hierarchy and can be deserialized into a Bioconductor S4 object downstream.

**Schema sketch:**

```json
{
  "entity_id": "sample_TET2_18_001",
  "build": "hg38",
  "material_layer": {
    "resolution_kb": 1,
    "tracks": {
      "l0_gc_content": { "chr16:70699000-70701000": [0.61, 0.63, ...] },
      "l2_wrapping_energy": { "chr16:70699000-70701000": [17.2, 16.8, ...] }
    }
  },
  "epigenomic_layer": {
    "methylation_state": {
      "probes": [
        { "probe_id": "cg06545761", "beta": 0.82, "delta_beta_vs_wt": 0.28,
          "methsig_channel": "CGI:3UTR:H2:Q4:Q3:snap" }
      ]
    }
  },
  "system_layer": {
    "process_signatures": {
      "MethSig-T": 0.31,
      "MethSig-A": 0.44,
      "MethSig-S": 0.12,
      "MethSig-B": 0.08,
      "MethSig-C": 0.05
    }
  }
}
```

**Why define this now:** The output contract is what makes the harness a platform rather than a script. Once the schema is defined, the harness agent can be instructed to always return a `BiologicalEntity` partial, and downstream R/Python code can always parse the same structure regardless of which specific queries were made.

**Effort:** 1 day (schema definition + validation, no new API routes required).

---

### Step 4: MethSig Pilot (NMF Decomposition)

**What:** Apply NMF on Δβ matrices from TCGA pan-cancer 450K data using the channel space defined in Step 2. Use TET2 project signatures (MethSig-T, MethSig-A, MethSig-S, MethSig-B, MethSig-D, MethSig-I) as ground-truth validation anchors.

**Input:** TCGA pan-cancer methylation profiles with known mutations → Δβ relative to age-matched TCGA normals → channel-assigned count matrix.

**Method:** mvNMF (MuSiCal framework, Gusev et al. 2024) on the ~100–200 channel matrix. Target k=6–10 signatures.

**Validation:**
- TET2_mut samples → high MethSig-T exposure
- IDH_mut samples → high MethSig-I exposure (TET2-like pattern, confirmed TCGA 100% cross-classification)
- DNMT3A_mut samples → high MethSig-D exposure (opposite direction, confirmed: 0.697 vs 0.761)
- Healthy aging cohort → MethSig-A dominates
- Batch effects → recover as MethSig-B

**API connection:** Once pilot signatures are defined, load them as a `methsig_atlas` layer. Agents can then query `query_region(layers="methsig_atlas")` to get per-region signature weights — the reference catalog becomes queryable alongside the physics tracks.

**Effort:** 4–8 weeks (TCGA data access, NMF pipeline, validation).

---

### Step 5: Fragmentomics–Polymer Deviation Integration

**What:** Build the deviation analysis pipeline connecting cfDNA fragmentomics (observed nucleosome positions from WPS) to Polymer Evolution L2 predictions (predicted occupancy). This is the core of the ThermAge fragmentomics component.

**The computation:**
```
polymer_deviation_score(region) =
    observed_WPS(region) − predicted_occupancy_L2(region)
```

**Why this is architecturally novel:** No existing liquid biopsy platform has a physics-based reference against which to interpret nucleosome footprints. DELFI, Grail, Guardant compare cfDNA signals to population-average cfDNA. Polymer compares to first-principles predictions from DNA mechanics. The deviation is tissue-specific chromatin alteration, mechanistically attributed.

**API role:** The `query_region` endpoint with `l2_predicted_occupancy` layer provides the reference. Fragmentomics WPS is computed from the cfDNA data itself. The harness agent orchestrates the comparison.

**Dependencies:** Step 1 (L2 layers in API), cfDNA sequencing data (nanopore or Illumina).

**Effort:** 2–4 weeks (pipeline) + cfDNA data acquisition.

---

## Part VI: Sequencing and Priorities

### What to build and when

| Step | What | Dependency | Priority |
|---|---|---|---|
| **0** | Bioinformatics harness slash command | None — works with current API | **Do now** |
| **1** | Load Polymer Evolution tracks as API layers | Phase 1–3.5 data (complete) + deployment | **High** |
| **2** | MethSig channel assignment endpoint | Step 1 | **High** |
| **3** | BiologicalEntity JSON schema | Steps 1–2 | **Medium** |
| **4** | MethSig pilot NMF | Steps 1–2, TCGA data | **Medium** (research) |
| **5** | Fragmentomics–Polymer deviation | Step 1, cfDNA data | **Medium** (research) |

Step 0 costs hours and starts generating empirical feedback immediately. Step 1 is the architectural keystone — nothing downstream works without the physics layers being queryable. Steps 2–5 build on each other linearly.

### What this is NOT

- This is not a rewrite of the existing API. All existing routers, layers, and MCP tools remain unchanged.
- This is not a new framework. The harness is a text artifact + one schema definition.
- This is not dependent on external ML infrastructure. The NMF pilot uses standard R packages (MuSiCal/NMF).
- This does not require new deployment. Step 0 runs in the current Claude Code session. Steps 1–3 extend the existing database schema.

---

## Part VII: The Moat

What makes this architecture defensible:

**1. The MaterialLayer cannot be replicated without Polymer Evolution.** The L0–L3 physics tracks required 4 phases of computation (GC/thermodynamics, methylation perturbation, nucleosome prediction, Green's function). No other group has computed all four layers genome-wide with this parameter set. Loading them into the API creates a reference capability that is years ahead of anything ENSEMBL or UCSC could offer.

**2. The MethSig channel space is Polymer-informed.** If physics quintiles (stacking energy, wrapping energy, snap competence) improve signature resolution — which is testable — then the MethSig catalog will be unreplicable without the Polymer backend. This is the COSMIC equivalent that COSMIC itself could not build because COSMIC has no polymer physics layer.

**3. The harness encodes domain knowledge that took years to develop.** The TET2 project generated empirical knowledge about MethSig-T, MethSig-S, the ZCCHC14/SEMA6B lead probes, the IDH phenocopy, the DNMT3A opposition. This knowledge, encoded in the harness, is not in any paper and cannot be extracted from any existing API. It is only accessible through Polymer.

**4. The BiologicalEntity schema creates a data standard.** If the community adopts `BiologicalEntity` as the container format for multi-modal biological data, the Polymer API becomes the canonical source for the MaterialLayer that every BiologicalEntity object requires. This is the same lock-in dynamic as GRanges — once downstream tools expect GRanges, the tools that produce GRanges become load-bearing infrastructure.

---

## References

- `machine-readable-biology.md` — BiologicalEntity architecture, MethSig atlas, ThermAge, integrated blood test
- `AIMS.md` (TET2 project) — empirical MethSig-T/D/I/S/C/B discovery, ZCCHC14 + SEMA6B validation
- `DOGMA.md`, `EQUATIONS.md` (Polymer Evolution) — physics foundations for MaterialLayer
- Phase 1–3.5 design docs (`docs/plans/2026-02-20-phase1-layer0-design.md`, etc.) — computation details
- `2026-02-27-strategic-dev-plan.md` — current API state and deployment priorities
- `PLATFORM_ROADMAP.md` — Phase 1–2 near-term roadmap (Python client, search, shareable state)
