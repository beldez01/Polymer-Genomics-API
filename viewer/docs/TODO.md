# Website to-do list

Updated: 2026-11-12. Parent: [website plan](website-plan.md).
History: [work log](WORK_LOG.md). Only checked items below are completed.
Proposals remain unapproved until an implementation package is selected.

## Release and source state

- [x] Deploy landing-page-only `653272f` to the `viewer` project; verify public homepage and key routes.
- [x] Review/sync library `e5ebcb6`; deploy and verify all eleven article routes, draft notices and citation anchors.
- [x] Implement and preview homepage search/developer access; build, nine tests and browser checks passed; commit/push `5983f72`.
- [x] Deploy homepage search `5983f72`; verify public homepage, quickstart and library.
- [ ] Reconcile GitHub `main` with the reviewed feature branches and production state through a scoped merge/review. Do not merge unrelated local research files.

## Genome Viewer: intake and baseline (next planning package)

- [x] Archive the supplied v2 plan verbatim and verify file identity.
- [x] Link it into website planning, work log and this checklist as proposed recommendations.
- [x] Record limited code/browser findings without calling the full audit complete.
- [ ] **A01:** Inventory existing features as implemented/partial/broken/absent with route, source, responsible owner (currently unassigned), reproducible test and release designation.
- [x] **A02 (focused cases):** Direct-open/reload/back/forward/fresh-page state, invalid links and explicit empty selections passed. Full all-route/history regression remains future work.
- [ ] **A03:** Layer availability at 1 Mb/100 kb/1 kb/100 bp on both supported builds; test sparse/unsupported/missing/error states. Inventory units, window, methods and version metadata.
- [x] **A04 (current contract):** Versioned Share-state round trips and actual PNG download with dimensions/provenance passed. System-fallback fonts and viewport-only capture documented.
- [ ] **A05:** Classify real production records, computed outputs and examples/placeholders in targeted viewer and handoff surfaces.
- [ ] **A06:** Reconcile layer counts, source/reference versions, FASTA checksums and API/SDK/MCP contracts for viewer operations.
- [ ] Capture durable baseline screenshots and performance traces; quantify cold/warm cache and pan/zoom separately. No performance targets are marked achieved.

## Original reliability candidates: remaining full-audit coverage

The scoped local fixes below are recorded separately in the implementation record. Unchecked entries retain broader fixture/provenance requirements beyond that completed package.

- [ ] **C01:** Assembly-aware contig bounds and coordinate conversion fixtures; 1-bp/end-boundary/alias/reverse-strand cases. Reuse backend conversions; decide separately whether viewer state needs migration.
- [ ] **C02/U02:** Visible-layer metadata, meaningful raw axes/units/window semantics, explicit missing-data states, and model/precomputed/measurement distinctions.
- [ ] **U01:** Canonical/versioned Share state with empty-selection and browser-history restoration tests. Decide precisely which toggles/layers/order it preserves.
- [ ] Define assembly-switch semantics; label numeric build switching explicitly or implement a validated identity/mapping workflow. No silent liftover.
- [ ] Reproduce loading/error stale-data behavior under delayed responses; clear or visibly separate data belonging to an earlier locus/build. Test cache invalidation/version identity.
- [ ] Check generic reading-frame labels versus transcript/CDS-aware translation and minus-strand behavior.
- [x] User authorized the reliability package; implemented bounded navigation, assembly confirmation, keyed loading, Share restoration, PNG repair and quantitative labels/axes. See the [implementation record](redesign/2026-11-12-viewer-reliability-implementation.md).

## Viewer UX review follow-up

- [x] Keep biophysics metadata to one line with full context accessible.
- [x] Aggregate dense display samples and adjust scales without replacing missing values.
- [x] Preserve lower-track visibility during zoom/loading using a stable scroller and track anchor.
- [x] Remove delayed navigation; reduce request coalescing and cache recent exact requests.
- [x] Verify with a new browser UX suite and retain prior reliability coverage.

## Coding-track review follow-up

- [x] Put layer provenance/availability inline with the Biophysics header.
- [x] Place styled 5′/3′ labels in a direction lane clear of sequence bases.
- [x] Replace generic frames with CDS/start-anchored transcript codons and amino-acid labels/colors.
- [x] Validate plus/minus strands, exon-junction codons, missing phase and explicit transcript URL restoration.

## Local reliability package: next release actions

- [ ] Review the local reliability preview; commit/push/deploy as requested.
- [ ] Restore local PostgreSQL and rerun fourteen blocked backend sequence integration tests before claiming reference-sequence validation.
- [ ] Reconcile live hg37 registry/metadata and exact FASTA identity; frontend now reports missing registry coverage.
- [ ] Complete backend method/window/version provenance and all-track/model-parity checks. The scoped fixes do not complete G0–G4.

## Later viewer candidates (not committed scope)

- [ ] Select useful semantic-zoom/preset/cursor/session-tray improvements after reliability work.
- [ ] Scope typed interval selection and reference-backed BED/FASTA exports before cross-tool handoffs.
- [ ] Define DNA vs transcript-oriented RNA payloads, strand, sequence identity and return navigation for each selected handoff.
- [ ] Evaluate MANE, mappability, transcript projection and local BED imports independently; require source/method/assembly coverage.

CHM13 ingestion, BAM/CRAM, broad claims overlays, clinical interpretation and
unvalidated anomaly/risk scoring are not adopted implementation commitments.
The archived plan's remaining IDs are proposals, not an automatically accepted backlog.

## Parallel site/editorial work

- [ ] Continue gene-search coverage, chromosome layout and gene-page improvements through the [resource-center plan](redesign/2026-11-11-resource-center-expansion-plan.md).
- [ ] Continue library scientific review, origins articles and ERE source audit through the [editorial checklist](../../docs/research/dark-genomics-2026-11-11/TODO.md). Keep one authoritative editorial checklist rather than duplicating its full backlog here.
