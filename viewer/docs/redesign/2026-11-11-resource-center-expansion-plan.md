# Polymer resource center expansion plan

Date: 2026-11-11

Status: Planning draft; application changes are not authorized by this document.

## Purpose

Develop Polymer into a public genomics resource center with a compelling, coherent interface across the knowledge library, digital karyotype, chromosome pages, genome browser, and individual gene pages.

The long-term vision is a genomics nonprofit. This describes the intended mission and direction, not a statement about current legal or organizational status.

The intellectual center is the **material channel of the genome**: an organizing perspective emphasizing composition, physical properties, sequence organization, and their relationships to cellular phenomena and evolutionary history. The precise definition should be developed with the founder before being presented as a settled framework.

The browser and digital karyotype remain the fundamental exploration tools. The knowledge library should explain concepts and connect to those tools; the tools should provide relevant paths back into the library.

## Confirmed priorities and boundaries

- Add a Knowledge Library tab to the site's navigation in an upcoming implementation phase.
- Improve gene search comprehensiveness in both the browser and digital karyotype.
- Improve the analysis available on individual gene pages.
- Improve individual chromosome pages, with denser gene labeling and a more compact, legible, compelling layout.
- Connect articles, genes, chromosomes, and browser views through useful contextual links.
- Record further browser changes after the user describes them.

**Guided experiences are deferred.** Do not include tours, sequenced lessons, or guided exploration flows in this phase.

This document authorizes no application changes, new data ingestion, deployments, or organizational setup. Detailed features below are proposals unless explicitly listed as confirmed priorities.

## Current implementation: planning baseline

These observations come from a limited source review, not a live production or scientific validation audit.

| Area | Existing entry points and implementation | Planning implication |
| --- | --- | --- |
| Shared navigation | `viewer/src/components/BrandBar.tsx`; `viewer/src/config/platformNavigation.ts` | Add the library consistently to the existing navigation system. |
| Digital karyotype | `/genomics/atlas`; `viewer/src/components/atlas/GeneSearch.tsx` | Atlas search already exists; improve its coverage and behavior rather than introducing a parallel search service. |
| Browser search | `viewer/src/components/HeaderBar.tsx` | Preserve existing region and probe lookup while improving gene resolution. |
| Search service | `src/polymer_genomics/routers/search.py`; `viewer/src/lib/api.ts` | Both interfaces use `/v1/search`; improvements need coordinated backend and frontend work. |
| Gene pages | `/genomics/gene/[build]/[symbol]`; `GeneProfile.tsx`, `GeneProfileData.ts`, `GeneProfileVisualizations.tsx`, `GeneProfileSectionsLP.tsx` in `viewer/src/components/atlas/` | Build on existing transcript, composition, protein/cost, constraint, abundance, atlas, pathway, and gene-set sections. |
| Chromosome pages | `/genomics/atlas/[chr]`; `HighResChromosome.tsx`; chromosome facts/features configuration | Improve the existing chromosome presentation and labeling model. |

The search endpoint currently combines symbol-prefix and alias-prefix results, deduplicates by symbol, and caps the returned list at 20. Its `total` is the returned count, not an exhaustive match count. Full-name and stable-identifier search are not implemented in this endpoint.

The chromosome illustration currently uses curated notable genes and positions their labels through cytoband information. Adding more labels therefore requires reviewing both coverage and positional accuracy, not just reducing label spacing.

The gene profile currently includes transcript-selection heuristics and a whole-gene sequence branch limited to genes of at most 100 kb. Audit their effects before expanding sequence-derived analyses or describing a selected transcript as canonical.

## Workstream 1: Knowledge Library

### Role and scope

Create a durable place for fundamental molecular genomics knowledge, with the material-channel perspective connecting subjects across scales. The library should be useful for direct reference and sustained reading, without requiring a prescribed learning sequence.

Proposed subject organization:

| Domain | Initial subject coverage |
| --- | --- |
| Composition | Base composition, GC content, CpG distribution, isochores, complexity, periodicity |
| Organization | Repeating and nonrepeating DNA, repeat classes, chromosomal organization |
| Physical properties | Thermodynamics, stability, geometry, topology, mechanics |
| Cellular phenomena | Integrated stress response, viral mimicry, nucleic acid sensing, epigenetic regulation |
| Evolution | Genomic evolution, comparative genomics, phylogeny, cladistics, repeat and endogenous viral histories |
| Methods | Measurements, annotations, computational assumptions, reference assemblies, evidence interpretation |

These are editorial groupings, not rigid boundaries. Articles may connect to several domains. Do not imply that every cellular phenomenon is explained by a single framework.

### Proposed first release

