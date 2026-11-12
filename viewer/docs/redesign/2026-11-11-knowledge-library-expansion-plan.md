# Knowledge Library expansion plan

Date: 2026-11-11

Status: Editorial and implementation planning draft

This is the November 11 planning snapshot with dated implementation notes.
Use the [current checklist](../../../docs/research/dark-genomics-2026-11-11/TODO.md)
for present completion states and next actions, including the subsequent
thermodynamics expansion and batch 0 internal source review.

## Objective

Develop the existing opening collection into a substantial, connected reference resource grounded in the material-channel perspective and informed by the founder's existing research and study materials.

This phase improves the article sequence, adds **Chromatin maintenance and epigenetic machinery**, and deepens existing articles. It also establishes a source-based roadmap for later expansion into repeat regulation, cellular phenomena, and evolution.

This document records the plan only. It does not change article order, website content, source documents, or deployment state.

## Agreed direction

- Move CpG distribution later in the collection.
- Introduce a foundational article on chromatin maintenance and epigenetic machinery.
- Use relevant material from `~/Desktop/Research/` and `~/Desktop/Molecular Pathology/MGP_Boards/` as editorial starting material.
- Connect articles to each other and to supported Polymer tool views.
- Keep guided experiences deferred.

Exact article subsections, illustrations, machinery examples, and follow-on articles below are proposed details to refine during drafting.

## Current baseline

The local library already has a landing page, text search, subject filters, eight short editorial drafts, static article routes, related reading, references, and links to tools. Content is stored in `viewer/src/content/library.ts`; presentation lives in `viewer/src/app/library/` and `viewer/src/components/library/`.

The current articles establish structure but are not complete treatments of their subjects. Their scientific review remains pending. Earlier interface/build checks do not constitute scientific validation.

## 1. Collection order and placement

The first expanded release will contain **eight main articles plus one methods entry**. Preserve the existing article slugs.

| Order | Article | Role | Main change |
| --- | --- | --- | --- |
| 1 | The material channel of the genome | Foundational perspective | Develop the definition and argument in the founder's voice, with explicit connections to the rest of the collection. |
| 2 | Base composition and GC content | Foundational concept | Expand from a fraction to a useful explanation of composition, scale, denominators, and genomic variation. |
| 3 | DNA thermodynamics | Physical foundation | Explain the quantities, sequence-order dependence, conditions, and limits of the models. |
| 4 | Sequence complexity and periodicity | Sequence organization | Distinguish base counts, short-word organization, repeats, and recurrence at a spacing. |
| 5 | Repeating and nonrepeating DNA | Genome organization | Explain major organizational distinctions, annotation limits, and connections to evolutionary history. |
| 6 | Isochores and compositional domains | Chromosomal landscape | Develop the relationship between compositional summaries, segmentation, and chromosome-scale interpretation. |
| 7 | Chromatin maintenance and epigenetic machinery | Cellular organization and maintenance | Add the new substantial article outlined below. Proposed slug: `chromatin-maintenance`. |
| 8 | CpG distribution and CpG islands | Focused connection between sequence and epigenetic context | Place after the chromatin introduction; distinguish CpG patterns, island definitions, and measured methylation. |
| Reference | Genomic coordinates and reference assemblies | Methods and reference | Keep directly searchable and accessible through a distinct reference grouping. |

This is a browsing order, not a prescribed reading sequence. Every article should stand alone, define its terms, and link to related explanations.

### Landing-page implications

- Retain the featured material-channel introduction.
- Display the eight main articles in the agreed order in the default collection view.
- Give methods entries a compact **Methods & reference** grouping rather than mixing coordinates into the main sequence.
- Search should continue to include both groups. Subject filtering should also preserve access to methods entries.
- Use an explicit collection role/order in content metadata if grouping would otherwise depend on a fragile array position. Avoid a general publishing-system rewrite.
- Add an **Epigenetics & chromatin** subject when its first article exists. Do not expose empty future categories.

## 2. Source inventory and intended use

