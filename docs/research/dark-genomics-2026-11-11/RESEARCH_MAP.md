# Dark genomics: the physical origins and continued existence of genomes

Research and editorial development dossier · Created 11 November 2026 · Updated 12 November 2026 · Draft, awaiting scientific review

Current implementation progress and next actions are maintained in [TODO.md](TODO.md)
and the [worklog](WORK_LOG.md). This dossier preserves the research briefs and
original source IDs; it is not the current production-status checklist.

## The proposed intellectual center

**How did chemistry become a heritable, repairable, physically organized genome—and how does that genome continue to exist?**

This collection would explain genomes as molecular systems with evolutionary histories. Sequence supplies both templates and physical substrates; proteins, RNA, water, ions, energy supply, and cellular organization determine what those substrates do. Evolution changes the whole coupled system over generations.

“Dark genomics” is an editorial working term here, not a standardized discipline. It should identify a question or limitation, rather than imply that unannotated DNA contains a single hidden code. Four distinct kinds of darkness deserve separate treatment:

| Kind | What is missing? | Example | What could reduce it? |
| --- | --- | --- | --- |
| Observational | Reliable access to sequence or molecular state | Repetitive centromeric arrays; transient DNA structures | Complete assemblies, orthogonal structural assays, improved single-molecule measurements |
| Mechanistic | A causal account | Why a particular region recruits or excludes a complex | Controlled perturbations, biochemical reconstitution, time-resolved measurement |
| Historical | A supported reconstruction | How genetic polymers and chromosome systems emerged | Comparative genomics, phylogenetics, geochemistry, experimental chemistry |
| Theoretical | An adequate model linking scales | How local mechanics contributes to a chromosome-scale phenotype | Explicit assumptions, parameter measurements, competing models, out-of-sample tests |

Noncoding, repetitive, unassembled, evolutionarily unconstrained, and functionally unexplained are not synonyms. Biochemical activity is also different from a demonstrated contribution to organismal fitness. The article program should make these distinctions useful to readers.

## Relationship to Polymer

The project README frames Polymer as a database of DNA material properties alongside biological annotations. The existing library and its November 11 expansion plan already introduce composition, thermodynamics, sequence organization, repeats, isochores, chromatin maintenance, and CpGs. This dossier extends that foundation toward origins, topology, nonequilibrium organization, evolutionary construction, and the limits of observation.

Local context examined: `README.md`, `paper_framing.md`, `viewer/docs/knowledge-library.md`, the November 11 knowledge-library expansion plan, and selected Research notes on polymer foundations, DNA as a medium, nucleosome-model revision, and obelisks. This was targeted context reading, not a complete repository or research-library audit.

The strongest continuity with Polymer is **the sequence–material–cellular-context relationship**. Avoid claiming that physics replaces sequence biology: protein recognition, sequence-specific recruitment, RNA, ATP-dependent machinery, and selection are parts of the physical explanation.

Existing notes are leads, not validated evidence. In particular, `Research/topics/biophysics/nucleosome-wrapping-model-revision.md` records poor empirical performance and a tabled occupancy model. Its statements that other layers remain sound are internal assessments, not independently established by this literature search. Do not republish the failed occupancy predictions as validated measurements.

## Research scope and source status

This is a broad, targeted scoping search, not a systematic review or an exhaustive search of every publication through the dossier date. Searches covered primary papers on origins, DNA thermodynamics and mechanics, topology, non-B structures, chromatin, genome evolution, assembly, and RNA discovery. The source register records 45 primary research/theory papers identified through publisher, PubMed, PMC, or institutional records.

Verification depth varies: titles, identities, and relevant findings were checked using accessible records and search excerpts; selected full-text passages were available. Some publisher pages redirected to access controls and some PMC opens encountered browser challenges. No claim of complete full-text or supplementary-methods review is made. Before public drafting, read the full paper and relevant supplement, check corrections and later challenges, and attach citations to individual claims.

“Established” below applies to the narrow mechanism described, not every proposed extension. “Model” means an explicit theoretical construction. “Open” means the historical or general explanation remains unresolved. Proposed connections between papers are editorial synthesis unless attributed to an experiment.

## Forty-two producible segments

Each entry supplies a question, a defensible direction, a boundary, and an original visual idea. Sources refer to the linked register below. These are briefs, not finished scientific articles.

### A. Before there were genomes

**01 · What must a molecule do to become hereditary?**

- **Question:** When does persistent chemistry become a system capable of cumulative evolution?
- **Treatment:** Separate molecular persistence, templated copying, variation, differential reproduction, and compartment-level inheritance. Compare a long-lived molecule with a lineage of copied molecules.
- **Status/boundary:** Conceptual foundation and models. No single experiment reconstructs the entire transition.
- **Visual:** A dependency diagram from chemistry to evolving populations. **Sources:** S03–S05.

**02 · Making the alphabet before making the book**

- **Question:** Where could nucleotide building blocks have come from?
- **Treatment:** Use activated pyrimidine synthesis and mixed RNA/DNA precursor chemistry as concrete experiments. Explain reaction networks, activation, selectivity, and environmental compatibility.
- **Status/boundary:** Demonstrated laboratory pathways; historical occurrence and connected geochemical scenarios remain open. Avoid collapsing nucleosides, nucleotides, and polymers into one accomplishment.
- **Visual:** Separate precursor synthesis, activation, polymerization, and copying stages. **Sources:** S01–S02.

**03 · The RNA world is a family of hypotheses**

- **Question:** How could a polymer combine information storage and catalysis?
- **Treatment:** Explain ribozymes, RNA polymerase activity, and RNA-catalyzed evolution of another catalytic RNA. Compare RNA-first and mixed-polymer possibilities.
- **Status/boundary:** Laboratory catalytic evolution supports feasibility, not a complete account of the first life. S03 used experimental handling and amplification steps; it did not create an autonomous self-reproducing RNA organism.
- **Visual:** Replication/evolution cycle with human-assisted steps marked. **Sources:** S02–S03.

**04 · Why copying fidelity constrains genome size**

- **Question:** How much sequence can a copying system preserve?
- **Treatment:** Introduce per-site accuracy q, length L, and the elementary independent-error approximation q^L for an error-free copy. Then explain selection, neutral networks, complementation, and compartments.
- **Status/boundary:** A model-dependent constraint. Do not present an Eigen threshold as one universal genome-size constant or equate every sequence error with loss of function.
- **Visual:** Curves of q^L, explicitly labeled illustrative. **Sources:** S03–S04.

**05 · Why the genome needed a boundary**

