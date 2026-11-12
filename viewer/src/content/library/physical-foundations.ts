import type { LibraryArticle } from '../library';

const thermodynamics = {
  id: 'santalucia', title: 'A unified view of polymer, dumbbell, and oligonucleotide DNA nearest-neighbor thermodynamics',
  citation: 'SantaLucia · PNAS · 1998', href: 'https://doi.org/10.1073/pnas.95.4.1460',
};
const torque = {
  id: 'bryant', title: 'Structural transitions and elasticity from torque measurements on DNA',
  citation: 'Bryant et al. · Nature · 2003', href: 'https://doi.org/10.1038/nature01810',
};
const cyclizability = {
  id: 'basu', title: 'Measuring DNA mechanics on the genome scale',
  citation: 'Basu et al. · Nature · 2021 (online 2020)', href: 'https://doi.org/10.1038/s41586-020-03052-3',
};
const elasticity = {
  id: 'marko', title: 'Stretching DNA', citation: 'Marko & Siggia · Macromolecules · 1995',
  href: 'https://doi.org/10.1021/ma00130a008',
};
const updatedMelting = {
  id: 'ke', title: 'High-throughput DNA melt measurements enable improved models of DNA folding thermodynamics',
  citation: 'Ke et al. · Nature Communications · 2025', href: 'https://doi.org/10.1038/s41467-025-60455-4',
};
const updatedCyclizability = {
  id: 'gordiychuk', title: 'Searching for sequence features that control DNA cyclizability',
  citation: 'Gordiychuk et al. · PNAS Nexus · 2026', href: 'https://doi.org/10.1093/pnasnexus/pgag167',
};
const methodology = {
  title: 'Polymer methodology', description: 'Check definitions and assumptions for the quantities displayed in Polymer.',
  href: '/genomics/docs/methodology',
};