Paths below identify local working materials. They are editorial leads, not substitutes for the underlying publications. This was a targeted review, not an exhaustive audit of the research library or boards collection.

| Local source | Strongest contribution | Treatment |
| --- | --- | --- |
| `~/Desktop/Research/deep molecular biology.docx` | Explanations of DNMT1/UHRF1 maintenance, chromatin repression, ERVs, and viral mimicry | Extract relevant passages into private working notes. Separate explanatory text from conversational prompts, design ideas, and proposed constructs. |
| `~/Desktop/Research/topics/molecular-biology/nucleosome-biology.md` | Structure, positioning, breathing, physical constraints, and references | Use foundational material after checking the papers. Reconcile computational claims with later model-status notes. |
| `~/Desktop/Research/topics/polymer-physics/dna-thermodynamics-and-mechanics.md` | Thermodynamics, geometry, persistence length, deformability, and physical terminology | Support the thermodynamics article and a later mechanics article; preserve distinctions among quantities and scales. |
| `~/Desktop/Research/topics/evolution/isochore-biology.md` | Compositional domains, historical framework, and reference leads | Develop the isochore article. Check thresholds and separate internal benchmark results from general biological claims. |
| `~/Desktop/Research/topics/epigenetics/methylation-biophysics.md` | Links between chemical modification and physical measurements/models | Primary working source for a later focused article; use only a concise connection in the introductory chromatin article. |
| `~/Desktop/Research/topics/epigenetics/methylation-gene-regulation.md` | Mechanism comparisons, regulatory context, and literature leads | Recheck experimental systems and quantitative interpretations; avoid generalizing one perturbation study to universal mechanism fractions. |
| `~/Desktop/Research/topics/molecular-biology/erv-heterochromatin-biophysics.md` | Heterochromatin machinery, repeat repression, viral mimicry, physical models, and open questions | Split foundational mechanisms, experimental findings, and original predictions into appropriate article sections or separate articles. |
| `~/Desktop/Research/topics/molecular-biology/retrotransposons-and-ervs.md` | Repeat families, resources, and integration ideas | Support repeat explanations and future data connections. Resource availability needs verification before public links are added. |
| `~/Desktop/Research/topics/physics/genome-as-medium.md` | Founder-oriented conceptual vocabulary and analogies | Input to the material-channel article. Preserve analogies as analogies and distinguish them from demonstrated mechanisms. |
| `~/Desktop/Molecular Pathology/MGP_Boards/content/25-pathway-syndromes.js` | Chromatin/cohesin machinery connected to specific genes and consequences | Use as an organizational lead for selected examples, rewritten for a foundational genomics audience. |
| `~/Desktop/Molecular Pathology/MGP_Boards/content/cdx-dossiers-10-heme.js` | Detailed EZH2/PRC2 mechanistic explanation | Candidate focused example after source checking; treatment and exam-specific material is not needed for the core article. |
| `~/Desktop/Molecular Pathology/MGP_Boards/content/09-cancer-syndromes.js` | SWI/SNF-related examples | Candidate sidebar or later machinery entry. Keep clinical detail subordinate to the molecular explanation. |

The boards material is strongest for specific gene/mechanism examples, not a complete chromatin-maintenance chapter. Replication-coupled chromatin restoration and histone chaperones need additional literature work.

### Revision notes that must travel with source material

Read these alongside the earlier research syntheses:

- `~/Desktop/Research/topics/biophysics/nucleosome-wrapping-model-revision.md`
- `~/Desktop/Research/topics/polymer-evolution/notes/2026-02-24-methylation-chromatin-expression-reframing.md`
- `~/Desktop/Research/topics/polymer-evolution/notes/2026-02-24-methylation-nucleosome-expression-evidence.md`
- `~/Desktop/Research/topics/polymer-evolution/notes/2026-02-24-methylation-mechanics-stacking-clarification.md`

The wrapping-model revision records poor empirical validation and a tabled model. Do not carry earlier predicted-occupancy claims into the library as established results or advertise those predictions as validated tools. A later date alone does not establish correctness; resolve disagreements against evidence and actual implementation state.

