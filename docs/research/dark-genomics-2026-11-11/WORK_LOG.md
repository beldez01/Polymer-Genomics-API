# Dark genomics research — work log

Recorded: 12 November 2026\
Research session: 11 November 2026, America/New_York\
Project: PolymerGenomicsAPI\
Status: Research scoping and expansion plan completed; batch 0 implemented and internally source-reviewed, with revisions applied. Independent scientific sign-off and publication remain pending. Origins and later batches remain pending; none was started during this review.

Current task checklist: [TODO.md](TODO.md). Use it for present completion states
and ordered next steps; the dated entries below preserve the history of each
session, including the later ERE/viral-mimicry intake.

## Request and authorized scope

The user requested a comprehensive search for producible information segments about the deep fundamentals of “dark genomics”: how the genome physically exists and how it came into being. The project at `/Users/zbb2/Desktop/PolymerGenomicsAPI` supplied context. Another instance was developing the project concurrently, so this work was limited to research and document generation.

The initial sections record the completed research session retrospectively. Dated updates below record subsequent authorized planning and implementation. This is not a timestamped search export or a record of a systematic review; the initial research-only scope does not describe the later implementation work.

## Deliverable

[RESEARCH_MAP.md](RESEARCH_MAP.md) — *Dark genomics: the physical origins and continued existence of genomes*.

The dossier contains:

- 36 proposed article briefs, each with a central question, treatment, evidence boundary, source references, and a visual concept.
- 40 linked primary research or theory sources.
- A working distinction among observational, mechanistic, historical, and theoretical unknowns.
- Eight organizing theory threads, a recommended first collection, and a proposed production sequence.
- Three worked outlines: transcription-generated torsion; copying fidelity and genome size; and competing explanations for heterochromatin organization.
- A follow-up research table and a handoff note for the implementation instance.

The resulting central question was: **How did chemistry become a heritable, repairable, physically organized genome—and how does that genome continue to exist?**

## Context examined

Repository context included the README, paper-framing document, knowledge-library documentation, the November 11 knowledge-library expansion plan, and the internal physical-genomics framing document. Selected local Research materials covered polymer foundations, the genome-as-medium perspective, the nucleosome-wrapping model revision, and obelisks. File discovery also identified related local topic notes for potential later use.

These reads established the project's material-property perspective and existing coverage of composition, thermodynamics, repeats, isochores, chromatin, and CpGs. They were a targeted context review, not an audit of the full repository or local research collection.

## Work performed

1. Inspected the project structure and relevant documentation without editing implementation files.
2. Located related local research notes and checked the recorded limitations of the tabled nucleosome-occupancy model.
3. Ran targeted web searches for foundational primary papers, using article titles, author/year combinations, and topic terms. Sources were identified through publisher pages, PubMed, PMC, and institutional records.
4. Organized the material into five editorial groups: before genomes; DNA as a physical molecule; chromosome maintenance; evolutionary construction; and observational limits.
5. Wrote the research dossier, separating experimental findings, theoretical models, historical inferences, and proposed editorial synthesis.
6. Checked source identities and selected bibliographic details. Corrected the somatic-mutation source attribution to Rockweiler et al. and corrected the source-register count to 40.
7. Ran structural checks on the completed Markdown document.
8. Added this work log at the user's subsequent request on November 12.

## Research coverage

| Area | Subjects investigated |
| --- | --- |
| Origins of heredity | Prebiotic nucleotide chemistry, RNA/DNA precursor scenarios, ribozymes, copying fidelity, protocells, genetic-code models, LUCA |
| DNA physics | Solvent and ions, duplex thermodynamics, sequence order, DNA shape, mechanics, torque, supercoiling, non-B structures, R-loops |
| Chromosome persistence | Nucleosomes, active remodeling, histone recycling, methylation maintenance, loop extrusion, compartments, phase-separation evidence, replication |
| Evolutionary construction | Eukaryotic ancestry, drift and genome complexity, mobile elements, ERV co-option, intron ancestry, biased gene conversion, centromeres, de novo gene candidates |
| Limits of observation | Complete assemblies, pangenomes, novel RNA elements, somatic mosaicism, and the distinction between annotation and causal explanation |