- **Question:** How does a compartment link a catalyst's benefit to its own lineage?
- **Treatment:** Explain retention, nutrient permeability, copying chemistry, and competition among protocells. Use fatty-acid vesicles as an experimental system.
- **Status/boundary:** Compatibility of selected copying reactions and membranes was demonstrated. S05 used a model genetic polymer and designed substrates; it did not show spontaneous production of modern DNA or complete protocell reproduction.
- **Visual:** Molecules that enter, products that remain, and coupled processes still missing. **Source:** S05.

**06 · Why DNA? The transition to a different genetic archive**

- **Question:** Why do cellular lineages store their principal genomes in DNA?
- **Treatment:** Separate chemical durability, division of molecular labor, precursor chemistry, repair, and the evolution of enzymes. Examine RNA-to-DNA takeover and mixed-polymer scenarios as alternatives.
- **Status/boundary:** Historical synthesis with open transitions. Modern advantages of DNA do not prove the route by which DNA originated. A dedicated primary-source expansion on ribonucleotide reductases, reverse transcription, and DNA repair is required before drafting.
- **Visual:** Competing transition scenarios rather than a single asserted timeline. **Sources:** S02–S03; additional mechanistic sources required.

**07 · The genetic code: chemistry, history, and error costs**

- **Question:** Why these codon assignments?
- **Treatment:** Compare error-cost calculations with historical contingency and possible chemical constraints. Explain that a genetic code links codons to amino acids through cellular translation machinery.
- **Status/boundary:** Computational evidence for error minimization depends on the cost function and null code ensemble. It does not establish a globally optimal code or identify its unique history.
- **Visual:** A small codon-neighbor graph with explicitly chosen error costs. **Source:** S31.

**08 · LUCA was already downstream of life's origin**

- **Question:** What can comparative genomes reconstruct about early life?
- **Treatment:** Distinguish the last universal common ancestor from the first replicator, the first cell, and the last eukaryotic common ancestor. Explain ancestral reconstruction and horizontal-transfer complications.
- **Status/boundary:** Model-based historical inference. Age, gene-content, ecology, and physiology estimates depend on datasets and assumptions; avoid a settled portrait.
- **Visual:** A branching history with uncertainty bands and earlier unresolved stages. **Source:** S06.

### B. What DNA physically is

**09 · DNA exists in water and ions**

- **Question:** Why is naked sequence insufficient to specify material behavior?
- **Treatment:** Explain the charged backbone, counterions, hydration, screening, and DNA–DNA interactions. Use osmotic-stress experiments on condensed DNA to show that the solvent participates in the system.
- **Status/boundary:** Physical effects are measurable; experimental salt and condensing-ion conditions matter. Avoid treating properties measured in a condensed array as universal nuclear constants.
- **Visual:** One sequence under several explicitly stated solution conditions. **Source:** S30.

**10 · The double helix is a fluctuating ensemble**

- **Question:** What does it mean for DNA to have a structure while continually moving?
- **Treatment:** Connect thermal fluctuations, strand association, local geometry, and force/torque responses. Introduce free-energy landscapes and distinguish thermodynamics from rates.
- **Status/boundary:** Broad physical foundation. A static structural representation and an equilibrium free energy do not specify all transition times.
- **Visual:** A schematic ensemble beside a free-energy diagram, with no invented biological numerical scale. **Sources:** S07–S08.

**11 · Why sequence order matters beyond GC content**

- **Question:** How can equal-composition sequences behave differently?
- **Treatment:** Explain nearest-neighbor duplex thermodynamics and sequence-dependent shape. Compare sequences with equal base counts but different neighbor arrangements.
- **Status/boundary:** Established contributions under defined models. SantaLucia nearest-neighbor terms are effective duplex thermodynamic parameters, not direct measurements of isolated stacking or bending stiffness.
- **Visual:** Equal-composition sequences with dinucleotide counts and condition-labeled predictions. **Sources:** S07, S09.

**12 · Bending, twisting, stretching, and melting are different**

- **Question:** What does “DNA stability” actually mean?
- **Treatment:** Give each quantity a definition, unit, measurement, and scale. Explain persistence length versus short-fragment cyclizability and local deformation.
- **Status/boundary:** Established distinctions; numerical values depend on sequence and conditions. Do not convert a melting free energy into a bending modulus or apply a long-chain fit indiscriminately at base-pair scale.
- **Visual:** Four separate experiments on the same molecular cartoon. **Sources:** S07–S10.

**13 · DNA shape is part of molecular recognition**

- **Question:** How does a protein recognize more than letter identity?
- **Treatment:** Connect minor-groove geometry, electrostatics, direct contacts, and deformability. Explain shape readout as one component of recognition.
- **Status/boundary:** Supported structural mechanism. Sequence-based shape predictions are predictions; they do not establish binding, accessibility, or affinity in every cell.
- **Visual:** Contact chemistry and groove geometry in one schematic binding site. **Source:** S09.

**14 · A helix can store torsional stress**

- **Question:** Why does turning DNA change what it can do?
- **Treatment:** Introduce linking number, twist, writhe, plectonemes, and torsional constraints. Explain Lk = Tw + Wr for closed ribbon geometry with appropriate definitions.
- **Status/boundary:** Established mathematics and single-molecule mechanics. Linear DNA requires specified boundary/closure conventions; a TAD is not automatically a sealed topological domain.
- **Visual:** Underwinding partitioned between twist and writhe. **Sources:** S08, S11–S12.

**15 · Transcription changes the material it reads**

- **Question:** Can reading a gene mechanically affect its surroundings?
- **Treatment:** Develop the twin-supercoiled-domain model, its experimental testing, and the role of rotational drag, constraints, and topoisomerases.
- **Status/boundary:** Model plus bacterial experimental evidence. Extension to a particular mammalian locus needs direct measurements; do not assert unrestricted long-range torque communication.
- **Visual:** Polymerase, positive and negative torsion, and alternative relaxation routes. **Sources:** S11–S12.

**16 · The other DNA structures**

- **Question:** When can DNA depart from the canonical duplex?
- **Treatment:** Use G-quadruplex and i-motif detection as anchor examples; explain dependencies on sequence, ions, pH, cell cycle, and molecular context. Place Z-DNA, triplexes, and cruciforms on a subsequent source-expansion list.
- **Status/boundary:** Cellular detection supports formation in studied systems. Motif presence, in-vitro folding, in-cell occupancy, and demonstrated biological function are four different claims.
- **Visual:** Evidence ladder from motif to functional perturbation. **Sources:** S13–S14.