- A visible **Knowledge Library** navigation destination; exact label and route remain provisional.
- A library landing page with a clear introduction, subject groupings, and available articles.
- A reusable article format: definition or premise, explanation, figures when useful, related concepts, relevant tools/data, references, authorship, and revision date.
- Explicit distinction between established knowledge, model-derived interpretation, and original Polymer hypotheses where applicable.
- A small, coherent opening collection around composition and genome organization. Broader domains can be represented in the editorial plan without publishing empty destinations.

Candidate opening articles include the material channel, GC composition, CpG distribution, isochores, repeating/nonrepeating DNA, sequence complexity, and an introduction to DNA thermodynamic quantities. Final titles and publication order are undecided.

Keep educational content separate from API documentation and tool methodology, while linking between them. Article licensing and contribution/review policy require an explicit decision before public publication; do not assume upstream data licenses also cover original editorial content.

### Completion criteria

- The library is accessible through shared navigation on desktop and mobile.
- Published articles are readable, directly addressable, and connected to relevant resources.
- Sources and interpretive status are clear.
- Links lead to existing content and supported tool states.
- No guided experience is required to use the library.

## Workstream 2: Comprehensive gene search

### Desired behavior

Someone should be able to find a gene using familiar terminology and understand which gene, assembly, and location a result refers to. Browser and atlas search should share resolution behavior while retaining appropriate destinations.

### Proposed search coverage

Prioritize approved symbols, aliases, previous symbols, full gene names, and stable gene identifiers, subject to the available source data. Transcript identifiers are a separate extension to assess rather than an assumed first-release capability.

Support noncoding genes as well as protein-coding genes. Define coverage against the selected annotation and assembly; do not promise exhaustive coverage without auditing those sources.

Proposed result behavior:

- Rank exact approved symbols and identifiers first; rank exact aliases ahead of broad prefix or descriptive matches.
- Show the approved symbol, full name where available, chromosome/location, and why an alias matched.
- Make ambiguous matches visible instead of silently choosing a locus.
- Identify the active assembly and preserve it through navigation.
- Clearly distinguish no match, unavailable data, and request failure.
- Indicate additional results through a deliberate result-limit or pagination policy. Do not label a capped result count as a complete count.
- Preserve keyboard operation, visible focus, and predictable selection.
- Prevent older requests from overwriting results for a newer query.

For each surface, decide the primary action explicitly: navigating within the browser, opening the gene page, or locating the gene in the atlas. A secondary action may provide the other destination without making selection ambiguous.

Audit backend fields, alias coverage, indexing, ranking, and response shape before settling the interface. Reuse shared search logic where practical; the two interfaces need not have identical layouts.

### Completion criteria

- A representative query set covers exact symbols, aliases, previous symbols, full names, stable IDs, ambiguous inputs, noncoding genes, and missing results.
- Both interfaces resolve the same identity consistently for the same assembly.
- Rapid typing and keyboard selection behave reliably.
- Existing browser coordinate and probe lookup continue to work.

## Workstream 3: Richer individual gene analysis

### Desired behavior

A gene page should present a clear identity, interpretable analysis, and genomic context. Improving analysis means improving correctness, coverage, explanation, and useful comparisons as well as considering new calculations.

### First: audit existing analyses

- Inventory current sections, data sources, units, assumptions, and coverage limits.
- Review transcript selection, strand handling, CDS assembly/translation, overlapping features, and sequence-length limits.
- Separate calculations that require coding sequence from those applicable to noncoding genes.
- Identify calculations that are skipped because an unrelated dataset is unavailable.
- Distinguish missing data, unsupported analysis, request failure, and valid zero values.
- Label reference-derived values and tissue/cell-context measurements appropriately.

### Proposed analytical directions

| Area | Candidate improvement |
| --- | --- |
| Identity and structure | Clear gene identity, biotype, assembly, coordinates, strand, and explicit transcript selection |
| Composition | Better comparison of whole-gene, exon, intron, CDS, and defined flanking regions where supported |
| Material properties | Add or improve sequence-derived profiles with visible methods, units, and window definitions |
| Genomic context | Show available repeat, CpG, isochore, and regulatory context with the queried interval made explicit |
| Functional context | Improve interpretation of existing protein, pathway, expression/abundance, and constraint sections |
| Comparisons | Use suitable reference distributions only when the comparison population and computation are defined |

These are candidates for prioritization, not a commitment to implement every analysis. Dataset availability and scientific review determine which are suitable.

### Presentation and completion criteria

- Compact identity summary followed by clearly organized analysis sections.
- Useful plots with readable scales, legends, definitions, and sources.
- Relevant links to chromosome context, the browser, and library explanations.
- Partial data failures do not make the whole page unusable.
- Validation includes a long gene, a noncoding gene, a negative-strand gene, multiple transcripts, and incomplete ancillary data.
- New quantitative analyses receive method-specific validation against independent expectations or a trusted reference before release.