Exact paper links, brief-to-source mappings, representative search terms, and topic-specific limitations are recorded in the dossier.

## Decisions and evidence boundaries

- Treat “dark genomics” as a working editorial term, not a recognized unified discipline or a claim of one hidden genomic code.
- Connect sequence, material properties, cellular machinery, and evolutionary history without claiming that physical genomics replaces sequence biology.
- Distinguish noncoding, repetitive, unassembled, unconstrained, and functionally unexplained sequence.
- Distinguish laboratory feasibility from reconstruction of events on early Earth.
- Present competing explanations where warranted, especially for heterochromatin phase behavior and genome expansion.
- Do not represent Polymer's tabled nucleosome-occupancy predictions as validated measurements. This session did not independently validate other platform layers.
- Keep all proposed articles at draft status pending actual scientific review.

## Verification completed

Programmatic checks confirmed 36 numbered article briefs, 40 unique source-register entries, no unresolved source identifiers, and HTTPS formatting for bibliography links. The final dossier contained approximately 6,200 words at the end of the session.

These checks established document structure and internal reference consistency. They did not establish that every linked page was accessible or that every scientific statement had received full-text review. No software tests were needed because no implementation changed.

## Limitations and remaining work

The search was broad and targeted, not an exhaustive systematic review. Verification used accessible records, search excerpts, and selected full-text passages. Some publisher pages encountered access redirects and some PMC pages encountered browser challenges. Full supplementary-methods review, comprehensive citation chaining, correction/rebuttal checks, and a dedicated 2025–2026 literature update remain outstanding.

Priority source expansions include the origin of DNA and repair, translation emergence, connected prebiotic environments, alternative genetic backbones and homochirality, repeat repression, centromere drive, telomeres, topological maintenance, mutation/repair landscapes, and broader genome-size diversity.

Before producing public articles: select a brief, close its identified source gaps, read the relevant full papers and supplements, build a claim-level source record, create original figures, and obtain scientific review. These steps are proposed follow-up work and were not completed in this session.

## Files and implementation boundary

Files created by this research task:

- `docs/research/dark-genomics-2026-11-11/RESEARCH_MAP.md`
- `docs/research/dark-genomics-2026-11-11/WORK_LOG.md`

No application code, public library content, API layers, or deployment was changed by this task. No commit or publication was performed. Concurrent work by the other instance was outside this task's scope and was not audited.


## Update — 12 November 2026: repeat geography and chromatin failure

At the user's request, incorporated the LINE-1/ERV architectural discussion into the ongoing research map. Added six briefs (37–42): insertion versus evolutionary retention; distinctions among genomic/spatial maps; repeat-derived regulatory and boundary functions; the boundary-proximity/activation-order hypothesis; inflammatory products and sensing; and locus-specific silencing machinery.

Added five primary-source records (S37–S41), bringing the current map to 42 briefs and 45 sources. These build on the preceding discussion's targeted searches; this document update did not constitute a new systematic literature search or full-text review. Added a concrete analysis design, competing explanations, and controls for family, age, composition, mappability, baseline state, and spatial dependence.

Preserved the distinction between supported repeat-associated mechanisms and the unproven model that ERVs occupy vulnerable edges and activate before deeply buried LINE-1 copies. Recorded that the supplied domain-only references do not substantiate precise genome fractions or isochore/band distributions. Existing counts above describe the initial session; the updated counts here describe the expanded map. Research documents only were edited.

## Update — 12 November 2026: expansion plan and batch 0 implementation

The user subsequently authorized an expansion plan and implementation. Created the
[dark-genomics expansion plan](../../../viewer/docs/redesign/2026-11-12-dark-genomics-expansion-plan.md),
mapping all 42 briefs to phased new articles, existing-article extensions, and
sourcing gates. Checked that all briefs were mapped once and document links
resolved. Implementation covered the first work package, batch 0; the full
42-brief roadmap is not implemented.

### Current progress