**17 · R-loops connect an RNA product back to its template**

- **Question:** How can transcription leave a three-stranded structure?
- **Treatment:** Define an RNA–DNA hybrid plus displaced DNA strand. Explore CpG-island promoter observations and possible regulatory and stability consequences.
- **Status/boundary:** Formation and genomic associations are experimentally supported. Neither every R-loop is damaging nor every observed association causal. Discuss RNase H controls and detection specificity before quantitative claims.
- **Visual:** R-loop formation and resolution, with association separated from mechanism. **Source:** S15.

### C. How chromosomes keep existing

**18 · The nucleosome is a physical compromise**

- **Question:** How does DNA become compact while remaining usable?
- **Treatment:** Explain histone–DNA contacts, DNA wrapping, energetic cost, sequence contributions, and remodeling. Use the core structure as an anchor rather than implying it captures all dynamics.
- **Status/boundary:** Core architecture established; genomic positioning depends on additional processes. Polymer's tabled occupancy model is not evidence for reliable prediction.
- **Visual:** Contacts, deformation, and machinery as separate contributions. **Sources:** S10, S16.

**19 · Chromatin is maintained with energy and turnover**

- **Question:** Why does the same DNA adopt different cellular states?
- **Treatment:** Distinguish sequence preferences from active remodeling, recruitment, modification, histone exchange, and restoration. Make this a bridge to the existing chromatin-maintenance draft, not a duplicate enzyme catalog.
- **Status/boundary:** Supported mechanisms in particular systems. Avoid a universal equilibrium occupancy formula for an ATP-driven cell.
- **Visual:** A state cycle with ATP-dependent transitions distinguished from binding equilibria. **Sources:** S10, S17–S18, S21.

**20 · Copying sequence does not automatically copy chromatin**

- **Question:** How is molecular organization reconstructed after replication?
- **Treatment:** Compare parental histone recycling, modification of new histones, and methylation maintenance via UHRF1/DNMT1. Explain that different substrates have different copying/restoration processes.
- **Status/boundary:** Experimentally supported cellular mechanisms. Restoration can be incomplete and time-dependent; mitotic maintenance is not evidence for unlimited transgenerational inheritance.
- **Visual:** Separate DNA, histone, and modification timelines across one replication event. **Sources:** S17–S18.

**21 · The cell actively extrudes DNA loops**

- **Question:** How can molecular motors reorganize chromosome contacts?
- **Treatment:** Begin with observed condensin loop extrusion and then human cohesin assays. Explain ATP dependence, processivity, force sensitivity, and barriers.
- **Status/boundary:** Direct in-vitro observation supports the mechanism. Motor observations do not establish one fixed chromosomal loop map in every cell.
- **Visual:** A growing loop beside the experimental signal that supports it. **Sources:** S19–S20.

**22 · Domains, compartments, and territories are different objects**

- **Question:** What does a chromosome contact map actually summarize?
- **Treatment:** Distinguish contact enrichment, structural ensembles, loop-associated domains, and compartment segregation. Use cohesin removal and polymer modeling to explain separable contributions.
- **Status/boundary:** Perturbation results plus models. A population contact map is not one cellular conformation; territory-specific claims need additional microscopy sources.
- **Visual:** Several conformations compatible with a schematic contact matrix. **Sources:** S21–S22, S35.

**23 · Is heterochromatin a liquid? Ask an experiment**

- **Question:** When does phase separation explain nuclear organization?
- **Treatment:** Present HP1α droplet experiments alongside mouse-cell work that did not find hallmarks of HP1-driven liquid–liquid phase separation. Distinguish protein demixing, polymer collapse, bridging, and gel-like behavior.
- **Status/boundary:** System-dependent evidence and competing mechanisms. Roundness, fusion, or recovery after photobleaching alone cannot uniquely establish a mechanism.
- **Visual:** A discriminating-experiment table comparing candidate mechanisms. **Sources:** S23–S24.

**24 · Replication is a spatial and temporal problem**

- **Question:** How does a cell finish copying a long genome without copying it twice?
- **Treatment:** Separate licensing, initiation, elongation, fork convergence, timing, and chromatin restoration. Use single-molecule mapping to explain stochastic origin usage within an organized program.
- **Status/boundary:** Measured initiation behavior is method- and scale-dependent. S34 does not support a purely random genome-wide replication program; licensing and re-replication control need additional dedicated primary sources.
- **Visual:** Multiple cells using different origins across a similar timing domain. **Sources:** S17, S34.

### D. How evolutionary history built the substrate

**25 · The eukaryotic genome has a composite ancestry**

- **Question:** How did genomes from distinct lineages become parts of one cell?
- **Treatment:** Explain archaeal ancestry, bacterial mitochondrial ancestry, gene transfer, and subsequent innovation. Use Asgard phylogenomics to show how inference improves with sampling.
- **Status/boundary:** Comparative evidence constrains ancestry; the sequence of cellular events remains debated. Living Asgard organisms are relatives, not unchanged ancestral eukaryotes. Add organelle gene-transfer experiments before a full organelle chapter.
- **Visual:** An ancestry network rather than an uncomplicated ladder. **Sources:** S32–S33.

**26 · Why genomes become large without becoming better designed**

- **Question:** Why can DNA accumulate beyond immediately useful sequence?
- **Treatment:** Explain mutation, drift, selection, effective population size, mobile elements, duplication, and deletion. Present the Lynch–Conery argument as an influential explanatory framework.
- **Status/boundary:** Population-genetic model and comparative evidence. It is not a universal quantitative account of every genome-size difference; avoid treating either all noncoding DNA as junk or all of it as adaptive.
- **Visual:** Gain, loss, and retention processes acting at different levels. **Source:** S25.

**27 · Mobile elements are evolutionary actors and potential raw material**

- **Question:** How can a replicating sequence persist without benefiting its host?
- **Treatment:** Separate element-level propagation, host fitness effects, repression, and later co-option. Build toward a specific experimentally tested domestication example.
- **Status/boundary:** Different elements and stages have different consequences. Co-option of selected copies does not demonstrate that most copies are beneficial. Add primary LINE-1 mobilization and host-repression studies before a comprehensive repeat article.
- **Visual:** Element propagation and host fitness on independent axes. **Sources:** S25–S26.

**28 · When viral sequence becomes host regulation**