## 3. New article: Chromatin maintenance and epigenetic machinery

### Central question

**How do cells organize, alter, and restore chromatin while preserving the capacity to change state?**

The article should explain a dynamic system through clear mechanisms and illustrations. It should provide enough foundation for subsequent articles on CpGs, repeat repression, viral mimicry, and cellular identity.

### Proposed outline

| Section | Reader takeaway | Candidate content |
| --- | --- | --- |
| What is being maintained? | Chromatin organization includes several distinguishable features. | Nucleosomes, histone variants/modifications, DNA modifications, accessibility, and genomic context. Define state and avoid equating every chromatin feature with heritable memory. |
| The nucleosome as a physical substrate | Packaging involves molecular interactions, geometry, and dynamics. | Histone core, DNA wrapping, transient accessibility, and sequence-dependent contributions. |
| The machinery | Different kinds of activities should not be conflated. | Writers, erasers, readers, ATP-dependent remodelers, and chaperones. Use a compact activity/example/substrate table. |
| Replication and restoration | Copying sequence and restoring organization are distinct tasks. | Parental histone recycling, deposition of new histones, and restoration over time; explain the evidence and model system. |
| DNA methylation maintenance | Maintenance, establishment, and removal require separate explanations. | DNMT1/UHRF1; DNMT3A/3B; TET-associated pathways. Develop from verified sources rather than importing simplified notes verbatim. |
| Reinforcing and changing chromatin states | Selected systems illustrate recruitment, feedback, and context. | Choose a limited set from PRC2/Polycomb, H3K9-associated systems, SWI/SNF remodeling, and histone acetylation/deacetylation. |
| Connections to the material channel | Sequence properties and active cellular machinery are complementary explanatory layers. | Link composition and repeats to questions about organization; distinguish physical measurements, predictions, annotations, and cellular assays. |
| How the subject is studied | A reader can identify what an experiment actually measures. | A concise map of accessibility, histone-mark, methylation, and nucleosome assays, with links to future methods entries as they become available. |

Avoid turning the overview into an exhaustive enzyme catalog. Detailed enzyme families and disease mechanisms can become linked reference entries later.

### Proposed figures

1. **Chromatin across replication:** distinguish parental/new histones, DNA synthesis, and restoration processes. Label the image schematic and avoid depicting restoration as instant or identical for every mark.
2. **Machinery and substrates:** a compact diagram/table connecting activities to what is modified, recognized, moved, or deposited.
3. **Optional methylation-maintenance inset:** clarify parental and daughter strands and separate establishment from maintenance.

Build original diagrams using SVG or existing code-native visual conventions. Do not republish figures from course slides, books, or papers by default.

### Connections

- Incoming: repeats, isochores, material-channel perspective.
- Outgoing: CpG distribution, thermodynamics, and relevant methods.
- Future: methylation biophysics, repeat repression, viral mimicry, cellular identity.
- Tools: supported chromosome/browser views and gene pages for examples whose data are actually available. Verify each destination before adding it.

### Initial literature leads

These publications were identified during the initial evaluation; each claim still requires reading the relevant methods/results during drafting.