export const THERMODYNAMICS_ARTICLE: LibraryArticle = {
  slug: 'dna-thermodynamics', title: 'DNA thermodynamics', collection: 'foundations', order: 3,
  description: 'Free energy, melting temperature, and why sequence order and experimental conditions belong with every prediction.',
  kind: 'Concept', subjects: ['physical-properties', 'methods'],
  terms: ['melting', 'Tm', 'free energy', 'enthalpy', 'entropy', 'stacking', 'nearest neighbor', 'salt', 'equilibrium', 'kinetics'],
  updated: '2026-11-12', status: 'Editorial draft',
  sections: [
    { id: 'quantities', title: 'Name the quantity and conditions', paragraphs: [
      'What does it mean to call one DNA sequence more stable than another? Start by naming the change being considered: two strands associating, a duplex opening, or a molecule deforming under force. Those questions require different measurements. A thermodynamic comparison is interpretable only when the states, conditions, and sign convention are specified.',
      'For duplex formation, the standard free-energy change can be expressed as ΔG° = ΔH° − TΔS°. Enthalpy and entropy contribute together; T is absolute temperature in kelvin. A negative standard formation free energy favors the duplex relative to the specified standard states. Actual populations also depend on concentrations. Reversing the reaction reverses the sign.',
    ], sourceIds: ['santalucia'], table: {
      caption: 'A thermodynamic value needs a definition', headings: ['Quantity', 'Typical units', 'Interpretation'], rows: [
        ['ΔH°', 'kcal/mol or kJ/mol', 'Standard enthalpy change for the stated reaction.'],
        ['ΔS°', 'cal/(mol·K) or J/(mol·K)', 'Standard entropy change; convert units before combining with enthalpy.'],
        ['ΔG° at T', 'kcal/mol or kJ/mol', 'Standard free-energy change at the stated temperature.'],
        ['Melting temperature, Tm', '°C or K, explicitly stated', 'A transition midpoint under a specified molecular model and conditions.'],
      ],
    } },
    { id: 'neighbors', title: 'Why neighboring bases matter', paragraphs: [
      'Nearest-neighbor models sum terms for adjacent base pairs and add initiation and, where appropriate, symmetry terms. SantaLucia reconciled parameter estimates from different experimental systems. These are effective duplex thermodynamic parameters: calling them stacking terms does not make them measurements of isolated stacking interactions or bending stiffness.',
      'A GC fraction discards arrangement. In the synthetic sequences below, both displayed sequences have the same base counts, but their adjacent pairs differ. Count the steps before comparing model outputs. This example establishes a difference in model inputs; it does not claim that every rearrangement changes free energy or that one of these sequences binds a protein more strongly.',
    ], sourceIds: ['santalucia'], figure: 'sequence' },
    { id: 'melting', title: 'A melting temperature belongs to an experiment', paragraphs: [
      'For a simple two-state duplex with equal concentrations of its complementary strands, Tm marks the temperature at which half the strands are duplexed. Unequal strand concentrations require a definition of the midpoint relative to the limiting strand. Ionic conditions, concentrations, and molecular design affect the prediction. Long heterogeneous DNA can have intermediate states; a short-duplex formula is not a universal chromosome melting model.',
      'Imagine two reports about the same sequence, one at a higher strand concentration than the other. A different transition midpoint need not mean that either sequence or instrument changed. Before interpreting a discrepancy, place the buffer, concentration, temperature protocol, and analysis model side by side. A single reported temperature cannot supply that missing context.',
    ], sourceIds: ['santalucia'] },
    { id: 'model-scope', title: 'A model has a molecular scope', paragraphs: [
      'Perfectly paired duplexes, mismatches, bulges, and hairpins require different parameter coverage. Ke and colleagues measured DNA hairpin melting at scale and developed revised models. Their 2025 study found substantial scope for improvement in modeling noncanonical motifs while recovering Watson–Crick stack parameters close to earlier bulk measurements. This does not establish one best model for every molecular design.',
      'A hairpin folds within one strand; a duplex forms between strands. Do not transfer the concentration dependence of a bimolecular association formula directly to an intramolecular hairpin transition. Match the molecular design and the fitted transition before interpreting a reported melting temperature.',
    ], sourceIds: ['ke', 'santalucia'] },
    { id: 'ensemble', title: 'A moving molecule still has measurable properties', paragraphs: [
      'A structural drawing represents one configuration. An ensemble describes a set of configurations and their statistical weights. A measurement can average over that motion, and a fitted model can summarize the result without specifying every configuration the molecule visits.',
      'The distinction matters when moving from thermal association to mechanical manipulation. Bryant and colleagues measured torque as stretched DNA was twisted and observed structural responses. Their experiment adds a controlled mechanical variable. It is not a measurement of the time required for every DNA transition in a nucleus.',
    ], sourceIds: ['bryant'] },
    { id: 'rates', title: 'An equilibrium preference is not a clock', paragraphs: [
      'A free-energy difference describes a preference between states under a stated model. A rate describes how quickly a process occurs. The distinction is logical: knowing how often a traveler is found in each of two rooms does not reveal how often the traveler crosses the doorway. Barriers and available routes matter.',
      'For DNA, ask which experiment supplies the clock. A temperature-dependent equilibrium calculation cannot, by itself, give an opening time, a protein residence time, or the speed of chromatin restoration. Those are additional questions with additional observables. Treat a free-energy diagram as an explanatory sketch unless its axes and kinetic parameters have actually been measured.',
    ] },
    { id: 'comparison', title: 'Compare like with like', paragraphs: [
      'Before comparing values, check the reaction direction, standard-state convention, units, temperature, sequence length, terminal structure, ionic assumptions, and parameter set. Ask whether the number is measured or calculated. If it is calculated, retain the model and its applicable range with the output.',
      'A useful next experiment changes one specified variable and measures the same observable under matched conditions. For an equal-composition sequence comparison, first define the duplexes and buffer, then compare measured association or melting behavior with the stated model prediction. A mismatch tests that prediction in that system; it does not automatically identify a cellular mechanism.',
      'The unresolved connection is how much a particular molecular preference contributes in a specified cellular setting. Recognition, recruitment, energy-consuming machinery, and competing interactions require their own evidence. Follow the mechanics reference to separate deformation from melting, and the evidence reference to design that next test.',
    ] },
  ],
  references: [thermodynamics, torque, updatedMelting],
  related: ['gc-content', 'sequence-complexity', 'dna-mechanics', 'physical-annotation-and-evidence', 'material-channel'],
  tools: [methodology],
};