- **Question:** What evidence shows an ancient insertion contributing to current function?
- **Treatment:** Use ERV-derived interferon-responsive enhancers and CRISPR deletion experiments. Distinguish enrichment, binding, reporter activity, endogenous perturbation, and fitness.
- **Status/boundary:** Functional effects demonstrated for tested loci and systems. Do not extend them to every ERV or universal immune regulation.
- **Visual:** Evidence progression from repeat annotation to endogenous deletion. **Source:** S26.

**29 · Introns preserve a connection to catalytic RNA**

- **Question:** What can splicing machinery tell us about genome history?
- **Treatment:** Introduce group II intron catalysis and structural parallels with the spliceosome. Explain how related reaction architectures support evolutionary hypotheses.
- **Status/boundary:** Structures and catalytic similarities are observed; precise historical transitions are reconstructed. Not every modern intron should be described as a directly recognizable invading group II element.
- **Visual:** Aligned catalytic principles with ancestry inference labeled separately. **Source:** S36.

**30 · A compositional landscape can emerge without thermal adaptation**

- **Question:** Why are some genomic regions GC-rich?
- **Treatment:** Separate mutation biases, GC-biased gene conversion, selection, repeat history, and segmentation choices. Extend the existing GC/isochore articles with population-level mechanisms.
- **Status/boundary:** Human population evidence supports gene-conversion bias. High GC or high predicted melting temperature does not by itself demonstrate selection for physical stability.
- **Visual:** Distinct processes producing similar compositional summaries. **Sources:** S07, S27.

**31 · A centromere is a problem of identity and inheritance**

- **Question:** How can essential segregation coexist with rapidly changing repetitive DNA?
- **Treatment:** Explain satellite arrays, higher-order repetition, specialized chromatin, and the distinction between sequence organization and active centromere identity.
- **Status/boundary:** Complete assembly and epigenetic mapping expose previously inaccessible organization. Centromere-drive claims require separate primary experiments; mapping alone does not prove drive in humans.
- **Visual:** Array sequence and active chromatin domain on separate tracks. **Sources:** S28–S29.

**32 · New genes can emerge from previously noncoding sequence**

- **Question:** How does previously noncoding DNA acquire coding potential?
- **Treatment:** Compare duplication and de novo candidates; explain synteny, ancestral reconstruction, transcription, translation, and functional validation as separate evidence layers.
- **Status/boundary:** Candidate histories can be supported, but annotation and homology-detection errors are serious alternatives. Lack of detectable homology alone is insufficient; the 2009 examples need current annotation checks before reuse.
- **Visual:** A locus across related species with each evidence layer marked. **Source:** S08a.

### E. What remains invisible, and how to reason about it

**33 · The reference genome shaped what biology could see**

- **Question:** Which apparent absences were limits of assembly or representation?
- **Treatment:** Compare GRCh38, T2T-CHM13, and the 2023 draft pangenome as distinct research advances. Explain repeats, structural variants, reference bias, and coordinate dependencies.
- **Status/boundary:** Assembly completeness and population representation are different achievements. CHM13 is not every human genome, and its original 2022 assembly did not include a Y chromosome. These papers are historical anchors, not an assertion of the latest release state.
- **Visual:** A linear reference, completed repeat interval, and alternative haplotype paths. **Sources:** S28–S29, S29a.

**34 · Newly found RNA worlds are not automatically fossils**

- **Question:** How can an entire class of genetic elements evade familiar searches?
- **Treatment:** Use obelisks to explain discovery without familiar conserved markers, predicted structure, a known bacterial host, and unresolved replication biology.
- **Status/boundary:** Discovery is experimentally/computationally supported; ancient ancestry, health relevance, and detailed mechanisms remain separate questions. These are microbiome-associated elements, not an established hidden component of human chromosomes.
- **Visual:** Detection pipeline and a measured/predicted/unknown ledger. **Source:** S29b.

**35 · An organism contains genome lineages, not only one genome**

- **Question:** How does the genome change after fertilization?
- **Treatment:** Explain postzygotic mutation, mosaicism, lineage history, and tissue-dependent detection. Use a multi-tissue study to distinguish a reference sequence from actual cellular populations.
- **Status/boundary:** Somatic variation is measured; observed burdens depend on sampling and detection thresholds. Avoid attributing all tissue differences to inherited sequence or all mutations to one damage mechanism.
- **Visual:** A cell-lineage tree with detectable variants and sampling limits. **Source:** S29c.

**36 · From a physical annotation to an explanation**

- **Question:** What would establish that a material property helps cause a biological outcome?
- **Treatment:** Trace prediction → measurement → association → intervention → mechanism. Explain matched-composition controls, sequence covariates, tissue context, held-out genomic regions, and measurement scale.
- **Status/boundary:** Editorial/methodological synthesis. A residual correlation or improved predictor is useful evidence, but it does not uniquely establish physical causation or validate every layer of a mechanistic model.
- **Visual:** One claim decomposed into observed quantities, model outputs, and causal assumptions. **Sources:** S07, S09–S10, S21–S24; local model-revision note for internal context only.

### F. Repeat geography, chromatin failure, and inflammation

Added 12 November 2026 following discussion of the proposed LINE-1-interior/ERV-boundary model. The productive research question is whether repeat geography predicts susceptibility and timing of derepression. A universal spatial arrangement or ERV-before-LINE-1 activation sequence has not been established by the sources below.

**37 · Where a repeat inserts is not where evolution leaves it**

- **Question:** How do insertion preferences and subsequent selection produce the present repeat landscape?
- **Treatment:** Compare experimentally generated LINE-1 insertions with endogenous surviving copies. Explain insertion-site sequence, replication context, deleterious effects, deletion, and purifying selection as distinct contributors. Analyze repeat subfamilies and ages separately.
- **Status/boundary:** Experimental and comparative support for different initial and surviving distributions. Endogenous enrichment in quiescent, late-replicating regions does not establish universal confinement to constitutive heterochromatin or physical domain interiors.
- **Visual:** Initial insertion distribution → differential loss/retention → present landscape, with measured and inferred steps distinguished. **Sources:** S25, S37.

**38 · Isochores, bands, compartments, and boundaries describe different maps**

- **Question:** Which spatial variable is actually being measured when an element is called “deep in heterochromatin”?
- **Treatment:** Separate sequence composition, cytogenetic G/R bands, histone-defined chromatin states, A/B compartments, lamina association, and three-dimensional distance from a domain surface. Explain that LINE-1/L1 elements and the L1 isochore family are unrelated uses of the same label.
- **Status/boundary:** Methodological synthesis. Correlations among maps do not make them interchangeable. Genomic distance to a domain edge does not establish three-dimensional burial. Claims about ERVs as a group require family-resolved analysis, including solo LTRs versus internal/proviral sequence.
- **Visual:** Aligned but nonidentical tracks for one schematic interval, plus a separate three-dimensional representation. **Sources:** S21–S22, S27, S35, S37; dedicated cytogenetic and lamina-mapping sources required before drafting.

