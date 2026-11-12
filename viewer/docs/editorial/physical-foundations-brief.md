# Physical foundations: implementation and evidence record

Date: 2026-11-12

Status: Internal source-and-methods review completed for the present claims;
revisions applied. Independent scientific sign-off remains pending and the
articles remain editorial drafts.

The [review report](physical-foundations-review-2026-11-12.md) and
[retrieval/notice manifest](physical-foundations-review-manifest.json) are the
current review record. They document recovered full texts, claim-specific
supplement readings, corrections/limitations, and 2025–2026 updates. The initial
inspection tables below are retained as implementation history and are
superseded where the review report records further work. Origins articles have
not been started.

## Article mapping

| Brief | Article | Delivered scope |
| --- | --- | --- |
| 10–11 | `dna-thermodynamics` | Expanded existing route; retained `quantities`, `neighbors`, and `comparison` anchors. Thermodynamic vocabulary, nearest-neighbor interpretation, experimental conditions, ensemble/rate distinction. |
| 12 | `dna-mechanics` | Physical reference separating deformation, observable, units, model, and scale; original four-panel experiment schematic and comparison table. |
| 36 | `physical-annotation-and-evidence` | Methodological synthesis with narrowly attributed published examples, original evidence ladder, and hypothetical control designs. |

Prerequisites: base composition for thermodynamics; thermodynamics for mechanics; neither experimental competence nor prior statistical training is assumed for the evidence guide. New references retain the existing eight-foundation order. No thematic collection type or Origins subject was added.

## Initial implementation source crosswalk and inspection depth

| Stable ID | Local reference | Primary identity / access / exact locations inspected | Verification limit |
| --- | --- | --- | --- |
| S07 | `santalucia` | SantaLucia 1998, DOI 10.1073/pnas.95.4.1460. Primary article PDF hosted by Caltech: https://www.dna.caltech.edu/courses/cs191/paperscs191/santalucia1998a.pdf. Background, Eq. 1–3, Fig. 1, parameter-table context and discussion of parameter formats. | Targeted full-text reading. PMC access challenged. No comprehensive retrospective comparison of parameter corrections or complete recent thermodynamics review. |
| S08 | `bryant` | Bryant et al. 2003, DOI 10.1038/nature01810. Publisher abstract and Fig. 1–4 captions. | Subscription preview only. Article uses only the abstract-supported fact of controlled torque/twist measurements on stretched DNA and structural responses; no numerical modulus, experimental buffer, or detailed transition mechanism adopted. Full methods/supplement remain a publication blocker for a fuller torque treatment. |
| S10 | `basu` | Basu et al. 2021 (online 2020), DOI 10.1038/s41586-020-03052-3, PMC7855230. Europe PMC fullTextXML retrieved; inspected “DNA mechanics in high throughput,” Fig. 1, construct design, enrichment definition, rotational-phasing discussion, and Methods. | Relevant main-text passages inspected. Supplementary Notes 1–3 and 7–8 are cited by the paper but not independently read in full. No quantitative performance or universal mechanistic claim imported. |
| S21 | `schwarzer` | Schwarzer et al. 2017, DOI 10.1038/nature24281, PMC5687303. Results on domain/compartment changes, Fig. 1, “Two independent folding principles,” Online Methods: generation/preparation of adult primary hepatocytes and Nipbl RNA/activity checks. | Targeted full-text/methods inspection; no complete supplement audit. Generalized enhancer or universal transcription claims omitted. |
| S22 | `nuebler` | Nuebler et al. 2018, DOI 10.1073/pnas.1717730115, PMC6055145. Results: “Polymer Model of Loop Extrusion,” parameter definitions, comparison scope, and stated purpose of simulations. | Targeted full text. Simulation reproduction and full SI review pending. Article describes modeling as an example, without adopting parameter values. |
| S23 | `larson` | Larson et al. 2017, DOI 10.1038/nature22822, PMC5606208. Abstract, phase-separation results, Fig. 1 and Fig. 3 context, conditions and phosphorylation/DNA dependence. | Targeted full text; no complete supplement/video review. No universal nuclear-liquid claim. |
| S24 | `erdel` | Erdel et al. 2020, DOI 10.1016/j.molcel.2020.02.005, PMC7163299. Primary indexed summary and introduction; publisher PDF identified at https://pure-oai.bham.ac.uk/ws/portalfiles/portal/95240390/PIIS1097276520300757.pdf. | PMC open encountered access challenge. Summary supports only the narrowly attributed mouse-fibroblast result in this draft. Complete main-text/methods/supplement review remains a publication gate. |
| S42 (extension) | `marko` | Marko & Siggia 1995, “Stretching DNA,” DOI 10.1021/ma00130a008. Author-hosted PDF https://siggia.rockefeller.edu/Publications/1990-9_files/markoMacromol1995.pdf. Introduction, WLC treatment, intrinsic stretching, electrostatic effects, intrinsic bends. | Targeted primary theory reading; no universal persistence-length number adopted. S42 is a source ID; it is unrelated to brief 42. See source extension register. |

## Initial implementation claim–source ledger

