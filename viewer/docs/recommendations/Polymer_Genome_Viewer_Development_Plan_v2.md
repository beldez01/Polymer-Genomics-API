# POLYMER BIO

## Genome Viewer — Product Development Plan

**Version:** 2.0 | **Date:** 12 November 2026 | **Status:** Proposed, pending codebase verification

---

# Development mandate

**Scope:** Polymer Genome Viewer and its immediate handoffs into the existing Polymer ecosystem.  
**Basis:** User-supplied *Polymer Genome Viewer — Comprehensive Multi-Angle Audit* and publicly accessible Polymer site/documentation. Interactive behavior and source code were **not** comprehensively tested.

## Executive summary and guiding decision

The direction is sound, but the original proposal confuses proposed and extant features, under-specifies scientific semantics, and prioritizes breadth before reproducibility. Build a **genomic context → interpretable sequence physics → reproducible selection → downstream evaluation/design** workbench, not a generic feature-maximal genome browser.

**Recommended releases:** R0 establish truth and correctness; R1 deliver a polished, trustworthy viewer; R2 make interval selection and cross-tool handoffs work; R3 add assay-risk and specialized research functionality. A future backlog holds heavier imports, new assemblies, and claims/AI overlays. The numbered implementation slices in Section 10 are dependency groups rather than committed calendar dates.

**Three non-negotiables:**
1. No ambiguous genomic positions, coordinate conversions, or reference alleles.
2. No biophysical visualization without measurement units, window/method semantics, evidence class, and version.
3. No handoff that silently changes assemblies, strand, source sequence, transcript, or analysis assumptions.

## Product goals and non-goals

**North-star workflow:** Find a genomic locus → understand its annotation and physical properties → select a precisely defined interval → evaluate or design against it → return to an identical, shareable research context.

**Success is defined by:** correctness of reference/strand/coordinates, clarity of quantitative interpretations, reliable cross-tool handoffs, and repeatable exports. Feature count is not a success metric.

**Not in this release:** replacing IGV read review, becoming a clinical variant reporting system, implementing a complete RNA-folding environment, or supporting every genome assembly.

## Delivery policy and release gates

| Gate | Required evidence | Ship decision |
|---|---|---|
| G0 — Reality verified | Live-route screenshots, existing-feature matrix, source dataset inventory, reproducible defect tickets | Do not duplicate features based on HTML/marketing alone |
| G1 — Scientific foundations | Coordinate conversion fixtures, reference sequence comparisons, layer metadata and missing-data semantics | No scientific view or export can silently misstate a locus |
| G2 — Viewer reliability | Deep-link round trips, zoom/cursor fidelity, no stale tiles, tested exports | Users can navigate and reproduce a view |
| G3 — Workflow integration | Typed selection contract plus end-to-end Evaluate/Builder/Transposome parity tests | Tool handoffs preserve scientific context |
| G4 — Specialist expansion | Explicit method, provenance, performance and privacy review for each new data type | Advanced features ship only when defensible |

## 1. What is observed, what remains unknown

### Publicly observable on Polymer

The published viewer HTML exposes hg38/hg37 controls; region/gene/probe search; pan, zoom, 1k/10k/100k/1M presets; Share; PNG; keyboard hints (arrows, +/- and `i`); a region context panel; and multiple annotation/biophysics track labels. The documentation advertises a REST API, Python SDK, MCP, layer metadata, `evaluate`, and aggregation. The site advertises an RNA Construct Builder, Transposome, and Claims Universe.

**These observations are not proof of working behavior.** The HTML snapshot showed a default chromosome context despite a locus-specific path; verify client-side initialization/hydration, deep links, and tiles in a browser before opening duplicate implementation tickets.

### Immediate audit tickets (before feature coding)

- **A01:** Establish feature inventory with status `implemented / partial / broken / absent`, owner, route, data source, and test case.
- **A02:** Test direct opening, reload, browser back/forward, and copy/paste of deep links. Confirm path/query coordinates actually hydrate correctly.
- **A03:** Test every currently advertised track at three scales, both assemblies, plus unavailable-layer and sparse-data cases.
- **A04:** Verify Share reproduces relevant view state; verify PNG export quality, labels, and deterministic output.
- **A05:** Inventory whether claims, TE, methylation, and score presentations contain live production records, representative examples, or placeholders. Label demonstration data clearly wherever used.
- **A06:** Reconcile published layer counts, dataset versions, model descriptions, and REST/MCP/SDK contracts. Do not infer correctness from marketing pages.

