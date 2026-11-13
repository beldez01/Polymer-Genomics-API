# Genome Viewer reliability package

Date: 2026-11-12 (America/New_York). Branch: `feat/viewer-reliability`.
Status: implemented and checked locally; viewer changes are not deployed.
Parent: [website plan](../website-plan.md). Source proposal:
[Genome Viewer v2](../recommendations/Polymer_Genome_Viewer_Development_Plan_v2.md).

## Release completed first

The approved homepage search/developer onboarding commit `5983f72` was deployed
separately to Vercel's `viewer` project:
`https://viewer-3iqkytufm-beldez01.vercel.app`, aliased to polymerbio.org.
Live homepage search labels, corrected developer MCP setup, and existing library
were checked. This release does not include the viewer changes below.

## Implemented fixes and contracts

| Area | Final behavior | Evidence |
| --- | --- | --- |
| Navigation and reference bounds | Primary-contig lengths are specific to hg38/hg19 (API alias hg37). Panning retains window width at boundaries; zoom/presets retain exact requested widths where possible. Invalid direct links show an error without substituting a locus. | Reference, store, URL and pixel fixtures; browser chromosome-end and invalid-link cases. |
| Ruler/cursor origin | Ruler, quantitative curves and tracks share the same label-column offset and horizontal scale. Drag/pinch use the plot width; a ResizeObserver tracks context-panel/layout width changes. | Browser canvas-origin/width assertion and screenshot review. |
| Reference provenance | UCSC chromosome-length URLs, retrieval date and source-file SHA256 are stored in `src/config/referenceContigs.json`. | Both downloaded files checked; primary-contig lengths extracted. These are length-table hashes, not FASTA hashes. |
| Assembly switching | Explicit confirmation to use the same numeric coordinates; no claim of liftover. Intervals outside destination bounds cannot be confirmed. | Browser confirm/cancel and preserved-coordinate cases. |
| URL and Share | `v=1` stores build/interval, layer selection and order, GC/codon/stability/structure/motif switches, context-panel state, cell types and marker motifs. Empty lists are explicit; legacy links receive defaults. Unknown state versions fail visibly. | Unit round trips plus direct/reload/back/forward/fresh-page browser checks. No transcript selection is invented. |
| Data identity | Viewport and compute results are keyed to all request inputs. Earlier data is hidden during loading and errors; cancelled requests cannot publish results. Abort signals reach region/tile/sequence/compute requests. | Delayed-response and failed-response browser cases. |
| Registry and missing data | Requested layers are checked against assembly-specific registry availability; unavailable selections are retained in the URL but not silently fetched as another assembly's annotations. Sequence length must match the requested interval before bases are drawn. | Live registry audit; browser unavailable-layer scenario; explicit sequence warning. |
| PNG | Bundled `html-to-image` exporter captures the visible viewport at 2x pixel ratio; footer includes assembly, closed interval, date and returned layer versions/evidence tags. Export is disabled during loading and displays failures. | Actual 2120 × 1762 PNG download in fixture test; exported image inspected. Fonts use system fallbacks. |
| Quantitative interpretation | ΔG has explicit units, reference temperature and endpoint salt assumption. Curvature/deformability and precomputed shape parameters have separate numeric axes and model descriptions. Renderer field names match prefixed compute outputs. Missing/constant/zero values are distinct. | Numeric tests, computed fixture plots and browser checks. No clinical or anomaly score added. |
| GC | Unknown bins are gaps instead of fabricated 50% values. Labels distinguish callable-base sequence windows, CpG-annotation sampling and isochore-domain sampling. | Numerical missingness fixtures and inspected export. |
| Generic frames | Three forward genomic frames are explicitly distinguished from selected-transcript translation. | Source/label review; no new transcript-aware translation capability. |

The workspace root is now explicit in Next configuration. This removed the local
root-lockfile inference problem and resolved a Turbopack Google-font import failure
seen in the first build attempt. No framework upgrade was performed.

## Focused baseline and acceptance results

- Standard `npm run build` (including TypeScript): passed.
- `npm test`: 15 passing tests, including six new reliability cases.
- `BASE_URL=http://127.0.0.1:3123 npm run test:viewer`: passed. Tests use controlled
  API fixtures to cover errors/delays, state restoration, both builds and four
  resolution bands. Responsive checks passed at 768/390/360 px; desktop at 1440 px.
  No browser page errors. Desktop Share/PNG controls remain desktop-only.
- Existing backend coordinate fixtures: nine passed. Fourteen existing sequence
  integration tests could not initialize because their required local PostgreSQL
  service on port 5432 was not running. Retrying outside the sandbox confirmed
  connection refusal; this is not recorded as a sequence-test pass.
- Public [layer audit](../verification/viewer-reliability/live-layer-audit.json):
  53 hg38 registry layers, zero hg37 registry layers at the time queried. Requests
  at four representative scales returned HTTP 200 for both builds, but hg37 had
  no feature records and included hg38-version resolved-layer metadata. HTTP 200
  and a layer status of `ok` therefore do not establish assembly coverage.
- Local preview with requests forwarded to the live public API rendered hg38 sequence/model curves without page errors and showed the hg37 registry-unavailability warning. [Live-data screenshot](../verification/viewer-reliability/live-hg38-200bp.png).
- Live endpoint timings are recorded per request, not presented as P95 or a
  full viewport performance benchmark. Coarse requests sampled one tile each.

## Reproducing the checks

