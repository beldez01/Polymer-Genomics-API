# Website work log

The [website plan](website-plan.md) is the current planning index; [TODO](TODO.md)
tracks completion. Entries below record outcomes rather than authorizing later work.
Older implementation details remain in their linked records.

## 2026-11-12 — Release separation and landing page

- Identified landing-page redesign in `653272f`, separate from library commits.
- Confirmed GitHub deployment status referred to `polymer-genomics-api` (FastAPI),
  while polymerbio.org was served by the separate Vercel `viewer` (Next.js) project.
- Deployed clean `653272f` frontend to `viewer-83228nbev-beldez01.vercel.app`, aliased
  to polymerbio.org. Homepage, genomics, About and developer routes returned 200;
  library returned 404 at this stage, as intended.

## 2026-11-12 — Library review, sync and deployment

- Build/TypeScript, six composition tests, rendered article anchors/related links,
  notices, canonical URLs and sitemap checks passed.
- Committed `e5ebcb6` on `feat/knowledge-library-expansion` and pushed to GitHub.
- At the user's request, deployed the isolated commit to
  `viewer-pgho824pz-beldez01.vercel.app`, aliased to polymerbio.org.
- All eleven article routes, draft/review notices, citation anchors, homepage and
  key routes passed live checks; nonexistent article returned 404. Independent
  scientific sign-off remains pending. See [library history](knowledge-library.md).

## 2026-11-12 — Homepage search and developer onboarding

- User selected a limited package from the product-roadmap recommendations and
  explicitly stated that not every recommendation would be implemented.
- Added gene/coordinate homepage entry, assembly selection and developer links.
  Corrected examples to match shipped Python and MCP packages; simplified the
  developer quickstart and shared matching reference snippets.
- Build/TypeScript, nine tests and browser checks passed, including empty/error
  states, stale results, assembly-preserving routes, copy controls and 360–1440 px
  layouts. User reviewed local preview and requested commit/push.
- Committed and pushed `5983f72` on `feat/homepage-search-onboarding`. This package
  has not been deployed. See [implementation record](redesign/2026-11-12-homepage-search-onboarding.md).

## 2026-11-12 — Genome Viewer v2 proposal intake

- User supplied `Polymer_Genome_Viewer_Development_Plan_v2.md` and requested that
  it become part of repository documentation, the overall website plan, work log
  and to-do list. Archived the source unchanged under
  [recommendations](recommendations/Polymer_Genome_Viewer_Development_Plan_v2.md).
- Started a limited source and local-production-browser review. Confirmed the
  tested direct link and Share interval/layers, raw assembly switching, and a PNG
  export failure caused by unresolved `html2canvas`. Code review identified fixed
  bounds, incomplete shared display state and metadata/stale-presentation gaps.
- Recorded [verification notes](redesign/2026-11-12-genome-viewer-audit-notes.md)
  with explicit limitations. A01–A06 and G0 remain incomplete; no all-track,
  reference-sequence or performance validation is claimed.
- Created the cross-site plan/log/checklist index, linked the existing detailed
  plans, and replaced the resource-center browser placeholder with this scoped
  intake. Candidate fixes and specialist proposals are separate from completed work.
- No application code, deployment, commit or push was performed for this
  documentation intake. Prior user-approved homepage changes remain committed.

## 2026-11-12 — Authorized homepage release and viewer reliability package

- User approved the proposed next steps: deploy the approved homepage update,
  establish the focused viewer baseline, fix core reliability issues and improve
  quantitative interpretation before later selection/handoff work.
- Deployed `5983f72` to `viewer-3iqkytufm-beldez01.vercel.app`, aliased to
  polymerbio.org; verified live homepage search, developer MCP instructions and library.
- Implemented the viewer package locally on `feat/viewer-reliability`. Standard
  build/TypeScript, fifteen frontend tests and browser acceptance passed. Nine
  backend coordinate tests passed; fourteen sequence integration tests were
  blocked by the unavailable local PostgreSQL service (also confirmed outside
  the sandbox). No sequence-validation pass is claimed.
- Public layer samples found 53 hg38 registry layers and none for hg37; some hg37
  responses included hg38-version metadata with empty records. The viewer now
  checks registry availability and retains unsupported selections explicitly.
- Saved contig-length provenance, reproducible tests, live audit JSON, synthetic
  fixture images and the [implementation record](redesign/2026-11-12-viewer-reliability-implementation.md).
  The viewer package remains local and undeployed pending review. Unrelated
  PolyMethyl, figures and EPICv2 script files remain untouched.

- Final live screenshot review exposed an existing ruler/track horizontal-origin mismatch. Corrected the shared origin and navigation width, then added a browser alignment assertion. Final build/tests were rerun for that change.

## 2026-11-12 — Biophysics UX review follow-up

- User reported excessive track text height, saturation at wider zoom, scroll
  resets and delayed zoom. Implemented compact metadata with accessible full
  context, pixel-aware sample means and padded axes, one anchored track scroller,
  immediate navigation and a small exact-key revisit cache.
- Build, sixteen frontend tests, original reliability browser suite and new dense-
  plot/scroll/cache browser suite passed. Uncached API latency remains separate
  from the measured immediate navigation update. Changes remain local, not deployed.

## 2026-11-12 — Coding-track and header review follow-up

- User requested inline layer provenance, unobscured/restyled sequence-end labels,
  and coding-exon amino acids in their biological frame instead of three generic frames.
- Implemented the shared header and separate direction lane. Replaced generic
  frames with CDS/start-anchored transcript projection, reverse-complement handling,
  exon-junction codons, amino-acid colors and explicit transcript selection in URLs.
- Build, seventeen frontend tests, and three browser suites passed. Existing
  genomic-distance exon frame overlays were removed. Recorded remaining coding
  annotation limitations in the implementation record; no MANE or protein-validation
  claim was added. Changes remain local, not committed/deployed.