## 2. Product boundary and primary workflow

### Product definition

**Polymer Viewer is the reference-coordinate workspace in which a user can inspect a locus, compare genomic/biophysical context, select a reproducible sequence or transcript interval, and move it into a validated downstream action without losing provenance.**

Do not try to replace full-scale IGV read inspection, UCSC's entire track universe, clinical variant interpretation software, or an RNA folding suite in the first release. Link out or import data where necessary.

### Prioritized use cases

1. **Sequence/construct researcher:** Find target → inspect genes, repeats, sequence physics and predicted structural motifs → select interval → Evaluate/Builder → revisit locus.
2. **Molecular pathologist:** Search gene/variant → inspect MANE transcript and exon/CDS/splice context → understand pseudogene/low-mappability risk → export precise annotated interval. Present as research-use-only; no implied clinical validation.
3. **Methylation/repeat researcher:** Inspect CpG sites, probes, RepeatMasker and sample/atlas methylation distinctly → follow to Transposome/TE-methylation analysis.
4. **Computational researcher:** Reproduce viewport in URL, BED/FASTA/API code, with stable build, versions and parameters.

The viewer should optimize **task completion and trust**, not count of tracks shown.

## 3. Scientific and data correctness specification (P0)

### 3.1 Canonical coordinate model

Use internal **0-based, half-open** intervals `[start0, end0)` and normalized sequence-contig identifiers; provide UI **1-based inclusive** genomic labels explicitly. Define conversions at all boundaries, including BED, VCF, HGVS, Python, transcript coordinates, and API inputs. The public REST docs currently describe 1-based closed UCSC regions; adapters must preserve that contract unless deliberately versioned.

Every selected object should carry:

```json
{
  "assembly": "GRCh38",
  "reference_accession": "NC_000017.11",
  "chrom": "chr17",
  "start0": 7668420,
  "end0": 7668520,
  "strand": "+",
  "coordinate_system": "0-based-half-open",
  "source": "viewer-selection",
  "reference_sequence_sha256": "<calculated-on-selection>",
  "annotation_versions": {"gencode": "v44"},
  "selected_transcript": null
}
```

The example is an illustrative schema, not an assertion about an actual reference sequence. Keep a documented contig alias table (`chr1` vs `1`; mitochondrial naming) and exact assembly FASTA / accession versions.

**Tests:** 1-bp intervals, chromosome ends, reverse-strand exons, junctions, insertions, symbolic alleles, contig aliases, and zero/one-index boundaries; round-trip conversions with golden fixtures.

### 3.2 Track metadata contract

Every layer must declare: stable ID; label; type (`interval`, `quantitative`, `categorical`, `sequence`, `transcript`, `sample-matrix`); assembly availability; source and license; dataset version and checksum; evidence class; units; window size; aggregation function; strand; missing-data semantics; coordinate convention; method/reference; and allowed zoom/resolution.

Separate **reference annotations, measured sample data, derived sequence models, and statistical predictions** visually and linguistically. A curated probe location is not a measured sample beta value; a predicted G4 motif is not experimentally observed G4 formation. A score is not a clinical risk probability absent calibration.

### 3.3 Biophysical validity

**Reject the original universal `±2 SD genome-wide` anomaly concept.** Many sequence-derived properties have non-Gaussian and highly context-dependent distributions; global scores are affected by GC, window length, mappability, repetitive content, dinucleotide composition, strand and model definition. Different tracks are not necessarily independent.

Replace with a **contextual reference comparison**:
- Default: show raw values with units and window/method definitions; avoid universal anomaly labels.
- Optional advanced mode: show percentile relative to an explicitly named reference distribution matched, where scientifically justified, on window length, GC range, sequence composition and/or genomic compartment.
- Reference distribution must have a version, sample size, method, and missing-data treatment.
- Explain the directionality of a metric (e.g. stacking free energy convention; more-negative values do not automatically equal a clinical phenotype).
- Use shading only when the feature is empirically or mechanistically justified; label as **relative sequence feature**, not abnormality.
- If no defensible reference set exists, show the curve without an anomaly score.

Audit per-base versus per-window labels. A full duplex melting temperature is **not** a local base-pair intrinsic property; annotate salt, concentration, window length, and approximation. For curvature, groove width, A/Z propensity and other model outputs, link to algorithms and limitations. Avoid readouts that mix units or imply unsupported precision.