From `viewer/`, install dependencies, then run `npm test` and `npm run build`.
Start a preview using `npm run start -- --hostname 127.0.0.1 --port 3123` and run
`BASE_URL=http://127.0.0.1:3123 npm run test:viewer` in another terminal.
The browser suite uses installed Chrome by default; select another installed
channel with `PLAYWRIGHT_CHANNEL`. Screenshots/exports are written to
`VIEWER_TEST_OUTPUT` (default `/private/tmp/polymer-viewer-reliability`).

`python3 tests/viewerLiveAudit.py` refreshes the public registry/sample report.
It is deliberately separate from deterministic tests and reads the public API.

Durable examples: [fixture viewport](../verification/viewer-reliability/fixture-hg38-100kb.png)
and [fixture PNG export](../verification/viewer-reliability/fixture-export.png).
Fixture images are synthetic test outputs, not measured genomic values.

## Remaining limits and next package

This is a focused reliability/interpretation package, not full G0–G4 sign-off.
Full FASTA/accession/checksum reconciliation (especially hg19 mitochondrial
reference choice), independent sequence comparisons, all-track/all-locus checks,
transcript/CDS strand verification, model/evaluator numerical parity, method-version
metadata and performance percentiles remain open. Backend model versions and
window parameters are not returned as complete provenance; displayed defaults
come from the inspected endpoint implementation and are labeled as defaults.

No source claims, clinical risk probabilities, MANE ingestion, liftover or new
assembly were added. A universal canonical half-open viewer migration was not
performed. Source ingestion remains authoritative for build/reference identity.

After reviewing this package, prioritize exact interval selection and reference-
backed BED/FASTA export, then a DNA Evaluate handoff with an explicit sequence and
parameter contract. RNA/transcript handoffs remain separately scoped.

## Review follow-up: compact biophysics and zoom UX

The user's review identified wrapped track descriptions, saturated dense curves,
scroll resets when loading, and delayed zoom feedback. Applied locally:

- A single metadata line per quantitative plot, with full units/model context and
  raw extrema in its accessible description and hover text. GC/context notes also
  stay on one line; text truncates rather than expanding each row.
- Display aggregation adapts to genomic width and canvas pixels (about one output
  bin per three CSS pixels). Dense bins show finite-sample means, explicitly labeled;
  raw sample extrema are retained. Summary axes include padding tied to raw variation
  so small residual binning differences are not amplified into another saturated
  trace. Missing bins remain gaps; fine zoom exposes individual samples.
- One vertical track scroller, retained loading height, stable plot heights and
  restoration by visible-track anchor prevent the viewport jumping to the top.
- Navigation commits immediately instead of waiting 150 ms for an animation.
  Feedback uses a brief opacity transition and never scales vertical geometry.
  Request coalescing is 25 ms rather than 80 ms. A four-entry, 30-second cache
  reuses exact request identities; computed outputs over 100,000 steps are not
  cached. Uncached network latency remains dependent on the API.

Verification: production build, sixteen frontend tests and the original browser
suite passed. New `tests/viewerUx.browser.cjs` verifies compact lines, dense canvas
coverage, immediate navigation, retained scroll through delayed data, the same
visible track (eight-pixel layout tolerance), and cached revisits. A controlled
navigation committed in about 1 ms; this is not an end-to-end or P95 claim. The
synthetic alternating-sample stress test painted blue on about 0.16% of the plot,
replacing the dense raw-stroke behavior. Review preview is on port 3125.

## Review follow-up: shared header, strand labels and coding-frame track

- Moved the provenance/availability disclosure into the Biophysics header row.
  Opening it uses an overlay panel, keeping the normal track layout compact.
- Removed dark canvas overlays at sequence ends. The forward-reference 5′/3′
  labels now use the site palette in a separate 18 px direction lane. Canvas
  coordinates and the first/last sequence bases are unchanged and unobscured.
- Replaced three generic forward frames with an explicit coding-transcript view.
  Fetches complete gene annotations from the existing gene endpoint, uses CDS
  features only, and requires an annotated three-base start to anchor phase.
  CDS offsets accumulate in transcript order across introns; negative-strand
  sequences are reverse complemented. Boundary bases are retrieved as needed
  rather than inventing incomplete codons. Untranslated exons/introns are blank.
- Shows one-letter amino acids inside codon blocks at readable zoom, with stable
  per-amino-acid colors and codon/position details on hover. Split codons are drawn
  as separate exon pieces; colors are categorical identifiers, not scores.
- Added a transcript selector. The automatic choice is a deterministic longest
  complete-CDS representative, not a MANE/canonical assertion. Explicit choices
  persist in the optional `transcript` URL parameter. This is not a full spliced
  transcript axis or mature-RNA handoff implementation.
- Removed the previous GeneTrack codon overlay, which treated exon intervals and
  genomic distances as if they established CDS frame.

Validation: standard build and seventeen frontend tests passed. The new coding
browser suite verifies inline provenance, non-overlapping direction labels,
CDS-only amino acids, split codons, reverse complements, stable amino-acid colors,
explicit transcript sharing/reload and absence of guessed phase. Prior reliability
and compact-plot/scroll suites passed. Genetic-code projection is based on the
supplied reference/CDS model, not an independent protein-sequence validation;
recoding/translation exceptions are not annotated by the current API.

Review preview: port 3126. The [live exon screenshot](../verification/viewer-reliability/live-coding-exon.png)
uses an explicitly selected TP53 transcript rather than claiming MANE selection.