## Workstream 4: Better individual chromosome pages

### Desired behavior

Present each chromosome as an information-rich overview that remains compact and easy to scan. Increase useful gene-label density while making relationships between labels and genomic positions trustworthy.

### Layout proposals

- Bring chromosome identity, assembly, key statistics, navigation, and the main visualization into a tighter opening layout.
- Reduce excessive padding, repetitive headings, and fragmented panels before reducing text size.
- Coordinate chromosome graphics, gene information, and summary analyses in a coherent desktop layout.
- Keep composition, architecture, and available analyses visible without overwhelming the central chromosome view.
- Reflow deliberately on narrow screens; preserve readable labels and access to details.

### Gene-label proposals

- Expand beyond the current notable-gene list through an explicit selection/coverage policy.
- Prefer annotation-derived gene coordinates for precise anchors; distinguish any retained cytoband-level approximations.
- Use collision-aware placement and capacity limits. More labels must not create misleading positions or overlapping text.
- Consider compact symbol-only labels with secondary detail on focus/selection, additional label lanes, or a density control. Choose the simplest effective design after visual review.
- Show the selected/searched gene clearly, including when it would otherwise be omitted from the overview.
- Connect labels to gene pages and provide a clear route into the local browser region.
- State when displayed genes are a selection. Dense labeling does not imply an exhaustive gene map.

### Completion criteria

- Side-by-side review shows more useful labels than the current page at comparable viewport sizes.
- Representative large, small, gene-rich, and gene-poor chromosomes remain legible; X, Y, and mitochondrial presentation are reviewed appropriately.
- No clipped labels, confusing leader lines, or accidental horizontal page overflow.
- Dense clusters have a deliberate overflow behavior.
- The page uses space more efficiently without depending on tiny typography.
- Exact density targets are set after baseline screenshots and a prototype, not invented in advance.

## Workstream 5: Browser changes to be specified

Gene search and contextual links are included above. Other browser changes remain pending the user's description.

Record future requirements here before scheduling implementation:

| Requirement | Current behavior/problem | Desired behavior | Dependencies | Validation |
| --- | --- | --- | --- | --- |
| Pending user discussion | — | — | — | — |

Do not infer a renderer rewrite, new tracks, new controls, or changed interaction behavior from this placeholder.

## Connections across applications

Use direct, contextual navigation rather than guided flows:

| Source | Destination | Context to preserve |
| --- | --- | --- |
| Article | Browser | Assembly, supported region, relevant available tracks |
| Browser track or metric | Library/methods | Meaning of the selected annotation or quantity |
| Chromosome gene label | Gene page | Gene identity and assembly |
| Gene page | Chromosome page | Parent chromosome; selected-gene state if implemented |
| Gene page | Browser | Gene interval, assembly, useful available layers |
| Chromosome page | Library | Concepts relevant to the displayed composition or architecture |

Audit existing routes and state handling before introducing new URL conventions. Do not silently substitute assemblies or drop context. No new graph database is required by this plan; curated relationships are a reasonable starting point.

## Proposed implementation order

1. **Baseline and decisions:** capture current screenshots/behavior; inventory search coverage and gene analyses; choose the initial library scope and chromosome layout direction.
2. **Library foundation:** create navigation, landing page, article structure, and the first publishable content. This can proceed independently of backend search work once scoped.
3. **Search improvements:** coordinate data coverage, API behavior, and both interfaces; validate identity and navigation consistency.
4. **Chromosome improvements:** improve layout and labeling using the agreed coverage policy and trustworthy coordinates.
5. **Gene-page improvements:** resolve correctness/coverage limitations, then add the selected analytical and presentation improvements.
6. **Cross-application review:** verify contextual links, assemblies, accessibility, responsive layouts, and partial-data behavior.
7. **Additional browser work:** schedule after requirements are described; it may move earlier if those requirements become prerequisites.

This is a dependency-aware proposal, not a fixed delivery schedule. Search and gene identity are shared foundations for chromosome labels and gene pages.

## Decisions still open

- Final library name, URL, opening articles, and editorial review process.
- Precise public definition of the material channel.
- Search data sources, identifier coverage, result ranking, and primary destination on each surface.
- Which gene analyses should be prioritized after the existing-analysis audit.
- Chromosome layout direction and gene-selection/density policy.
- Additional browser requirements.

## Review and release expectations

Each implementation phase should produce a concrete reviewable result before publication. Validate changed scientific calculations, search behavior, contextual links, desktop/mobile layouts, and relevant accessibility behavior. Run the project's applicable type/build checks when code changes occur.

Do not treat this planning document as evidence that a feature, data source, scientific calculation, or production workflow has been validated. No deployment is initiated by this plan.