### 3.4 Assembly/liftover discipline

Keep a prominent assembly badge. Switching assembly should distinguish **preserve locus identity**, **lift position**, and **navigate to matching gene**. Liftover must return zero/one/multiple mappings with coverage, orientation, and chain version. Never silently substitute the nearest match. If an interval splits, maps ambiguously, or changes reference sequence, prompt clearly and retain the original locus. T2T-CHM13 is a **future separate ingestion project**, not a toolbar-only checkbox.

## 4. Viewer interactions and visual architecture

### 4.1 Semantic zoom (P0/P1)

Use a resolution-aware display contract, not simply swap hardcoded thresholds:

| Approximate viewport | Primary visual language | Required behavior |
|---|---|---|
| >1 Mb | Aggregated gene density, GC/isochore bands, repeat/CpG summaries | Density denominators and bin sizes exposed; avoid drawing millions of glyphs |
| 10 kb–1 Mb | Gene/transcript models, repeats, islands, probes, smoothed quantitative tracks | Aggregate intelligently; expose overlapping elements and declutter |
| 200 bp–10 kb | Exons, splice sites, detailed probes/repeats, sequence-based curves | Accurate strand and transcript labeling; adaptive axis ticks |
| ≤200 bp | Bases, coding frame conditional on chosen transcript, CpG dinucleotides, sequence physics | Bases exactly match reference FASTA; no generic translation outside coding transcript |

Thresholds are initial hypotheses. Determine by screen pixels, feature density, and browser performance; allow stable transitions without jumping between biological interpretations. If a high-resolution tile is unavailable, show an explicit reason rather than fabricate base-level resolution.

### 4.2 Track controls (P1)

- Curated presets: **Sequence Physics**, **Clinical Context**, **Methylation & Repeats**, **RNA Design**.
- Compact track legend with units, evidence tags and source/provenance popovers.
- Synchronized cursor or pinned probe line with exact locus and sampled values; use `n/a` for absent coverage and show bin/window of reported statistic.
- Distinguish temporary hover from click-to-pin measurements; keyboard and accessible alternatives required.
- Restore selected layers/ordering after navigation; provide one-click reset.

### 4.3 MANE and transcripts (P1)

Add MANE Select / Plus Clinical **as curated prioritization metadata**, not as an unsupported claim that all genes have a MANE transcript or that a single transcript is always clinically appropriate. Show transcript accession **with version**, transcript source, strand and chosen genomic assembly; allow all GENCODE / RefSeq transcripts. Keep HGVS coding coordinates separate from genomic labels; provide exon/intron, CDS, UTR, start/stop and splice context only when annotations support them. Beware noncanonical splice sites: do not assume every junction is GT–AG.

### 4.4 Spliced transcript mode (P2)

Build as an **alternate coordinate projection** (not an in-place trick where a genomic axis silently changes). Persist transcript ID + version and show junction markers. Implement bidirectional mapping transcript↔genome, minus strand, multi-exon intervals, UTR/CDS frame, and isoform changes. Genome-wide tracks that cannot be mapped meaningfully to transcript positions must be labeled or hidden. Mature RNA folding/SHAPE data are distinct features and require separate sources or models.

## 5. Workflow handoffs and reproducibility (P1)

### 5.1 Selection as a first-class object

Drag-to-select should display selected assembly, precise interval, bp length, strand, and source sequence status; offer `Copy genomic coordinates`, `Copy BED`, `Copy FASTA`, `Evaluate`, `Open Transposome`, and `Open RNA Builder` only where suitable. Ensure keyboard-based and touch alternatives. Do not automatically assume a genomic region is equivalent to a mature RNA sequence.

**Handoff rules:**
- `Evaluate` receives explicit **DNA sequence**, selection source, version and parameters; clearly distinguish from current genome atlas track values if models differ.
- `RNA Builder` requires target RNA semantics: selected transcript or genomic sense/antisense orientation, U/T conversion, splicing and strand, and explicit user confirmation for ambiguous cases.
- `Transposome` receives genomic interval + assembly; check that repeat layer supports this build.
- Include an immutable or stable shareable analysis reference (hash, record or serializable state) to support return navigation. A hash proves identity, not scientific correctness.

### 5.2 Shareable state (P0)