**39 · When a repeat supplies an enhancer, an insulator, or a boundary**

- **Question:** What evidence establishes an architectural role rather than regulatory activity alone?
- **Treatment:** Distinguish promoter and enhancer function, CTCF binding, enhancer-blocking insulation, heterochromatin barriers, and contact-domain boundaries. Contrast selected ERV-derived immune enhancers with the broader contribution of retrotransposons to CTCF-site evolution.
- **Status/boundary:** Selected repeat-derived regulatory functions and transposon-associated CTCF evolution are supported. An enhancer is not automatically an insulator; CTCF binding alone is not proof of boundary function. Neither establishes that most ERVs preferentially occupy euchromatin edges or that boundary association is unique to ERVs.
- **Visual:** A claim ladder from motif → binding → endogenous perturbation → demonstrated architectural effect. **Sources:** S26, S41.

**40 · Does repeat geography predict the order of chromatin failure?**

- **Question:** Do elements closer to a defined repressive-domain boundary derepress earlier during senescence or aging?
- **Treatment:** Formalize the proposed “edge-melting” model as a hypothesis. Define the boundary before testing: an H3K9me3-domain edge, lamina-associated-domain boundary, compartment transition, or measured three-dimensional surface. Compare family-specific activation hazards across time and distance.
- **Status/boundary:** Open hypothesis. The reviewed sources do not establish that ERVs universally occupy vulnerable edges, LINE-1 copies occupy protected interiors, heterochromatin erodes monotonically from outside inward, or this geometry causes ERVs to activate first. Treat “melting” as an analogy unless a physical transition is measured.
- **Visual:** Predicted activation-time-versus-distance relationships alongside competing hypotheses. **Sources:** S37–S40 for contextual evidence; none alone demonstrates the proposed spatial causal chain.

**41 · Repeat activation can reinforce inflammation through different routes**

- **Question:** Which molecular product connects a derepressed repeat to innate immune signaling?
- **Treatment:** Separate transcription, protein production, reverse-transcribed DNA, RNA duplexes, particle production, and new genomic insertion. Compare late-senescence LINE-1-associated interferon signaling with HERV-K and ATF3-responsive ERV findings. Investigate RNA sensing and DNA sensing as distinct mechanisms.
- **Status/boundary:** Specific senescence models support repeat-associated inflammatory feedback. Expression does not establish retrotransposition, and a retrovirus-like particle does not establish infectious spread. Timing in one model does not establish a universal ERV-versus-LINE-1 sequence or prove a spatial cause. Add primary RNA-sensing studies before a full mechanistic comparison.
- **Visual:** Separate RNA, DNA, and protein/particle branches, each linked to its experimental system and perturbation evidence. **Sources:** S38–S40.

**42 · What silences a particular repeat locus?**

- **Question:** Which maintenance mechanisms determine whether a repeat stays repressed when the cell changes state?
- **Treatment:** Develop a locus- and family-specific account of KRAB-ZFP recognition, KAP1/TRIM28 recruitment, SETDB1-associated H3K9 methylation, DNA methylation, and transcription-factor availability. Compare maintenance loss with active recruitment of a stress-responsive activator such as ATF3.
- **Status/boundary:** Proposed mechanism-focused extension requiring additional primary literature. Do not assume all ERVs or LINE-1 subfamilies use identical machinery, or that repression is specifically deployed at boundary lines. Recruitment, chromatin marks, transcription, and innate signaling need separate measurements.
- **Visual:** A recruitment/maintenance diagram with family-, locus-, and cell-type-dependent steps labeled. **Sources:** S18, S40 as limited anchors; direct KRAB-ZFP/KAP1/SETDB1 studies required.

#### Working model and discriminating analysis

**Working formulation:** Repeat family, evolutionary age, local regulatory sequence, and chromatin environment may jointly determine susceptibility to derepression. Whether boundary proximity independently predicts earlier activation is an unresolved question.

A concrete study would require:

1. Locus-resolved repeat annotations, distinguishing subfamily, evolutionary age, intactness, solo LTRs, and truncated copies. Most annotated copies must not be treated as autonomous active elements.
2. Matched longitudinal RNA and chromatin measurements in a specified cell type and senescence model. Distinguish replicative, oncogene-induced, and stress-induced senescence from organismal aging.
3. A prespecified boundary definition and separate measurements of linear genomic distance and three-dimensional position where available.
4. Controls for GC/CpG content, gene proximity, repeat length and age, mappability, baseline repression, baseline transcription, replication timing, and transcription-factor motifs. Use matched genomic backgrounds and spatially aware null models.
5. A within-family test of whether baseline boundary distance predicts subsequent activation, followed by a model testing whether it explains differences between families. Analyze individual donors and biological replicates rather than treating every repeat copy as an independent replicate.
6. Perturbations that distinguish boundary position from maintenance machinery and activator availability. Account for reverse causation: transcription itself may alter chromatin or the apparent boundary.
7. Independent measures of RNA production, reverse transcription, immune sensing, and insertion when those outcomes are claimed.

Alternative explanations include family-specific activator induction, differential silencing dependencies, copy age/intactness, baseline accessibility, and detection bias. A boundary effect that disappears after these controls would weaken the geometric model. Conversely, a reproducible distance effect would support association; a causal architectural mechanism would still require intervention.

The user-supplied passage's numbered references point to domains rather than identifiable papers. Its numerical genome fractions and detailed isochore/band claims are not adopted as verified findings here. Recover exact primary references and specify assembly, annotation scheme, and denominator before using those numbers publicly.

## The deepest theory threads to carry across articles

1. **A genome is maintained as a lineage, not as an indestructible object.** Molecular stability, replacement, copying, repair, and selection operate on different timescales. Specify which entity persists.
2. **Physical possibility differs from evolutionary explanation.** A molecular structure can be possible without having existed in early life. A present-day advantage does not identify the historical transition that produced it.
3. **Sequence and material organization are coupled.** Sequence affects chemistry and recognition; cellular processes alter molecular state and determine which possibilities are realized. Avoid independent “channels” unless the variables and dependence are defined.
4. **Energy landscapes and driven dynamics answer different questions.** Equilibrium preferences can help explain local tendencies. ATP-dependent fluxes and kinetic barriers can maintain states that equilibrium models cannot predict alone.
5. **Evolution operates at multiple levels.** Molecules, elements, organelles, cells, and organisms can have different propagation interests. Their conflicts and alignments help explain genome construction.
6. **History changes the accessible possibilities.** Duplication, domestication, compartmentalization, and repair machinery alter what can evolve next. A physically viable design need not be evolutionarily reachable.
7. **More than one mechanism can generate the same pattern.** GC richness, contact enrichment, puncta, and conserved sequence are observations requiring discrimination among explanations.
8. **The observer matters.** Assembly, mapping, averaging, chemical probes, and sampling define what is visible. Missing signal may reflect the assay; observed signal may integrate several states.