export const DNA_MECHANICS_ARTICLE: LibraryArticle = {
  slug: 'dna-mechanics', title: 'Bending, twisting, stretching, and melting are different',
  description: 'Identify the deformation, observable, units, and scale before calling DNA flexible or stable.',
  kind: 'Method', collection: 'reference', order: 2, subjects: ['physical-properties', 'methods'],
  terms: ['bend', 'twist', 'stretch', 'melt', 'torque', 'persistence length', 'cyclizability', 'loop-seq', 'modulus', 'force', 'wormlike chain'],
  updated: '2026-11-12', status: 'Editorial draft',
  sections: [
    { id: 'question', title: 'Which experiment would answer the question?', paragraphs: [
      'A protein wraps DNA, a motor turns it, a bead pulls it, and a temperature ramp separates its strands. Each experiment concerns DNA, but each asks a different question. The word flexibility needs an operational definition: what is varied, what is observed, and which model connects them?',
      'Use the four sketches below as an experiment selector. They show idealized changes to the same kind of substrate, not four measured responses from one molecule. Their separation is a teaching device; an actual experiment can couple several deformations.',
    ], figure: 'mechanics' },
    { id: 'bending', title: 'Bending changes the direction of the molecular axis', paragraphs: [
      'In the ideal wormlike-chain model, a persistence length describes the decay of orientation correlations along a thermally fluctuating contour. It has units of length. It is related to bending rigidity through thermal energy within that model; it is not a count of bases that always remain straight.',
      'Marko and Siggia analyzed DNA stretching using this elastic-chain framework and examined electrostatic and other departures from its simplest form. A fitted persistence length therefore belongs to an experimental range and model. Applying that same fit to a very short sequence or a sharply bent structure requires justification.',
    ], sourceIds: ['marko'] },
    { id: 'twisting', title: 'Twisting requires a rotational boundary condition', paragraphs: [
      'Twist changes rotation around the molecular axis. Torque is the rotational counterpart of force, commonly reported in pN·nm; angles may be reported in radians or turns. In an elastic-rod convention, torsional rigidity has units of energy times length; dividing it by thermal energy gives a torsional persistence length. Always state the convention behind a reported modulus.',
      'A molecule whose ends can rotate can respond differently from one whose end rotations are constrained. Bryant and colleagues directly measured torque versus twist on stretched DNA. Report such measurements together with the applied force and rotational setup. They do not establish a universal torque or torsional response for every chromatin region.',
    ], sourceIds: ['bryant'] },
    { id: 'stretching', title: 'Stretching can first straighten a fluctuating chain', paragraphs: [
      'End-to-end extension is the separation of the ends along the pulling direction. Contour length follows the chain itself. Pulling can increase extension by suppressing bends before substantially increasing the contour length. A force–extension curve therefore contains information about configurations as well as molecular extension.',
      'In a model that allows the contour to lengthen, a stretch modulus relates tension to fractional extension of the contour. It is usually expressed in force units. Name the fitted model and force range before comparing such a modulus with another experiment. Bending persistence length and stretch modulus cannot be compared merely by ranking their numerical values.',
    ], sourceIds: ['marko'] },
    { id: 'melting', title: 'Melting changes strand association', paragraphs: [
      'Thermal melting asks about loss of duplex association as temperature changes under stated conditions. Free energy and a transition midpoint describe that question. They are not measurements of how much torque or curvature a duplex can sustain. Mechanical stresses can also drive structural changes, making the loading protocol part of the question.',
    ], sourceIds: ['santalucia', 'bryant'] },
    { id: 'cyclizability', title: 'A short-fragment looping assay measures another observable', paragraphs: [
      'Basu and colleagues developed loop-seq using a variable 50-base-pair sequence within a 100-base-pair duplex with complementary single-stranded overhangs. After a defined looping interval, unlooped molecules were digested and sequencing supplied a relative enrichment measure. Their intrinsic cyclizability was a fitted mean term used to reduce the dependence on tether position; it was not a direct long-chain persistence-length measurement.',
      'The study compared selected sequences with single-molecule looping measurements. Its supplement notes that scores from different sequence libraries can differ by an additive normalization constant. Before comparing datasets, check construct geometry, adapters, overhangs, salt, looping time, and normalization. A dimensionless enrichment score is not automatically a local bending modulus.',
    ], sourceIds: ['basu'] },
    { id: 'cyclizability-updates', title: 'An intrinsic score still needs a processing definition', paragraphs: [
      'Gordiychuk and colleagues used further bias-corrected cyclizability data in a 2026 statistical-mechanics study. Their methods distinguish the original tether-dependent measurements from a mean score and subsequent corrections for adapters and overhangs. Keep the processing version attached to the values being compared.',
      'Both static curvature and dynamic flexibility can contribute to looping. A model trained to predict an assay score therefore does not automatically identify a unique local stiffness or establish a cellular mechanism. The study compared predictions with molecular-dynamics simulations; that is a different validation step from measuring a new cellular response.',
    ], sourceIds: ['gordiychuk'] },
    { id: 'quantities', title: 'Keep the units beside the claim', paragraphs: [
      'The table is a comparison guide, not a conversion table. No universal formula converts a duplex formation free energy into a bending modulus. A physical model linking distinct observables needs assumptions and independent validation.',
    ], table: {
      caption: 'Observables, units, and interpretation limits', headings: ['Experiment', 'Observable / reported quantity', 'Limit'], rows: [
        ['Bending / elastic-chain fit', 'Persistence length: nm; bending rigidity: energy × length', 'A model and scale must accompany the estimate.'],
        ['Controlled rotation', 'Torque: pN·nm; twist: radians or turns', 'Force and freedom of end rotation matter.'],
        ['Pulling', 'Force: pN; extension: nm; stretch modulus: pN', 'End-to-end straightening and contour extension differ.'],
        ['Thermal strand association', 'Tm: °C or K; ΔG°: energy per mole', 'Concentrations, buffer, states, and sign convention matter.'],
        ['Loop-seq', 'Cyclizability: dimensionless log enrichment', 'Construct-dependent looping proxy, not a persistence length.'],
      ],
    }, sourceIds: ['marko', 'bryant', 'santalucia', 'basu'] },
    { id: 'test', title: 'Design a test at the relevant scale', paragraphs: [
      'Suppose two equal-composition sequences differ in a predicted property. Specify whether the prediction concerns melting, looping, shape, or another quantity. Measure that observable with matched constructs and conditions. Reserve independent sequences for evaluating a predictive model, and retain unsuccessful predictions alongside successful ones.',
      'Then ask a separate biological question: does changing that property alter the outcome of interest? Sequence edits may also change recognition sites and other features. Multiple designs and orthogonal measurements can distinguish possibilities more effectively than one sequence comparison. The evidence article develops those controls.',
      'What remains open for any new genomic application is whether the chosen assay and scale capture the deformation relevant in that cell. A useful physical annotation makes this question testable; its presence on a genome browser does not answer it.',
    ] },
  ],
  references: [elasticity, torque, thermodynamics, cyclizability, updatedCyclizability],
  related: ['dna-thermodynamics', 'physical-annotation-and-evidence', 'chromatin-maintenance', 'sequence-complexity'], tools: [methodology],
};