Use a canonical, versioned URL schema for assembly, interval, selected transcript, track IDs/order, zoom, highlights, and optional comparison state. Do not embed patient data, API credentials, uploaded records or private identifiers in public links. Use state schema version, length limits, migration and safe fallbacks; extremely large state should use optional server-side saved snapshots with access control. Tests must cover refresh, back/forward, private-tab opening and removed track versions.

### 5.3 Code and export (P1)

Offer one-click `Copy curl`, `Copy Python` and `Copy R` **using validated, documented endpoints**, not a synthetic MCP invocation. MCP may be represented as a named tool call only where the deployed tool signature matches. Include build, region, layer IDs, version pin and any requested aggregation resolution. Provide SVG/PNG export with scale, font size, DPI or pixel dimensions, legend, date, data versions and citation text; validate exported diagrams against the viewport.

### 5.4 Session tray (P1)

Start with 3–5 pinned loci saved locally per browser, including assembly, selected transcript and track preset. Explicitly distinguish unsaved browser state from shared persistent workspaces. No account/server project database needed initially.

## 6. Assay risk and contextual overlays (P1/P2)

### Mappability / pseudogene track

Prioritize because it adds meaningful assay-design context. But specify **read length, aligner/reference, k-mer size and mismatch policy** for mapping-based metrics. A global "low mappability" glyph without method is inadequate. Short-read uniqueness does not equal oligonucleotide off-target specificity. Extend later with probe/oligo similarity searches across the genome using construct-length and mismatch/thermodynamic assumptions.

### CpG, repeats and methylation

Display separately:
1. Reference CpG genomic positions and CpG islands;
2. EPIC/450K probe locations and manifest/overlap/cross-mapping warnings;
3. RepeatMasker element interval, family and subfamily;
4. Measured beta values only when dataset, tissue/cell type, assay, sample aggregation and missingness are known.

A probe overlapping a TE does not establish the methylation state of the TE; family-level summary is not a locus-resolved measurement. Introduce a clearly defined join policy and explain multihit probes and repeat-boundary overlap.

### Claims Universe overlay

Defer until claims have validated genomic anchors, source/license, evidence type, timestamp, entity resolution, and confidence semantics. Show density/cluster markers at wide zoom and individual anchors when zoomed in. Claims must not be presented as equivalent to clinical assertions.

## 7. Custom track import (P2)

Avoid promising "zero-server" for all four formats in one release:

| Format | First release approach | Key complication |
|---|---|---|
| BED | Local parse, coordinate validation, render and error summary | Assembly metadata commonly absent; 0-based intervals |
| VCF | Local parse small VCF / compressed file where supported | 1-based POS, normalization, reference allele, complex alleles |
| BigWig | Indexed URL or local-file access depending on browser support | Range/byte access, CORS, aggregation and memory |
| BAM/CRAM | Defer; optionally connect existing IGV.js rather than build renderer | Index requirement, ref FASTA for CRAM, heavy reads and memory |

Browser-local processing can reduce data upload but is **not automatically zero privacy risk**: analytics, crash logs, remote fetches, third-party scripts, state persistence and export may still expose metadata. Require explicit private-data mode, local-only processing checks, security review and clear UI disclosure before making enterprise/clinical privacy claims.

## 8. Engineering architecture and contracts

### Recommended stack-neutral services

- **Viewer State Controller:** URL↔state serialization, schema migration, navigation, focused selection.
- **Coordinate/Reference Service:** contig alias normalization; genome and transcript mapping; reference sequence retrieval; liftover with ambiguity handling.
- **Layer Registry:** authoritative metadata, compatible builds, min/max zoom, units, licensing, evidence and checksum.
- **Tile/Data Adapter:** quantitative bins and feature tiles, caching, cancellation, request coalescing; distinguish cache identities by assembly, source data version, bin width and track parameters.
- **Track Renderers:** shared axis, lanes, annotations, quantitative plots and density bins with pixel-density-aware rendering.
- **Selection/Handoff Service:** typed payloads into Evaluate/Builder/Transposome.
- **Export/Provenance Service:** reproducible code, FASTA/BED, image and manifest generation.

Keep UI-state logic independent of track painting. Centralize coordinate conversion rather than scattering `+1`/`-1` throughout event handlers.

### Response semantics

Each rendered tile or compute response must express `ok | empty | unsupported | not_loaded | error` distinctly. Make missing values distinct from zero and from values below threshold. Cache correctness matters more than optimistic latency; never serve a prior assembly or adjacent-locus tile because of underspecified cache keys.