| Workstream | Status | Result / next dependency |
| --- | --- | --- |
| Research roadmap | Complete as a scoping draft | 42 briefs and 45 original source records; full scientific verification remains separate. |
| Expansion plan | Written | Production order, overlap mapping, evidence workflow, source gates, and library integration documented. |
| Batch 0: physical foundations and evidence | Implemented as editorial drafts | Thermodynamics expanded; DNA mechanics and physical annotation/evidence references added. |
| Evidence infrastructure | Created | Reusable template, shared claim–source record, source extension register, figure specification, and internal reading path. |
| Batch 1: origins briefs 01–05 | Pending | Build claim-level records and complete relevant full-text/supplement checks before article production. |
| Later batches | Pending | Follow the expansion plan's dependencies and topic-specific sourcing gates. |
| Scientific review / publication | Pending | No article marked scientifically reviewed; no deployment performed. |

### Implemented content and integration

- Expanded `/library/dna-thermodynamics` using briefs 10–11, preserving its stable
  slug, foundation order, and existing `quantities`, `neighbors`, and `comparison`
  anchors.
- Added `/library/dna-mechanics` (brief 12) and
  `/library/physical-annotation-and-evidence` (brief 36) to Methods & reference.
  The library now has eleven editorial drafts: eight foundations and three
  reference entries.
- Added original code-native mechanics and evidence diagrams, explanatory tables,
  primary references, related links, search terms, and sitemap entries. Scientific
  review remains pending for every article.
- Kept duplex thermodynamics, elastic-chain mechanics, and assay-specific
  cyclizability distinct. No failed occupancy prediction was presented as a
  validated measurement or a new API layer.
- Added Marko & Siggia (1995), “Stretching DNA,” as source extension S42. The
  original dossier still contains 45 sources; the combined original and extension
  registers contain 46. Source S42 and article brief 42 are separate identifiers.
- Prepared an internal copying-fidelity figure specification and opening reading
  path. No copying-fidelity widget, origins article, empty collection, or future
  public route was implemented in this batch.

Supporting records:

- [Implementation and verification record](../../../viewer/docs/knowledge-library.md)
- [Batch claim–source record and access limitations](../../../viewer/docs/editorial/physical-foundations-brief.md)
- [Reusable evidence-record template](../../../viewer/docs/editorial/evidence-record-template.md)
- [Source extensions](../../../viewer/docs/editorial/dark-genomics-source-extensions.md)
- [Copying-fidelity figure specification](../../../viewer/docs/editorial/copying-fidelity-figure-spec.md)
- [Internal opening reading path](../../../viewer/docs/editorial/genome-possible-reading-path.md)

### Verification completed for implementation

TypeScript, production build, whitespace checks, and the six existing composition
calculation tests passed. The nine rounded values in the copying-fidelity figure
specification were checked with independent high-precision decimal arithmetic.

Production-preview browser checks passed for all eleven article routes, draft
labels, canonical URLs, citation/contents anchors, related-route resolution,
preserved thermodynamics anchors, combined search and subject filtering,
table-text search, empty/reset behavior, table-region focus, and missing-route
HTTP 404. The directory and all three changed/new articles were checked at 1440,
768, 390, and 360 px with no horizontal page overflow or page exceptions.
Desktop mechanics and mobile mechanics/evidence screenshots were inspected.
These results verify implementation behavior, not scientific validity.

### Remaining work and evidence boundaries

The batch source record distinguishes targeted full-text inspection from
abstract-only access and unreviewed supplements. Complete the recorded access,
supplement, correction/retraction, and recent-literature checks before public
publication, obtain actual scientific review, and resolve the editorial license.
The first origins batch still needs its own claim records and original figures;
brief 06 remains gated on DNA-origin/repair sourcing and brief 26 on broader
comparative evidence.

The LINE-1/ERV boundary-erosion model remains an unresolved hypothesis. No
universal edge/interior arrangement or activation order was adopted, and no
causal architectural mechanism was established by this implementation. No
deployment or commit was performed during this implementation session.

## Update — 12 November 2026: batch 0 source review before further expansion