- [Bostick et al., 2007 — UHRF1 and maintenance methylation](https://pubmed.ncbi.nlm.nih.gov/17673620/).
- [Petryk et al., 2018 — MCM2 and parental histone inheritance](https://pubmed.ncbi.nlm.nih.gov/30115746/).
- [Reverón-Gómez et al., 2018 — parental histone recycling and restoration](https://pmc.ncbi.nlm.nih.gov/articles/PMC6202308/).
- [Luo et al., 2022 — methylation-dependent repression and TF binding](https://www.nature.com/articles/s41588-022-01241-6).

## 4. Develop the existing articles

Prioritize depth of explanation and useful illustrations over a uniform word count.

| Article | Editorial task | Figure/example |
| --- | --- | --- |
| Material channel | Replace placeholder editorial framing with the founder's definition, motivation, concrete questions, and boundaries. | One worked conceptual comparison showing what composition/order/physical context each contribute; no guided flow. |
| GC content | Expand denominators, ambiguous bases, windowing, scale, and interpretation. | Original composition profiles showing how window size affects a synthetic example. |
| Thermodynamics | Develop free energy, melting, model conditions, sequence order, and distinctions from bending mechanics. | Clearly labeled comparison of quantities; modeled examples only with documented assumptions. |
| Complexity and periodicity | Explain what each metric preserves or loses; distinguish complexity from randomness and function. | Extend the existing same-composition/different-order illustration. |
| Repeating/nonrepeating DNA | Expand tandem/interspersed distinctions, classification, reference coverage, and evolutionary connections. | Original repeat-organization diagram. |
| Isochores | Explain historical concepts, modern representations, thresholds, segmentation, and disagreement. | Windowed composition versus a stated segmentation scheme, using a labeled illustrative example or documented data. |
| CpG distribution | Connect the later placement to established vocabulary; expand pattern versus annotation versus measurement. | Separate dinucleotide occurrence, island call, and sample-specific measurement in a simple schematic. |
| Coordinates | Retain a concise, reliable reference; expand only where needed for actual tool use. | Keep the coordinate-convention comparison. |

## 5. Follow-on expansion

Draft these after the foundation and chromatin overview are coherent. The order can change according to source readiness.

| Candidate article | Existing base | Additional work |
| --- | --- | --- |
| Nucleosome positioning and DNA mechanics | Nucleosome and physical-property notes | Reconcile model revisions; explain experimental versus predicted occupancy and scale dependence. |
| DNA methylation and material properties | Methylation-biophysics notes | Check the conditions, sequences, measurement scales, and direction of reported effects. |
| Repeat repression and heterochromatin | ERV/heterochromatin synthesis | Keep cell-type/family differences explicit; distinguish hypotheses from observed mechanisms. |
| Viral mimicry and nucleic acid sensing | ERV synthesis and deep molecular biology document | Build a primary-source account with defined triggers, sensors, responses, and experimental context. |
| Integrated stress response | Some adjacent cellular material found, but no dedicated source chapter established in this review | Perform a focused source inventory and literature review; do not infer that viral mimicry and ISR are the same pathway. |
| Genomic evolution, phylogeny, and cladistics | Evolution notes provide some leads | Establish a dedicated source base and distinct article scopes before drafting. |

These entries belong in the editorial roadmap until useful content exists. Do not publish placeholder articles or empty subject categories.

## 6. Source-to-article workflow

For each article:

1. Create a short brief: central question, scope, required concepts, relevant tools, and proposed figures.
2. Record local source paths and useful sections in a private editorial inventory. Keep local paths out of public article content.
3. Build a claim/source table containing the claim, original publication, study system, measurement/model type, relevant conditions, and any conflicting evidence.
4. Resolve contradictions and superseded internal interpretations before drafting.
5. Write an original explanation. Retain local notes as background, not automatically as public prose.
6. Add section-level citations and original illustrations.
7. Review scientific meaning, teaching clarity, and founder-specific framing separately.
8. Check links, article metadata, navigation, layout, and accessibility before release.

Use actual authorship/review status and meaningful revision dates. Do not mark a draft reviewed merely because its citations or interface were checked.

## 7. Implementation sequence and reviewable outcomes

| Milestone | Deliverable | Completion evidence |
| --- | --- | --- |
| A. Editorial inventory | Briefs, source mapping, and unresolved claims for the first collection | Each main article has an identified purpose, starting sources, and review needs. |
| B. Collection organization | Revised order, separate methods grouping, chromatin subject | CpG appears later; methods remain searchable; existing URLs remain valid. |
| C. Chromatin article | Full draft, verified references, first original diagram, related links | The article explains maintenance and machinery coherently without depending on future articles. |
| D. Foundation revision | Material-channel article refined with founder input; GC and thermodynamics deepened | These three provide a clear intellectual and technical foundation. |
| E. Remaining opening articles | Revised complexity, repeats, isochores, CpG, and coordinates entries | Cross-links, terminology, references, and figures are consistent across the collection. |
| F. Release review | Content review plus interface/build verification | Draft/review states are accurate; type/build checks and relevant browser checks pass. |
| G. Next collection | Scoped briefs for selected follow-on subjects | Source readiness, missing research, and dependencies are explicit. |

These are incremental review points, not repeated permission gates. Future implementation can proceed within the scope authorized by the user. Publication remains separate from this planning work.

### Likely implementation touchpoints

- `viewer/src/content/library.ts`: content, subjects, collection placement, and related references.
- `viewer/src/components/library/LibraryDirectory.tsx`: display order/grouping while retaining combined search and subject filters.
- `viewer/src/components/library/LibraryFigure.tsx`: original illustrations.
- `viewer/src/app/library/page.tsx`: landing-page collection composition.
- `viewer/src/app/library/[slug]/page.tsx`: any article-format additions required by the content.
- `viewer/src/app/library/library.css`: scoped presentation changes.
- `viewer/public/sitemap.xml`: new article URL.
- `viewer/docs/knowledge-library.md`: editorial and implementation documentation.

Keep the current lightweight content architecture unless actual drafting requirements reveal a concrete limitation. No CMS, accounts, graph database, renderer rewrite, or new genomics analysis is required for this expansion.

## 8. Validation and scope boundaries

- Check reordered and grouped results with no filters, text search, a subject filter, and combined filters.
- Verify existing slugs, the new chromatin route, section anchors, references, related reading, and real tool destinations.
- Inspect long-form content, diagrams, tables, and navigation on desktop and mobile, including keyboard access and text alternatives.
- Run `npx tsc --noEmit`, `npm run build`, and whitespace checks after code changes. Revalidate quantitative examples if added.
- Keep scientific/editorial review distinct from software checks.
- Do not alter research notes, boards content, or source assets as part of adapting material to Polymer.
- Course PDFs and third-party resources are research leads; their presence on the computer does not by itself establish permission to republish their text or figures.
- Broader browser, gene-search, gene-page analysis, and chromosome-layout work remains in the separate resource-center plan.
- Guided experiences remain deferred.

## Immediate next implementation unit

Prepare the chromatin article brief and claim/source table, then implement the revised collection organization and the new article draft with its first original schematic. This produces a concrete review of the expansion without waiting for every follow-on subject.

## Initial implementation record — 2026-11-11

The first implementation unit is complete locally: revised collection order,
separate methods grouping, the chromatin article draft and subject, an original
schematic, a machinery table, primary references, related links, and its internal
brief/claim-source table. See [implementation notes](../knowledge-library.md)
and [editorial brief](../editorial/chromatin-maintenance-brief.md).

Build, TypeScript, whitespace, and relevant browser/layout checks passed. This is
not completion of the entire editorial expansion: founder review, fuller rewrites
of the existing foundation articles, scientific review, and later collections
remain. No publication or deployment occurred.

### Composition article expansion — 2026-11-11

The GC-content and isochore entries have now been expanded locally with primary
references, original interactive window/classification figures, exact-value
tables, and direct chromosome/browser connections. See the
[editorial source and numerical record](../editorial/gc-and-isochores-brief.md).
Numerical, type/build, browser, and responsive-layout checks passed; scientific
review remains pending. Founder refinement of the material-channel introduction,
the fuller thermodynamics article, other foundation rewrites, and later
collections remain future work.

### Subsequent progress — 2026-11-12

The fuller thermodynamics draft is now implemented and internally source-reviewed
as part of dark-genomics batch 0, alongside the new mechanics and evidence
references. The earlier statement that thermodynamics is future work describes
the November 11 snapshot. Independent scientific sign-off remains pending.
Founder refinement and remaining foundation rewrites are carried forward in the
current checklist; they have not been marked complete.