## 9. Performance and quality bars

**Proposed targets, to be baseline-calibrated rather than claimed as achieved:**

- P95 first meaningful track rendering ≤2 s on reference mid-range laptop/broadband for common loci after a warm cache; measure separately for cold cache.
- P95 pan/zoom visual feedback ≤100 ms and responsive input while requests continue.
- No visually stale data after rapid panning, changing assembly or changing track filters.
- A configured ~10 active tracks remains usable at 100 kb; large-viewport density bins do not block main thread.
- 100% pass of golden-fixture coordinate/sequence tests across both currently supported assemblies.
- Direct-link state round-trip: same locus, assembly, selected transcript, tracks and ordering after reload.
- Exports include coordinates, track source, reference/annotation version, and sufficient legend/context to interpret figure.

Instrument tiles fetched, errors, download bytes, cache hit rate, render duration, viewport transition latency, long tasks and user task completion. Compare to actual baseline before picking fixed speed claims.

## 10. Implementation backlog

| ID | Priority | Workstream | Deliverable | Dependency | Acceptance |
|---|---|---|---|---|---|
| A01–A06 | P0 | Reality check | Feature inventory; live browser tests; dataset/docs reconciliation | None | All current promises classified and reproducible |
| C01 | P0 | Coordinates | Typed interval and conversion library | A01 | Golden fixtures and roundtrips pass |
| C02 | P0 | Metadata | Layer registry + units/provenance and availability | A03 | 100% visible layers declare required fields |
| U01 | P0 | Navigation | Canonical deep link and state restoration | C01 | Reload/back/private-tab fixtures pass |
| U02 | P0 | Scientific display | Resolution-specific tile/metric semantics | C02 | No false base-level precision or silent normalization |
| U03 | P1 | Visual UX | Semantic zoom, track presets, pinned cursor | U02 | Clear navigation across 4 zoom bands |
| W01 | P1 | Workflow | Typed interval selection, FASTA/BED export | C01 | Exact sequence, strand, build in output |
| W02 | P1 | Integration | Evaluate/Transposome/Builder handoffs | W01 | Payload parity and return navigation pass |
| T01 | P1 | Clinical | MANE annotation and transcript orientation | C01/C02 | Versioned transcripts; minus strand cases pass |
| T02 | P1 | Assay risk | Mappability + pseudogene context | C02 | Method/read-length assumptions visible |
| U04 | P1 | Sharing | Polished SVG/PNG and code exports | U01/C02 | Reproducible outputs with provenance |
| U05 | P1 | Workspace | Local pinned-loci tray | U01 | Tracks and loci persist predictably |
| S01 | P1 | Statistics | Scientifically defensible comparative sequence physics | C02/U02 | Matched background or raw-only fallback |
| T03 | P2 | RNA | Spliced transcript projection | T01 | Exon junction + reverse-strand mapping validated |
| X01 | P2 | Imports | BED, then VCF, then BigWig | C01/C02 | Invalid input and mismatch handled safely |
| X02 | P2 | Reads | BAM/CRAM via mature component | X01 | Indexed, assembly-matched tested files |
| E01 | P2 | Claims | Evidence provenance overlay | C02 | Anchors are real, traceable, and nonmisleading |
| A07 | P2 | Assembly | CHM13 ingestion and annotation parity | C01/C02 | Explicit coverage and cross-build mapping |

### Suggested implementation slices

**Slice 0 — Reliability and factual inventory:** A01–A06, C01, C02. Ship measurable fixes to current deep links and layer correctness.  
**Slice 1 — Excellent genomic exploration:** U01–U03, U05, T01 and a tested image export.  
**Slice 2 — Polymer-specific value:** W01, W02, S01 and carefully scoped assay-risk T02.  
**Slice 3 — Advanced scientific workflows:** T03, X01, evidence integrations; add BAM/CRAM and T2T only after demand and service readiness are established.

These are dependency slices, **not calendar estimates**. Schedule after codebase inspection and baseline instrumentation.

## 11. Definition of done for every feature

Each ticket must provide: user story; screenshots/wireframe where useful; assembly and coordinate behavior; input/output schema; sources and licenses; failure and missing-data behavior; accessibility/keyboard behavior; instrumentation; unit+integration tests; and user-facing documentation. A feature is not complete solely because it renders a track.

### Five end-to-end release tests