At the user's instruction, reviewed batch 0 before starting any other work. No
origins article or later batch was started. The current review is recorded in
the [source-and-methods report](../../../viewer/docs/editorial/physical-foundations-review-2026-11-12.md)
and [bibliographic/retrieval manifest](../../../viewer/docs/editorial/physical-foundations-review-manifest.json).

Completed claim-specific primary-text and relevant supplemental review for the
three implemented articles. Recovered Bryant's full paper from the author's
Stanford site and Erdel's full text through Europe PMC. Read the relevant Basu
supplementary notes, Schwarzer supplementary information/reporting summary,
Nuebler SI, Erdel supplemental figures/tables, and methods/supporting materials
for the new citations. The manifest records eleven primary sources and twenty
inspected artifact hashes; manuscripts remain in a temporary cache, not public
content. This does not constitute raw-data replication or independent expert
review.

Applied eleven review findings, including:

- Concentration-qualified melting midpoint and separate hairpin/duplex scope.
- Explicit torsional-rigidity units and clearer sequence-illustration language.
- The full loop-seq construct, fitted “intrinsic” score, library-normalization
  offset, and later adapter/overhang processing.
- Conditional Nipbl gene deletion and Hi-C map signals rather than an assertion
  about every individual chromosome; added acute-perturbation timing and
  formation-versus-maintenance qualifications.
- Explicit purified-protein versus cellular HP1 systems and a caution about
  adjusting for variables that may themselves be outcomes/intermediates.

Added Ke 2025 (S43), Gordiychuk 2026 (S44), and Popay 2026 (S45) as scoped primary
updates. The original dossier retains 45 sources; its extension register now
contains four, giving 49 combined. Retrieved Europe PMC/Crossref notice metadata
and exact-DOI searches identified no correction/retraction notice for the
original batch sources; this dated negative result is not proof that none
exists. Commentaries and later bias-processing work were not mislabeled as
formal corrections. Recent-source/preprint status distinctions are documented.

Internal source review is complete for the retained limited-scope claims, with
revisions applied. All articles remain editorial drafts; independent scientific
sign-off and publication decisions remain pending. The LINE-1/ERV boundary model
remains an unresolved hypothesis. No deployment or commit was performed.

Verification of the revised pages passed: TypeScript, final production build,
whitespace checks, review links/manifest consistency, and production-preview
browser checks. The latter covered all three revised articles, new text and
sections, citation targets, metadata, draft notices, preserved anchors, search
and combined filters/reset, and 1440/768/390/360 px layouts. No horizontal page
overflow or page exceptions were found. Desktop thermodynamics and mobile
evidence screenshots were inspected. These interface checks do not supply the
pending independent scientific sign-off.

## Update — 12 November 2026: ERE viral mimicry knowledge framework

The user supplied two local scientific documents for context and authorized this
work-log update after initially reserving the log for concurrent editing:

- `/Users/zbb2/Desktop/comprehensive_scientific_pathobiological_dossier-v3.md`
- `/Users/zbb2/Desktop/ere_viral_mimicry_knowledge_base.md`

Both documents were read in full. The user's subsequent focus is the biological
framework in the ERE knowledge base: **endogenous retroelement regulation and
viral mimicry as a framework for cellular homeostasis and disease**. The
bidirectional epigenome-editing constructs in the comprehensive dossier provide
downstream translational context; they are not the central website focus of
this update. This log remains the working record for the website.

### Central framework and proposed coverage

The supplied synthesis follows this proposed mechanistic chain:

**Loss of epigenetic repression → ERE expression → immunostimulatory nucleic
acids → innate sensing and stress responses → clearance, chronic inflammation,
or adaptive escape.**

Website research and future editorial planning should distinguish the steps in
that chain rather than treating ERE expression alone as proof of inflammatory
signaling or disease causation. Candidate coverage from the supplied documents
includes:

- CpG methylation, H3K9me3, and locus-specific control of LINEs, SINEs, and HERVs.
- Distinct RNA and DNA products and their proposed links to MDA5/MAVS, RIG-I,
  cGAS–STING, and PKR–eIF2α signaling.