These are proposed organizing principles, not a newly validated unified theory. Topics such as channel capacity, effective temperature, wave propagation, and genome-wide mechanical communication need specified inputs, observables, scale, boundary conditions, and falsifiable predictions. Existing “genome as medium” notes should inspire questions; they do not justify importing transmission-line or wave equations unchanged into chromatin.

## Recommended production sequence

The most coherent first collection is **How a genome becomes possible**:

1. **01 — What must a molecule do to become hereditary?** Establish the question and vocabulary.
2. **02 — Making the alphabet before making the book.** Ground origins in actual chemistry.
3. **03 — The RNA world is a family of hypotheses.** Separate feasibility from reconstruction.
4. **04 — Why copying fidelity constrains genome size.** Introduce a tractable theoretical constraint.
5. **05 — Why the genome needed a boundary.** Link chemistry to lineages and selection.
6. **06 — Why DNA?** Draft after the specifically identified mechanistic source expansion.
7. **12 — Bending, twisting, stretching, and melting.** Establish material quantities before using them to explain genomes.
8. **15 — Transcription changes the material it reads.** A particularly strong demonstration of physical feedback.
9. **26 — Why genomes become large.** Bring population genetics into the physical narrative.
10. **36 — From annotation to explanation.** Give readers tools to evaluate the whole collection.

Follow with **The chromosome as an ongoing process** (18–24), **The evolutionary construction of genomes** (25–32), and **What our instruments leave dark** (33–35). Develop 09–17 as a linked physical reference collection alongside the existing library.

Suggested format: 1,500–2,500 words for a foundational essay; 700–1,200 for a focused mechanism; 300–600 for an evidence sidebar. These are editorial proposals. Each full article should define prerequisites, state one central question, include one original explanatory figure, describe a discriminating experiment, and end with a concrete unresolved question rather than an implied scientific resolution.

## Three worked article outlines

### Transcription changes the material it reads

**Opening:** Moving along a helical track requires relative rotation. Where does that rotation go?

**Sections:** (1) Geometry of helical tracking; (2) polymerase rotation versus DNA rotation; (3) twin domains and boundary conditions; (4) the bacterial experiments supporting the model; (5) relaxation by nicks and topoisomerases; (6) what must be measured to establish coupling at a new locus.

**Reader takeaway:** Transcription is simultaneously an information-processing reaction and a mechanical process. The extent and consequences of torsion depend on constraints and competing relaxation processes.

**Original figure:** Three panels using the same DNA template: rotationally free, rotationally constrained, and topoisomerase-relaxed. Mark all drawings schematic. Attach S11 to model claims and S12 to experimental claims.

### Why copying fidelity constrains genome size

**Opening:** A copying reaction can produce molecules while still failing to preserve a complex functional sequence.

**Sections:** (1) Per-site error and whole-copy fidelity; (2) q^L with transparent assumptions; (3) selection among imperfect copies; (4) why functional robustness changes the problem; (5) compartments and parasites; (6) modern laboratory catalytic evolution and its assistance requirements.

**Reader takeaway:** Heredity requires enough retained functional information, not literal perfection. Constraints depend on the replication and selection system.

**Original figure:** A parameter sweep with axes, assumptions, and no invented threshold labeled as a fact of early Earth. Link S04 for theory, S03 for experimental context, and S05 for compartment feasibility.

### Is heterochromatin a liquid? Ask an experiment

**Opening:** A compact or round nuclear domain has a visible shape, but shape alone does not identify the mechanism that produced it.

**Sections:** (1) What phase separation means; (2) what the HP1α in-vitro work demonstrated; (3) what the mouse-cell work tested; (4) polymer bridging and collapse as alternative physical accounts; (5) which perturbations discriminate mechanisms; (6) why conditions and model system belong in every conclusion.

**Reader takeaway:** A useful physical theory predicts measurements that competitors do not. Different systems can occupy different material regimes.

**Original figure:** Mechanism-versus-observable matrix, separating in-vitro findings from in-cell tests. Sources S23–S24; S21–S22 for chromosome-scale context. Do not portray the two studies as a simple universal proof and disproof.

## Source register: primary anchors

Numbers identify sources throughout this dossier. A source's “limit” is an editorial instruction about the inference it can support. Source summaries are deliberately short; most article prose will require additional claim-level citations.