1. **TP53 navigation:** direct link → reload → choose MANE transcript → inspect exon boundary → copy BED and FASTA → verify against reference FASTA.
2. **Reverse-strand RNA target:** open minus-strand gene → choose transcript → select exon-junction interval → Builder receives expected transcript-oriented RNA sequence; no genomic/spliced conflation.
3. **TE methylation:** select L1 interval → examine CpGs, EPIC v2 probe mapping, repeat overlap and measured atlas sample context → hand off with explicit layer provenance.
4. **Assembly conversion:** move a locus hg38↔hg37 → report ambiguous/unmapped/split cases → retain original and avoid hidden coordinate jumps.
5. **Reproducibility:** export a region as URL, Python snippet, SVG and manifest → verify identical build, interval, versions, visible tracks and quantitative definitions.

## 12. Measurement of success

Track **research tasks**, not just session counts:
- Median time to reach desired gene/transcript and recognize correct assembly.
- Fraction of selected intervals exported correctly or opened in downstream tools.
- Handoff completion/return rate by destination.
- Fraction of users able to explain each biophysical graph's units, reference, and limitations.
- Deep-link reproducibility rate and unresolved/mismatched dataset error rate.
- Repeat usage of pinned-locus projects and cross-tool workflows.

Run small workflow-based usability tests with at least one representative from each primary persona before investing in costly imports or full transcript mode.

## 13. Explicitly deferred or rejected ideas

- **Reject:** universal ±2 SD "anomaly" highlighting and biological interpretation from a generic high/low biophysical score.
- **Reject:** conflating EPIC probe annotation with observed beta values or a TE family-level score with a validated locus-specific risk.
- **Reject:** automatic silent liftover or silent genomic↔mature-RNA conversion.
- **Defer:** T2T assembly switch, full BAM/CRAM browser, all-purpose clinical variant interpretation, full SHAPE/RNA folding atlas, global AI overlay for unvalidated claims.
- **Refine existing:** keyboard shortcuts, URL sharing, PNG, assembly switching, context panel; assess actual runtime first.

## 14. Open questions for the codebase audit

1. Which layers genuinely serve raw/sampled tiles at 1 bp, 1 kb, and aggregation scale, and which are only labels or unavailable?
2. Are graph definitions, backend computation, precomputed tracks and `Evaluate` numerical results mutually consistent? If not, which method/version is authoritative?
3. How are GENCODE transcript positions, sequence bases, intron/exon codons and strand currently resolved?
4. Does Viewer Share round-trip full active-track state? Are export SVG/PNG pathways currently canvas-only?
5. Which claims/TE scoring examples are real records versus demonstration content?
6. Are target transcript and strand semantics already typed into RNA Builder state?
7. What read length and reference would a mappability track be optimized for?
8. What is the first success-defining user journey for Polymer: sequence design, molecular pathology, or TE/methylation research?

## Implementation handoff checklist

Before implementation begins, the engineering owner should record the following in the project repository:

- Routes and relevant modules for viewer state, track rendering, reference sequence, and tool integration.
- Known supported assembly/contig lists and the exact reference FASTA checksums.
- Live track IDs mapped to layer registry entries, units, data versions, and backend endpoints.
- A minimal golden-locus fixture suite (including reverse strand, splice junction, ambiguous liftover, repeats, missing tracks).
- Baseline performance traces and screenshots for 1 Mb, 100 kb, 1 kb, and 100 bp viewports.
- One demonstration of each targeted end-to-end handoff with a verified input/output payload.
- A single issue tracker with owner, dependencies, pass/fail acceptance evidence, and release designation for each task.

**Required deliverables at each release:** production code, automated tests, screenshots, API/metadata documentation, changelog, and a short list of known scientific limitations. No release is complete on screenshots alone.

## Sources and verification boundary

- Original user-provided Polymer Genome Viewer audit, 110 lines (source proposal, not independent proof).
- Public site: https://polymerbio.org/genomics/view/hg38/chr17:7668421-7687490
- Layer inventory: https://polymerbio.org/genomics/data-sources
- API docs: https://polymerbio.org/genomics/docs
- Product overview: https://polymerbio.org/genomics
- Home/product positioning: https://polymerbio.org/

Public page extraction supports that features are **advertised/present in markup**; code behavior, runtime latency, real underlying data accuracy and completeness require direct automated/manual testing. This document intentionally does not claim those tests were performed.
