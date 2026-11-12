# Knowledge Library: current progress and next steps

Updated: 2026-11-12

This is the current task checklist for the research/editorial expansion. The
[worklog](WORK_LOG.md) preserves history; the [expansion plan](../../../viewer/docs/redesign/2026-11-12-dark-genomics-expansion-plan.md)
defines article scope and sourcing gates; the [research map](RESEARCH_MAP.md)
retains the original briefs. Update this checklist when a task changes state.
Historical “next step” sections in older records describe their own dates.

## Current state

| Item | Current state |
| --- | --- |
| Roadmap | 42 briefs; all mapped to articles, extensions, or focused treatments. |
| Source registers | 45 original sources + four extensions = 49; IDs preserved. Inclusion does not imply every source has been fully reviewed. |
| Implemented library | Eleven editorial drafts: eight foundations and three Methods & reference entries. |
| Batch 0 | Thermodynamics expanded; mechanics and evidence articles added; internal source review completed and eleven findings addressed. |
| Independent scientific sign-off | Pending. The assistant's source review is not independent expert approval. All eleven articles retain draft status. |
| Origins / later batches | Pending; none started during the batch 0 review. |
| ERE/viral-mimicry material | Document intake and intended focus recorded in the worklog; primary-source audit and integration still pending. |
| Publication / deployment | Not performed. Editorial license and authorship/review decisions remain unresolved. |

## Completed work

- [x] Create the research map and extend it to 42 briefs / 45 original sources.
- [x] Map all briefs to phased expansion work and explicit sourcing gates.
- [x] Establish the initial eight-foundation order, separate Methods & reference,
  chromatin overview, and expanded GC/isochore drafts. Scientific review remains
  separate from these implementation milestones.
- [x] Expand thermodynamics using briefs 10–11, preserving the route and existing
  section anchors.
- [x] Implement DNA mechanics (12) and physical annotation/evidence (36), with
  original figures, tables, citations, related links, and sitemap integration.
- [x] Create the evidence-record template, batch claim record, source-extension
  register, internal reading path, and copying-fidelity figure specification.
- [x] Complete the batch 0 internal source-and-methods review: close the Bryant
  and Erdel main-text access gaps; inspect relevant methods/supplements; check
  notice metadata and recent literature; apply eleven findings; add S43–S45.
- [x] Record eleven reviewed primary sources and twenty inspected artifact hashes
  in the review manifest. This is a claim-specific audit, not raw-data replication.
- [x] Verify implementation: TypeScript/build, citations, routes, search/filtering,
  preserved anchors, draft labels, and responsive layouts. The earlier six
  composition tests and decimal checks for the fidelity specification also passed.
- [x] Record the two supplied ERE/viral-mimicry documents and their proposed focus
  in the worklog, keeping their mechanistic and therapeutic proposals unvalidated.

Evidence: [implementation log](../../../viewer/docs/knowledge-library.md),
[review report](../../../viewer/docs/editorial/physical-foundations-review-2026-11-12.md),
[review manifest](../../../viewer/docs/editorial/physical-foundations-review-manifest.json),
[source extensions](../../../viewer/docs/editorial/dark-genomics-source-extensions.md).

## Next actions, in order

1. **Close the remaining batch 0 review handoff.**
   - [ ] Identify the independent subject-matter reviewer(s); none is assigned or
     credited yet. The existing three drafts, claim record, report, and manifest
     form the review packet. No reviewer has been contacted by this task.
   - [ ] Obtain and record decisions on thermodynamic conventions/model scope,
     mechanical observables and cyclizability, causal-inference guidance, the
     NIPBL timing example, HP1 system boundaries, and figure accuracy/clarity.
   - [ ] Resolve any resulting findings in the prose and claim record. Run checks
     appropriate to actual changes, then record which version was reviewed.
   - [ ] Keep draft labels until review actually occurs; record any unresolved
     scientific issues explicitly. Do not infer approval from the build or this
     checklist.

2. **Prepare the next planned production unit: origins briefs 01–05.**
   - [ ] Create claim-level records using the existing template and dossier
     anchors: 01 S03–S05; 02 S01–S02; 03 S02–S03; 04 S03–S04; 05 S05.
   - [ ] Read relevant full papers and supplements, check identities, corrections,
     publication status, and later tests/challenges; record access limitations.
   - [ ] Draft in order: heredity → building blocks → RNA-world hypotheses →
     copying fidelity → compartments. Attach scoped citations and one original
     explanatory figure per article. This remains planned work, not completed
     production or a publication commitment.
   - [ ] Implement the q^L widget with the fidelity article only after its evidence
     record is ready. The specification and nine checked rounded values exist;
     the widget does not. Verify edge cases and small nonzero values.
   - [ ] Integrate drafts into existing search, related reading, metadata, and
     sitemap; add Origins & evolution only when content exists. Run the library
     checks and internal review, then hand off for scientific review.

