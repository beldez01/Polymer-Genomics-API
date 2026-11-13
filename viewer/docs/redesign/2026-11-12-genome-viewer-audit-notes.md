# Genome Viewer v2: initial code and browser verification

Date: 2026-11-12. Scope: limited intake audit, not a complete G0/G1/G2 assessment.

The [user-supplied v2 document](../recommendations/Polymer_Genome_Viewer_Development_Plan_v2.md)
is retained verbatim. Its recommendations and acceptance criteria remain proposed.
This record separates current evidence from that source's unknowns. No application
code was changed during this audit.

## Findings

| Area | Evidence / result | Disposition |
| --- | --- | --- |
| Direct locus navigation | Local production preview at `127.0.0.1:3121` opened TP53 `hg38/chr17:7668421-7687490` with `gencode_v44,cpg_sites`; coordinate input and URL agreed after hydration. | Implemented for this case; reload, back/forward, invalid routes and fresh-context suite still pending. Do not re-open the old default-chromosome issue solely from server HTML. |
| Share | Browser clipboard contained the tested assembly, interval, and active layers. Page URL serializer includes only these fields; GC/codon/stability/structure/motif toggles and cell-type/motif selections are not serialized. Empty layer sets omit the parameter. | Partial reproducibility; test full state and explicit empty selections. |
| Assembly switch | Clicking hg37 changed the build in the URL while retaining the same numeric interval and layer IDs. Source passes `setBuild` directly. | Confirmed raw build switch; not liftover or gene-identity preservation. Define explicit behavior before redesign. |
| PNG | Clicking PNG produced no download and logged `Failed to resolve module specifier 'html2canvas'` in the local production preview. `ExportButton.tsx` uses an ignored dynamic import; the package is not in viewer dependencies. | Reproducible local defect. Production was not tested in this pass. Repair loading and error feedback before testing output fidelity/provenance. |
| Coordinate model | `src/polymer_genomics/coordinates.py` already converts internal half-open intervals to public closed intervals. `viewer/src/lib/coordinates.ts` and viewport state explicitly use 1-based closed coordinates. Existing backend coordinate/sequence/tile test files are present. | Build on existing adapters and tests; no evidence supports treating all conversion infrastructure as absent. Existing tests were not rerun in this intake. |
| Chromosome bounds | `stores/viewport.ts` uses a fixed 250 Mb ceiling in set/zoom/pan paths rather than assembly/contig lengths. `config/chromosomes.ts` contains hg38 lengths. | Source-confirmed validation gap; add assembly-aware fixtures before claiming end-boundary correctness. |
| Async data | `useViewportData.ts` guards late results with a cancellation flag, but retains prior data during loading/error; fetch calls do not receive its AbortSignal. Compute hook likewise guards late writes but retains previous results during new requests. | Partial protection already exists. Cross-locus stale rendering and network cancellation need controlled runtime tests; do not claim no cancellation exists. |
| Tile caching | `genomeFetcher.ts` keys cache by build, chromosome, resolution, tile index and sorted layers. Data version and model parameters are not in that key. | Assembly is already isolated in cache identity; investigate version/invalidation policy separately. |
| Metadata and scientific display | TrackStack renders evidence badges and receives resolved-layer metadata. Stability/structure renderers autoscale visible values; inspected canvas renderers do not provide complete quantitative axes, units, method/window/version context. | Metadata work is an extension/audit, not a new system from nothing. Review track-by-track before changing semantics. |
| Reading frames | A generic three-forward-frame `CodonFrameTrack` exists, separately from gene CDS overlays. | Check labeling and transcript/strand context before presenting it as biological translation. No transcript-aware correctness claim is made here. |

## Verification boundary

Browser: local production build from the reviewed homepage branch, Chrome headless,
1440 × 1000, no API mocks in this audit script. A direct-link screenshot was captured
at `/private/tmp/polymer-viewer-audit-direct.png`; it is a temporary artifact, not a
committed or durable visual baseline. Console reported one additional non-export
error; its cause was not investigated in this intake. Data/sequence correctness,
all tracks across both builds/scales, image fidelity, reference FASTA hashes,
privacy, performance percentiles and complete navigation restoration remain untested.

The audit script was temporary (`/private/tmp/polymer-viewer-audit.cjs`). Preserve
reusable automated tests and screenshots when the full baseline is undertaken.
The [website to-do list](../TODO.md) holds the remaining work and priorities.