| Claim / section | Class and source location | Scope and limit |
| --- | --- | --- |
| Thermodynamics `quantities`: standard formation energy uses ΔH° − TΔS°; reaction direction and units matter | Model definition; S07 Eq. 1–3 | Standard states versus actual concentrations explicitly distinguished. No single biological stability constant. |
| Thermodynamics `neighbors`: adjacent-pair terms, initiation, symmetry; effective duplex parameters | Model; S07 Background, Eq. 1 and Fig. 1 | No isolated stacking-energy, bending-modulus, or cellular-binding inference. Synthetic sequence example establishes changed neighbor counts, not a measured energy ranking. |
| Thermodynamics `melting`: oligonucleotide two-state midpoint and condition dependence; long heterogeneous DNA can have intermediates | Model/experimental interpretation; S07 Background and Tm discussion | No chromosomal Tm or transition time asserted. |
| Thermodynamics `ensemble`; mechanics `twisting`, `melting`: torque/twist manipulation and structural response | Observation; S08 abstract/captions | Stretched single molecules. No quantitative mechanics result reused without methods access. |
| Mechanics `bending`: persistence length has length units and describes the ideal elastic-chain orientation scale | Model; S42 WLC treatment | Conditions, scale, and fit stated as necessary; no base-pair-scale or universal nucleus extrapolation. |
| Mechanics `stretching`: end-to-end extension differs from contour length; elastic models can include contour stretching | Model; S42 Introduction, intrinsic stretching | Defines quantities, not an experimentally determined modulus for a Polymer layer. |
| Mechanics `cyclizability`: loop-seq variable region/adapters, enrichment and rotational phasing; static/dynamic contributions | Observation/assay definition; S10 Fig. 1 and high-throughput assay text | Defined construct and in-vitro protocol, not a direct cellular persistence length. Replicate counts, performance estimates, and evolutionary selection claims omitted. |
| Evidence `prediction`: independent assays should address the stated observable; selected loop-seq sequences compared with smFRET | Editorial synthesis + observation; S10 Fig. 1c,f | Distinguish general design recommendation from published result. |
| Evidence `intervention`: Nipbl deletion in mouse liver separates domain/peak loss from preserved/stronger compartments | Intervention; S21 Fig. 1, Results, Online Methods | Adult hepatocyte experiment; not a universal regulatory mechanism. No claim that all gene expression changes follow one architectural route. |
| Evidence `models`: extrusion/segregation simulation links assumptions to organizational outcomes | Model; S22 polymer-model/results passages | No unique microscopic reconstruction or new Polymer validation. |
| Evidence `discrimination`: HP1α droplets in studied conditions and mouse pericentric findings require system-specific comparison | Observations; S23 phase-separation results; S24 primary summary | Narrow comparison only. Additional microscopic-mechanism details and universal phase-state conclusions withheld. |
| Thermodynamics `rates`, `comparison`; mechanics `test`; evidence control design, sequence-edit and limits sections | Original methodological synthesis | Hypothetical designs explicitly identified. No new biological measurements, effect sizes, mechanisms, or causal estimates claimed. Scientific review of the recommendations remains pending. |

## Initial implementation literature and correction search

Searches on 2026-11-12 included: “DNA mechanics loop seq 2025 2026 correction composition cyclizability”; “SantaLucia 1998 thermodynamics correction nearest neighbor 2025 2026”; exact titles plus “correction”; “Probing mechanical selection” plus 2025/2026.

Primary follow-up leads: “Searching for sequence features that control DNA cyclizability,” PNAS Nexus 2026, DOI 10.1093/pnasnexus/pgag167 (modeling; indexed abstract/results inspected); “Probing mechanical selection in diverse eukaryotic genomes through accurate prediction of 3D DNA mechanics,” PMC11703244, DOI 10.1101/2024.12.22.629997 (the accessed record explicitly labels this a 2024 preprint). Its adapter-correction discussion is a follow-up lead, not a correction notice for S10, and no current journal-status claim is made. A July 2026 preprint on handles and looping times was identified as another context lead, not adopted as established evidence.

These results reinforce keeping assay geometry attached to cyclizability interpretation. They are not additional public article claims. This targeted search is not a complete 2025–2026 review or a completed correction/retraction audit. A dedicated cross-source update, later-version check, and claim-specific supplement review remain publication gates.

## Figures and tools

- Thermodynamics uses the existing original equal-composition schematic: `AAAACCCCGGGGTTTT` and `ACGTACGTACGTACGT`; each has four of each base, 50% GC, and 15 adjacent steps. No energy is computed.
- Mechanics adds an original code-native four-panel schematic. Text supplies each deformation and observable; SVGs are decorative, hidden from assistive technology. No source figure is traced and no empirical scales are invented.
- Evidence adds an ordered text ladder with questions and a caption denying automatic progression/proof. The design table is original editorial guidance.
- Methodology and data-source links point to existing local routes, verified from `src/app/genomics/docs/methodology/page.tsx` and `src/app/genomics/data-sources/page.tsx`. No live measurements, new browser presets, API layers, or validated occupancy predictions are asserted.
- Copying-fidelity specification and internal reading path are separate supporting artifacts. No pending article receives a public link.

## Review state after the source review

The internal review applied the eleven findings in the linked report. Bryant and
Erdel full-text access gaps were closed, relevant Basu/Schwarzer/Nuebler/Erdel
supplements and recent-paper methods were inspected, and dated notice metadata
was checked. S43–S45 extend the cited primary literature; the combined source
register now contains 49 sources. This is claim-specific review, not independent
analysis of every raw measurement, movie, mass spectrum, or simulation.

Authorship attribution is unchanged. Independent subject-matter sign-off and the
existing editorial-license decision remain pending before publication. Draft
implementation and source checking do not supply that approval. No deployment
performed. See the library log for interface verification, separately from the
scientific review record.