| ID | Primary source | Contribution and limit |
| --- | --- | --- |
| S01 | Powner, Gerland & Sutherland (2009), [Synthesis of activated pyrimidine ribonucleotides in prebiotically plausible conditions](https://doi.org/10.1038/nature08013) | Laboratory precursor chemistry; not a complete origin-of-life pathway. |
| S02 | Xu et al. (2020), [Selective prebiotic formation of RNA pyrimidine and DNA purine nucleosides](https://doi.org/10.1038/s41586-020-2330-9) | Mixed precursor chemistry; does not identify the first genetic polymer. |
| S03 | Papastavrou, Horning & Joyce (2024), [RNA-catalyzed evolution of catalytic RNA](https://doi.org/10.1073/pnas.2321592121) | Catalytic evolution in a designed laboratory cycle; no autonomous RNA organism. |
| S04 | Eigen (1971), [Selforganization of matter and the evolution of biological macromolecules](https://doi.org/10.1007/BF00623322) | Foundational replication/selection theory; assumptions matter. |
| S05 | Mansy et al. (2008), [Template-directed synthesis of a genetic polymer in a model protocell](https://doi.org/10.1038/nature07018) | Selected copying chemistry compatible with model membranes; designed substrates. |
| S06 | Moody et al. (2024), [The nature of the last universal common ancestor and its impact on the early Earth system](https://doi.org/10.1038/s41559-024-02461-1) | Ancestral and ecological reconstruction; model-dependent history. |
| S07 | SantaLucia (1998), [A unified view of polymer, dumbbell, and oligonucleotide DNA nearest-neighbor thermodynamics](https://doi.org/10.1073/pnas.95.4.1460) | Effective duplex thermodynamics; not a bending model. |
| S08 | Bryant et al. (2003), [Structural transitions and elasticity from torque measurements on DNA](https://doi.org/10.1038/nature01810) | Single-molecule torque and transitions; assay conditions matter. |
| S08a | Knowles & McLysaght (2009), [Recent de novo origin of human protein-coding genes](https://doi.org/10.1101/gr.095026.109) | Comparative candidate gene origins; recheck current annotation and homology. |
| S09 | Rohs et al. (2009), [The role of DNA shape in protein–DNA recognition](https://doi.org/10.1038/nature08473) | Structural recognition mechanism; not universal in-cell affinity prediction. |
| S10 | Basu et al. (2021; online 2020), [Measuring DNA mechanics on the genome scale](https://doi.org/10.1038/s41586-020-03052-3) | High-throughput short-DNA cyclizability; distinguish from long-chain persistence length. |
| S11 | Liu & Wang (1987), [Supercoiling of the DNA template during transcription](https://doi.org/10.1073/pnas.84.20.7024) | Twin-domain theory; specify rotational constraints. |
| S12 | Wu et al. (1988), [Transcription generates positively and negatively supercoiled domains in the template](https://www.sciencedirect.com/science/article/pii/0092867488901638) | Bacterial experimental support; not a whole-nucleus map. |
| S13 | Biffi et al. (2013), [Quantitative visualization of DNA G-quadruplex structures in human cells](https://doi.org/10.1038/nchem.1548) | Structure-specific antibody imaging; detection and functional inference differ. |
| S14 | Zeraati et al. (2018), [I-motif DNA structures are formed in the nuclei of human cells](https://doi.org/10.1038/s41557-018-0046-3) | Cellular structure detection and context dependence; not motif-wide occupancy. |
| S15 | Ginno et al. (2012), [R-loop formation is a distinctive characteristic of unmethylated human CpG island promoters](https://doi.org/10.1016/j.molcel.2012.01.017) | R-loops and promoter context; association is not universal causal direction. |
| S16 | Luger et al. (1997), [Crystal structure of the nucleosome core particle at 2.8 Å resolution](https://doi.org/10.1038/38444) | Atomic architecture; not a complete positioning or dynamics theory. |
| S17 | Reverón-Gómez et al. (2018), [Accurate recycling of parental histones reproduces the histone modification landscape during DNA replication](https://pmc.ncbi.nlm.nih.gov/articles/PMC6202308/) | Replication-associated histone recycling/restoration; avoid instantaneous-copy language. |
| S18 | Sharif et al. (2007), [The SRA protein Np95 mediates epigenetic inheritance by recruiting Dnmt1 to methylated DNA](https://doi.org/10.1038/nature06397) | Mechanism of methylation maintenance; not all forms of epigenetic inheritance. |
| S19 | Ganji et al. (2018), [Real-time imaging of DNA loop extrusion by condensin](https://pmc.ncbi.nlm.nih.gov/articles/PMC6329450/) | Direct in-vitro motor observation; assay geometry and forces matter. |
| S20 | Davidson et al. (2019), [DNA loop extrusion by human cohesin](https://doi.org/10.1126/science.aaz3418) | Human cohesin loop extrusion; not an immutable cellular loop map. |
| S21 | Schwarzer et al. (2017), [Two independent modes of chromatin organization revealed by cohesin removal](https://doi.org/10.1038/nature24281) | Perturbation separates organizational contributions. |
| S22 | Nuebler et al. (2018), [Chromatin organization by an interplay of loop extrusion and compartmental segregation](https://doi.org/10.1073/pnas.1717730115) | Polymer model tested against organizational changes; model is not a unique microscopic reconstruction. |
| S23 | Larson et al. (2017), [Liquid droplet formation by HP1α suggests a role for phase separation in heterochromatin](https://doi.org/10.1038/nature22822) | Physical behavior in studied conditions; not every heterochromatin domain is an HP1 liquid. |
| S24 | Erdel et al. (2020), [Mouse heterochromatin adopts digital compaction states without showing hallmarks of HP1-driven liquid–liquid phase separation](https://pmc.ncbi.nlm.nih.gov/articles/PMC7163299/) | Important in-cell constraint on a broad phase-separation narrative; system-specific. |
| S25 | Lynch & Conery (2003), [The origins of genome complexity](https://doi.org/10.1126/science.1089370) | Population-genetic framework; not a complete universal account of genome expansion. |
| S26 | Chuong, Elde & Feschotte (2016), [Regulatory evolution of innate immunity through co-option of endogenous retroviruses](https://doi.org/10.1126/science.aad5497) | Endogenous perturbation supports selected ERV regulatory roles; do not generalize to all copies. |
| S27 | Lachance & Tishkoff (2014), [Biased gene conversion skews allele frequencies in human populations, increasing the disease burden of recessive alleles](https://pmc.ncbi.nlm.nih.gov/articles/PMC4185123/) | Human population evidence for biased conversion; distinguish transmission bias from adaptive benefit. |
| S28 | Altemose et al. (2022), [Complete genomic and epigenetic maps of human centromeres](https://doi.org/10.1126/science.abl4178) | Repeat organization and chromatin maps in a completed assembly; not universal centromere identity or proof of human drive. |
| S29 | Nurk et al. (2022), [The complete sequence of a human genome](https://doi.org/10.1126/science.abj6987) | T2T-CHM13 assembly; original assembly lacks Y and is not population-complete. |
| S29a | Liao et al. (2023), [A draft human pangenome reference](https://doi.org/10.1038/s41586-023-05896-x) | Multiple haplotypes and representation gains; historical release, not current coverage census. |
| S29b | Zheludev et al. (2024), [Viroid-like colonists of human microbiomes](https://doi.org/10.1016/j.cell.2024.09.033) | Obelisk discovery, predicted structures, known host example; ancestry and replication remain distinct questions. |
| S29c | Rockweiler et al. (2023), [The origins and functional effects of postzygotic mutations throughout the human life span](https://pubmed.ncbi.nlm.nih.gov/37053313/) | Multi-tissue somatic variation; assay and sampling limits affect burdens. |
| S30 | Todd et al. (2008), [Attractive forces between cation condensed DNA double helices](https://pmc.ncbi.nlm.nih.gov/articles/PMC2397328/) | DNA-array interactions under controlled conditions; not a direct nuclear measurement. |
| S31 | Freeland & Hurst (1998), [Load minimization of the genetic code: history does not explain the pattern](https://doi.org/10.1098/rspb.1998.0547) | Code-cost comparison under specified assumptions; avoid global-optimality rhetoric. |
| S32 | Zaremba-Niedzwiedzka et al. (2017), [Asgard archaea illuminate the origin of eukaryotic cellular complexity](https://doi.org/10.1038/nature21031) | Comparative ancestry and protein repertoire; not direct observation of eukaryogenesis. |
| S33 | Eme et al. (2023), [Inference and reconstruction of the heimdallarchaeial ancestry of eukaryotes](https://doi.org/10.1038/s41586-023-06186-2) | Expanded phylogenomics and ancestral reconstruction; model and sampling dependence. |
| S34 | Wang et al. (2021), [Genome-wide mapping of human DNA replication by optical replication mapping supports a stochastic model of eukaryotic replication](https://doi.org/10.1016/j.molcel.2021.05.024) | Single-molecule replication mapping; randomness at one scale does not negate timing organization. |
| S35 | Ou et al. (2017), [ChromEMT: Visualizing 3D chromatin structure and compaction in interphase and mitotic cells](https://doi.org/10.1126/science.aag0025) | In-situ ultrastructure; evaluate preparation and reconstruction constraints. |
| S36 | Robart et al. (2014), [Crystal structure of a eukaryotic group II intron lariat](https://doi.org/10.1038/nature13790) | Structural evidence relevant to splicing ancestry; historical transition remains inferred. |

| S37 | Sultana et al. (2019), [The landscape of L1 retrotransposons in the human genome is shaped by pre-insertion sequence biases and post-insertion selection](https://doi.org/10.1016/j.molcel.2019.02.036) | New versus endogenous insertions distinguish insertion biases from subsequent selection; not evidence of universal physical burial. |
| S38 | De Cecco et al. (2019), [L1 drives IFN in senescent cells and promotes age-associated inflammation](https://doi.org/10.1038/s41586-018-0784-9) | Late-senescence LINE-1/interferon mechanism in studied systems; timing does not establish boundary depth as cause. Publisher records an Author Correction; read it before drafting. |
| S39 | Liu et al. (2023), [Resurrection of endogenous retroviruses during aging reinforces senescence](https://pubmed.ncbi.nlm.nih.gov/36610399/) | HERV-K expression and retrovirus-like particles in studied senescence systems; not a universal early activation or boundary-localization result. |
| S40 | Mao et al. (2024), [Reactivation of senescence-associated endogenous retroviruses by ATF3 drives interferon signaling in aging](https://doi.org/10.1038/s43587-024-00745-6) | A stress-responsive activator provides a mechanism to compare with spatial explanations; not evidence of universal ERV boundary enrichment. |
| S41 | Schmidt et al. (2012), [Waves of retrotransposon expansion remodel genome organization and CTCF binding in multiple mammalian lineages](https://pubmed.ncbi.nlm.nih.gov/22244452/) | Transposon-associated evolution of CTCF binding across mammals; does not establish a general ERV-specific boundary geography. |

The register contains 45 sources supporting 42 proposed editorial segments. IDs include suffixes to preserve topic relationships; retain stable IDs when extending this dossier.

## Searches and follow-up gaps

Representative searches used combinations of exact article titles, author/year, and topic terms: prebiotic pyrimidine synthesis; mixed RNA/DNA precursors; RNA-catalyzed evolution; model protocell copying; Eigen replication theory; LUCA reconstruction; nearest-neighbor thermodynamics; DNA torque; DNA shape readout; loop-seq mechanics; transcriptional supercoiling; G4/i-motif cellular detection; R-loops and CpG islands; parental histone recycling; UHRF1/DNMT1; loop extrusion; cohesin removal; HP1 phase separation and negative evidence; genome complexity and drift; ERV co-option; GC-biased conversion; centromere maps; pangenome; obelisks; de novo genes; somatic mosaicism; group II intron structures.

Further focused searches are needed for the topics below. They are meaningful extensions, not conclusions already established by this dossier:

| Gap | Needed before producing a full treatment |
| --- | --- |
| Backbone/alphabet selection and homochirality | Primary comparisons of alternative backbones, stereochemistry, copying compatibility, and chemical stability; distinguish historical selection from modern engineering. |
| Prebiotic environments | Geochemical constraints on connected reaction sequences, concentration mechanisms, wet–dry cycling, mineral surfaces, incompatible salts, and strand separation. |
| Origin of DNA and repair | Ribonucleotide reductase evolution, RNA/DNA transitions, uracil discrimination, polymerase origins, repair and proofreading. |
| Translation emergence | Aminoacylation, ribosomal catalysis, stereochemical experiments, and explicit tests of alternative code-origin hypotheses. |
| Genome-size diversity | Plant, fungal, animal, bacterial, and archaeal comparisons; deletion bias, polyploidy, effective population size, and counterexamples to simple correlations. |
| Repeat ecology and repression | Initial LINE-1 insertion/selection evidence added in S37; expand KRAB-ZFP/KAP1/SETDB1 and piRNA mechanisms, repeat-age/mappability controls, and deleterious versus beneficial effects. See segments 37–42 for the boundary-proximity hypothesis and discriminating analysis. |
| Centromere drive and chromosome ends | Direct meiotic drive experiments, suppressor evolution, neocentromeres, telomere end protection, telomerase and alternative lengthening. |
| Topological maintenance | Topoisomerase strand passage, knot removal, decatenation, domain boundaries, and in-cell torsion measurements. |
| Mutation and repair landscapes | Germline de novo mutations, lesion formation, repair accessibility, replication timing, exposure, and confounding by selection. |
| Nuclear organization and active matter | Live-cell perturbation measurements, rheology, lamina/nucleolus interactions, ATP dependence, and competing polymer models. |
| Additional genomic entities | Mitochondrial nucleoids, plastids, bacterial chromosomes, plasmids, phages, extrachromosomal circular DNA, and horizontal transfer. |
| What counts as function | Primary perturbation screens, comparative constraint, biochemical activity, fitness measurements, redundancy, and environment-dependent effects. |
| Recent literature | A dedicated 2025–2026 update for each article, including corrections and rebuttals. Foundational sources here are not a claim that subsequent work does not exist. |

## Handoff to the implementation instance

This directory contains research/editorial documents only. No public article, source-content module, API layer, implementation plan, or deployment was changed.

Use this dossier to choose the next collection, then develop individual briefs with verified full-text claim–source records. For every tool connection, verify current implementation and evidence status; do not infer that a layer exists or is validated from a conceptual article. Keep scientific review status as draft until an actual review occurs.