export const PHYSICAL_EVIDENCE_ARTICLE: LibraryArticle = {
  slug: 'physical-annotation-and-evidence', title: 'From a physical annotation to an explanation',
  description: 'Separate a prediction, a measurement, an association, and a causal claim when interpreting genomic properties.',
  kind: 'Method', collection: 'reference', order: 3, subjects: ['methods', 'physical-properties', 'epigenetics'],
  terms: ['causality', 'evidence', 'confounding', 'held-out', 'perturbation', 'intervention', 'prediction', 'mechanism', 'controls', 'phase separation'],
  updated: '2026-11-12', status: 'Editorial draft',
  sections: [
    { id: 'claim', title: 'Begin with a claim small enough to test', paragraphs: [
      'A colored track can show a predicted property, an experimental measurement, or a biological annotation. Those are different objects. Before connecting them, write the proposed claim as a sentence naming the quantity, genomic scale, cell type, outcome, and comparison. Ask which parts of that sentence were observed and which were inferred.',
      'This article is a methodological synthesis, not a universal grading system for experiments. The evidence ladder below identifies additional questions. Reaching an intervention does not make every causal interpretation valid, and a well-tested model can be useful even when its microscopic interpretation remains incomplete.',
    ], figure: 'evidence' },
    { id: 'prediction', title: 'Check a prediction against the quantity it predicts', paragraphs: [
      'An independent measurement should address the same observable under conditions relevant to the model. Compare a predicted melting quantity with a melting experiment, or an assay-specific looping prediction with a compatible looping measurement. An attractive correlation with a different annotation is not a substitute for that first comparison.',
      'Loop-seq provides a concrete example of operational definition: its sequencing enrichment summarizes looping in a particular construct and assay. Basu and colleagues also compared selected sequences using single-molecule looping measurements. This supports a connection between observables in their setting; it does not turn every sequence-based score into a direct mechanical measurement in cells.',
    ], sourceIds: ['basu'] },
    { id: 'association', title: 'Ask what else travels with the property', paragraphs: [
      'Imagine a synthetic study where predicted bendability correlates with expression. GC content, CpG density, regulatory motifs, repeat family, gene proximity, replication timing, and accessibility are candidate covariates to examine. Which matter depends on the actual question and dataset; this is an example design, not a claim that all of them explain one published result.',
      'Use matched-composition controls where appropriate and report the matching procedure. Specify whether the goal is prediction or causal interpretation, and justify each adjustment: accessibility, for example, may be an outcome or an intermediate in the proposed pathway. Compare predictive models with and without the physical feature on held-out genomic regions. Nearby windows and repeated copies can share information, so splitting individual windows at random may overstate independent predictive performance. A residual association motivates a test; it does not uniquely identify physical causation.',
    ] },
    { id: 'intervention', title: 'A perturbation narrows explanations in a specified system', paragraphs: [
      'Schwarzer and colleagues conditionally deleted Nipbl in adult mouse hepatocytes, reducing chromatin-associated cohesin. Contact-domain and peak signals disappeared from Hi-C maps while compartmental segregation persisted and became stronger. The intervention helped distinguish organizational contributions; a population contact map does not show the conformation of every individual chromosome.',
      'The inference belongs to that intervention and system. It does not mean that every boundary, contact, or transcriptional response is controlled identically. For a new experiment, measure the perturbation itself, relevant viability and state changes, and the intended outcome. A rescue or a second perturbation may help distinguish the proposed route from indirect effects.',
    ], sourceIds: ['schwarzer'] },
    { id: 'intervention-timing', title: 'Timing changes what a perturbation tests', paragraphs: [
      'The hepatocyte experiment assessed a conditional deletion over days. Popay and colleagues used acute NIPBL depletion in human hTERT RPE-1 cells in a 2026 study and found different effects when loops were being established during mitotic exit versus maintained in asynchronous cells. Some loops persisted after acute depletion. The original mouse result remains a useful example, but it is not a universal immediate response to NIPBL loss.',
      'Specify when the perturbation begins, when its target changes, and when the outcome is measured. An experiment on maintenance need not answer the same question as one on formation. Changes in recruitment, motor activity, cell state, and transcription also need to be distinguished before attributing a result to one route.',
    ], sourceIds: ['schwarzer', 'popay'] },
    { id: 'models', title: 'A model can explain a pattern without being unique', paragraphs: [
      'Nuebler and colleagues modeled chromosome organization using loop extrusion and compartmental segregation and compared behavior with organizational changes. Such a model links explicit assumptions to observables. Agreement is informative, but a contact map does not uniquely specify the microscopic trajectory of every chromosome.',
      'List competing explanations before fitting a model. Ask which future measurement would differ between them, and reserve that measurement for evaluation where possible. Parameters that reproduce one dataset can compensate for one another; identifying a mechanism requires more than finding one successful parameter combination.',
    ], sourceIds: ['nuebler'] },
    { id: 'discrimination', title: 'Choose an observation that competing mechanisms treat differently', paragraphs: [
      'Larson and colleagues demonstrated droplet formation by purified human HP1α in vitro, promoted by phosphorylation or DNA binding under their tested conditions. Erdel and colleagues examined pericentric heterochromatin in mouse fibroblasts and did not find the tested hallmarks of an HP1-driven liquid compartment. The latter study also used reconstituted droplets and human U2OS cells for complementary assays. These findings do not establish a universal material state for heterochromatin.',
      'A round nuclear focus, fusion-like behavior, or fluorescence recovery can motivate a material-state hypothesis. Ask whether polymer bridging, collapse, binding exchange, or another mechanism could produce a similar observation. The experiment must distinguish those possibilities in the relevant setting, rather than attach a mechanism to a shape.',
    ], sourceIds: ['larson', 'erdel'], table: {
      caption: 'An editorial design guide for discriminating evidence', headings: ['Observation', 'Additional question', 'Needed comparison'], rows: [
        ['A score predicts another track', 'Is the proposed physical quantity itself measured?', 'Independent assay of the defined observable.'],
        ['A property associates with expression', 'Do sequence covariates explain the association?', 'Matched backgrounds and held-out regions.'],
        ['A perturbation changes a contact map', 'Was the intended machinery changed, and what else changed?', 'Perturbation verification and orthogonal state measurements.'],
        ['A focus looks liquid-like', 'Do alternative mechanisms predict the same behavior?', 'Condition-dependent tests with different predicted outcomes.'],
      ],
    } },
    { id: 'sequence-edit', title: 'A sequence edit can change several things at once', paragraphs: [
      'Suppose an edit changes both a predicted physical property and a protein-binding motif. A subsequent expression change cannot by itself distinguish those routes. Design multiple sequences to vary the proposed property while holding relevant features as closely matched as possible, and independently measure recognition or recruitment where that alternative matters.',
      'Complete separation may be impossible because sequence, shape, chemistry, and recognition are coupled. State the remaining ambiguity rather than labeling one edit a clean physical intervention. Stronger explanations combine different perturbations, direct measurements, timing, and tests that could have contradicted the proposed mechanism.',
    ] },
    { id: 'limits', title: 'Write the limit beside the conclusion', paragraphs: [
      'A useful conclusion states what changed, in which system, under which conditions, and what remains unresolved. Specify biological replicates and the unit of inference. Thousands of correlated genomic windows do not become thousands of independent organisms or experiments.',
      'For a new Polymer application, begin with the displayed metric and its provenance, then identify the missing measurement or intervention. Model status must travel with the claim. Neither a useful predictor nor a polished interface validates all layers of an explanatory framework.',
      'The next question should be concrete: which observation would distinguish this explanation from its strongest alternative? That is a more productive endpoint than treating annotation as the final mechanism.',
    ] },
  ],
  references: [cyclizability,
    { id: 'schwarzer', title: 'Two independent modes of chromatin organization revealed by cohesin removal', citation: 'Schwarzer et al. · Nature · 2017', href: 'https://doi.org/10.1038/nature24281' },
    { id: 'nuebler', title: 'Chromatin organization by an interplay of loop extrusion and compartmental segregation', citation: 'Nuebler et al. · PNAS · 2018', href: 'https://doi.org/10.1073/pnas.1717730115' },
    { id: 'larson', title: 'Liquid droplet formation by HP1α suggests a role for phase separation in heterochromatin', citation: 'Larson et al. · Nature · 2017', href: 'https://doi.org/10.1038/nature22822' },
    { id: 'erdel', title: 'Mouse heterochromatin adopts digital compaction states without showing hallmarks of HP1-driven liquid–liquid phase separation', citation: 'Erdel et al. · Molecular Cell · 2020', href: 'https://doi.org/10.1016/j.molcel.2020.02.005' },
    { id: 'popay', title: 'Acute NIPBL depletion reveals in vivo dynamics of loop extrusion and its role in transcription activation', citation: 'Popay et al. · Nature Genetics · 2026', href: 'https://doi.org/10.1038/s41588-026-02516-y' },
  ],
  related: ['dna-mechanics', 'dna-thermodynamics', 'chromatin-maintenance', 'material-channel', 'genomic-coordinates'],
  tools: [methodology, { title: 'Data sources', description: 'Inspect the provenance and scope of the annotations used by Polymer.', href: '/genomics/data-sources' }],
};