3. **Audit the ERE/viral-mimicry material as a separate pending workstream.**
   - [ ] Inventory claims from the two documents recorded in the worklog and
     crosswalk them to existing briefs, particularly 37–42 and the chromatin
     prerequisites. Identify unmatched topics without inventing completed briefs
     or source IDs.
   - [ ] Recover exact primary references and verify publication/preprint status;
     their presence in a bibliography is not verification.
   - [ ] Separate ERE expression, RNA/DNA products, sensing, stress responses, and
     disease outcomes by family, locus, cell state, and experimental system.
   - [ ] Preserve hypotheses around dysplasia/ISR, conditioning, the two-hit model,
     and a multicellular security-system interpretation. Keep construct design,
     efficacy, selectivity, and therapeutic-window claims unvalidated.
   - [ ] Document how the audited material changes coverage or priority before
     revising the production order. Intake alone has not changed the 42-brief
     sequence or made this track publication-ready.

4. **Continue the remaining backlog through its source gates.** Use the table
   below and the detailed plan rather than treating every brief as a new URL.

The independent review above remains a scientific sign-off requirement for
publication. It is distinct from the source-readiness checks for a future draft.
This checklist update starts no research, drafting, outreach, or deployment.

## All 42 briefs: current disposition

Each number appears once below. “Represented” means implemented in the stated
limited scope, not complete scientific validation. Existing chromatin or repeat
overviews do not by themselves complete their planned deeper treatments.

| Work package | Briefs | State / next dependency |
| --- | --- | --- |
| Batch 0 | 10, 11, 12, 36 | Represented in three implemented drafts; internal review revisions applied; independent sign-off pending. |
| Batch 1: first origins installment | 01–05 | Pending claim records, relevant full-text/supplement and update checks, then drafting. |
| Batch 2: origins/size extensions | 06, 26 | Sourcing hold: DNA-origin/repair mechanisms and broader genome-size comparisons. These additions alone do not complete the opening reading path. |
| Optional origins extensions | 07–08 | Pending: code-origin comparisons and qualified ancestral reconstruction. |
| Batch 3: physical substrate | 09, 13–17 | Pending. Complete topology (14) before transcriptional torque (15); reuse the implemented 10–11 material rather than duplicate it. |
| Batch 4: chromosome as process | 18–24 | Pending scoped extensions/new articles. Existing chromatin overview is a starting point; replication licensing, territories, and other identified gaps still need sourcing. |
| Batch 5: evolutionary construction | 25, 27–32 | Pending; preserve the distinction between insertion, retention, co-option, and host function. Source holds include de novo gene annotation and comparative checks. |
| Batch 6: observational limits | 33–35 | Pending; extend coordinates where appropriate and distinguish historical reference milestones from current releases. Reuse 36. |
| Batch 7: repeat geography/failure | 37–42 | Pending mechanism-specific sourcing. Develop 37–39 and 42, then 41, before the hypothesis/design treatment in 40. ERE intake is not completion of this package. |

The proposed opening path is 01 → 02 → 03 → 04 → 05 → 06 → 12 → 15 → 26 → 36.
Only 12 and 36 are implemented on that path; 06 and 26 have sourcing holds and
15 depends on topology/torque work in batch 3. See the [internal reading path](../../../viewer/docs/editorial/genome-possible-reading-path.md).

## Carry-forward work from the earlier library plan

- [ ] Refine `material-channel` with founder input, scoped claims, and references.
- [ ] Deepen `sequence-complexity`, `repeating-and-nonrepeating-dna`,
  `cpg-distribution`, and `genomic-coordinates`; connect them to later treatments
  without duplicating the GC, isochore, thermodynamics, or chromatin expansions.
- [ ] Complete independent scientific review of GC/isochores, chromatin, and the
  other existing entries as well as batch 0. The three-article audit does not
  cover the entire eleven-article library.
- [ ] Resolve editorial license, actual authorship, and review attribution before
  publication; retain scientific limits with each article.
- [ ] Introduce reusable named reading paths only when a second substantial
  collection is ready. Preserve stable routes and the existing content contract.

Guided experiences, resource-center/browser redesign, a CMS, new API layers, and
live data/model validation remain outside this editorial checklist. No tabled
nucleosome prediction or conceptual construct becomes a validated capability
through article production. The LINE-1/ERV boundary-erosion chain remains a
hypothesis; association, activation order, and architectural causality require
separate evidence.