- Acute immune surveillance versus persistent inflammatory signaling and
  adaptation to viral mimicry.
- The proposed relationship among ERE derepression, the integrated stress
  response, stress granules, and dysplastic morphology.
- Cell-state-specific ERE regulation in aging hematopoiesis and TET2-associated
  clonal competition, including the distinction between HSPCs and mature myeloid
  progeny.
- Disease-specific evidence in autoimmunity/interferonopathies, bone remodeling,
  neurodegeneration, and glioblastoma onco-exaptation.
- One-carbon metabolism as context for epigenetic maintenance, with its claims
  requiring the same source-level review as the other proposed mechanisms.

### Hypotheses and evidence boundaries

The supplied documents combine reported mechanisms with broader author-proposed
interpretations. In particular, dysplasia as a persistent viral mimicry–ISR
checkpoint, malignant progression through viral mimicry conditioning, an
immunological two-hit model, and EREs as an evolved multicellular security system
must remain explicitly labeled hypotheses pending claim-level assessment.
The structural/dominant-negative analogy and “retrotransposonpathies” terminology
are conceptual framing, not established genetic mechanisms or an adopted disease
classification.

Do not collapse all ERE families, loci, cell types, nucleic-acid species, or sensor
pathways into a single universal mechanism. Establish separately whether each
claim concerns association, experimental causation, evolutionary interpretation,
or a proposed therapeutic effect. The TET2 discussion specifically requires
separating protection of mutant HSPCs from inflammation in differentiated
progeny and from any proposed restoration of wild-type HSPC competitiveness.

The comprehensive dossier also proposes PZF–KRAB–DNMT3A/3L repression and
PZF–TET2 activation. Shared targeting motifs, functional construct dimensions,
locus selectivity, methylation-spread control, delivery, and durable efficacy
were not validated in this session. They must not appear as demonstrated platform
capabilities. The proposed therapeutic window—reducing chronic inflammation
while preserving responses to oncogenic stress—remains an experimental question.

### Work completed and next dependency

This update records document intake and editorial focus only. No independent
literature search, bibliography verification, full-text source audit, or scientific
validation was performed for these supplied documents. Their bibliographies
include preprints; the comprehensive dossier's “peer-reviewed” bibliography
heading does not establish peer-reviewed status for every entry.

Before incorporating this material into public website articles, map individual
claims to verified primary sources, check bibliographic identities and publication
status, distinguish supported findings from synthesis and hypotheses, and obtain
scientific review. No new article briefs or source identifiers were assigned;
the previously recorded roadmap and source counts remain unchanged by this
update. Only this work log was edited; no application code, public article,
deployment, or commit was produced.

## Update — 12 November 2026: reconcile the ongoing checklist

Created [TODO.md](TODO.md) as the current completion/next-action checklist and
linked it from this log, the research map, the library documentation, both
knowledge-library expansion plans, and the internal reading path. The worklog
continues to preserve historical session records rather than replacing them.

Marked batch 0 implementation and internal source-review revisions complete,
while leaving independent scientific sign-off, publication decisions, origins,
later batches, and the ERE source audit pending. Recorded the eleven-draft
library and 49 combined sources. Carried forward founder refinement, remaining
foundation rewrites, whole-library scientific review, and deferred reading-path
integration. The checklist names concrete outputs for the review handoff,
origins claim records, and ERE claim/source crosswalk; no reviewer was assigned
or contacted by this update.

Corrected the expansion plan's stale nine-entry baseline and completed batch 0
rows. Clarified that adding 06/26 alone does not finish the opening path:
transcriptional torque (15) still depends on topology/torque work in batch 3.
The ERE intake is tracked separately without treating supplied claims as
verified or silently changing the established 42-brief production order.

Document checks confirmed all 42 briefs appear exactly once in the checklist's
disposition table, the original/extension source counts are 45 + 4, and relative
links resolve. Whitespace checks passed. This was a documentation-only update;
no article production, new research, application change, deployment, or commit
was performed.
