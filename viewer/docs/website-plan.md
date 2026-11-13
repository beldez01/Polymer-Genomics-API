# Polymer website plan

Updated: 2026-11-12

This is the current cross-site planning index. The [to-do list](TODO.md) tracks
execution; the [work log](WORK_LOG.md) records changes and verification. Detailed
plans retain their historical context. A recommendation being recorded here does
not authorize its implementation, merge, or deployment.

## Current workstreams

| Workstream | Current state | Detailed record / next decision |
| --- | --- | --- |
| Database-first landing page | Deployed to the `viewer` production project at polymerbio.org from `653272f`. | [Original plan](redesign/2026-11-03-database-first-implementation-plan.md). |
| Knowledge Library | Eleven editorial drafts deployed from `e5ebcb6`; independent scientific review remains pending. | [Library record](knowledge-library.md) and [editorial checklist](../../docs/research/dark-genomics-2026-11-11/TODO.md). Deployment is not scientific approval. |
| Homepage search and developer access | Implemented, previewed and approved by the user; committed/pushed as `5983f72` on `feat/homepage-search-onboarding`. Deployed from `5983f72` to polymerbio.org. | [Implementation record](redesign/2026-11-12-homepage-search-onboarding.md). |
| Resource-center improvements | Library implemented; broader gene search, gene-page analysis, and chromosome layout proposals remain pending. | [Resource-center plan](redesign/2026-11-11-resource-center-expansion-plan.md). |
| Genome Viewer audit | v2 archived; focused reliability baseline and corrective package implemented/tested locally. Broader audit and viewer deployment remain pending. | [Original proposal](recommendations/Polymer_Genome_Viewer_Development_Plan_v2.md), [verification notes](redesign/2026-11-12-genome-viewer-audit-notes.md), and viewer tasks in [TODO](TODO.md). |

## Scope policy

The earlier product-roadmap summary and the Genome Viewer v2 plan are candidate
recommendations, not blanket commitments. The user explicitly stated that not
every recommendation will be implemented. Choose small packages after checking
existing behavior, data, and dependencies. Keep editorial expansion separate
from viewer engineering, with useful links between both.

## Viewer direction and staged decisions

Use the supplied document's locus → context → precise selection → downstream
analysis → reproducible return workflow as a planning direction. Begin with
reliability and factual inventory, then choose features based on verified needs.
Existing pan/zoom, search, context, Share, PNG controls, and evidence badges must
be inspected before opening tickets that assume they are absent.

1. **Reality and reliability:** complete A01–A06; document coordinate/reference
   boundaries and layer metadata gaps. Prioritize demonstrated defects such as
   the local PNG export failure, fixed chromosome bounds, assembly-switch
   semantics, incomplete Share state, and stale-data presentation risks.
2. **Viewer polish:** decide on URL/state restoration, metric units and window
   semantics, missing-data states, and resolution-aware rendering. Do not promise
   every preset, transcript feature, or session-tray item from the proposal.
3. **Selection and handoffs:** scope a typed interval/sequence contract, strand
   handling and reproducible BED/FASTA/code outputs before Evaluate, Transposome,
   or RNA Builder integration. Genomic DNA and spliced RNA are distinct inputs.
4. **Specialist features:** MANE ingestion, mappability, transcript projection,
   custom tracks, claims overlays, and extra assemblies require separate decisions
   and validated sources. They are not approved implementation tasks.

The backend already uses 0-based half-open coordinates internally and a public
1-based closed contract. The viewer uses 1-based closed state and rendering.
Centralize and test conversions first; a viewer-wide coordinate migration is a
proposal requiring a separate implementation decision, not a prerequisite assumed
by this plan.

No universal ±2 SD anomaly feature, silent liftover, clinical risk claim, or
implicit genomic-to-transcript conversion is adopted. Audit any existing metric
before deciding whether to retain, relabel, or replace it. Performance targets in
the source document are proposed targets, not measured achievements.

## Release tracking

Production is deployed through Vercel's `viewer` project. GitHub status for the
separate `polymer-genomics-api` project does not establish website deployment.
Production currently includes the library and homepage search even though GitHub `main` remains at
`653272f`; the feature branches contain the later changes. Reconcile source and
release state deliberately before a future merge or deployment. See [TODO](TODO.md).

## Current viewer package

[Viewer reliability implementation](redesign/2026-11-12-viewer-reliability-implementation.md) records completed local navigation/export/data-identity and quantitative-display fixes, tests, live registry findings and remaining limits. This is the current engineering review unit; the full v2 specialist backlog remains optional.
