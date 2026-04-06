# Computational Assumptions Registry

Every computation in this platform rests on assumptions. This document makes each one explicit: what it is, why we use it, where it's valid, and what breaks if it's wrong.

Status key: **VALIDATED** (tested against external data) | **JUSTIFIED** (published basis, not independently tested here) | **UNJUSTIFIED** (no external basis) | **DOMAIN-LIMITED** (valid in a narrow range)

---

## A. Nearest-Neighbor Thermodynamics

### A1. Additivity of dinucleotide contributions
- **Assumption:** The free energy of a DNA duplex equals the sum of its nearest-neighbor dinucleotide steps.
- **Justification:** SantaLucia 1998 unified model; validated on >100 oligonucleotides with RMSE ~1°C for Tm prediction.
- **Domain:** Short oligonucleotides (6-60 nt) in aqueous buffer with defined NaCl.
- **What breaks:** Very long sequences where cooperative effects, supercoiling, or protein binding dominate.
- **Status:** JUSTIFIED (published, extensively replicated by community)

### A2. 1 M NaCl standard state
- **Assumption:** Default parameters are for 1 M NaCl, 37°C.
- **Justification:** Standard thermodynamic reference condition (SantaLucia 1998).
- **Domain:** The API applies these to genomic DNA which exists at ~150 mM NaCl equivalent.
- **What breaks:** The absolute values of ΔG change at physiological salt. The ranking of sequences by stability is largely preserved, but magnitude differs.
- **Status:** DOMAIN-LIMITED — salt correction available but default display uses 1M values
- **Validation needed:** Tier 1.12 (salt correction monotonicity)

### A3. Duplex context for genomic DNA
- **Assumption:** Genomic DNA is treated as a continuous double-stranded duplex.
- **Justification:** Most genomic DNA is indeed double-stranded in vivo.
- **Domain:** Does not apply to: single-stranded regions at replication forks, R-loops, G-quadruplexes, denatured bubbles, or single-stranded viral genomes.
- **What breaks:** At loci where DNA is actually single-stranded, duplex ΔG is not the relevant quantity.
- **Status:** JUSTIFIED (reasonable for majority of genome)

### A4. No protein context
- **Assumption:** Biophysical properties are computed for naked DNA, without nucleosomes, transcription factors, or other bound proteins.
- **Justification:** Intrinsic sequence properties are a baseline; protein context is cell-type-specific.
- **Domain:** Intrinsic properties predict accessibility/stability propensity, not actual state.
- **What breaks:** In vivo, proteins dominate local DNA structure. Intrinsic properties are one input among many.
- **Status:** JUSTIFIED — but UI must state "intrinsic sequence properties" not "cellular properties"

### A5. No topological constraints
- **Assumption:** DNA is modeled as an unconstrained linear polymer.
- **Justification:** Topological effects (supercoiling) are cell-state-dependent.
- **Domain:** Free DNA in solution.
- **What breaks:** In vivo supercoiling can alter stability by ~1 kcal/mol per 10 turns.
- **Status:** DOMAIN-LIMITED — should be noted in methodology

---

## B. Structural Parameters

### B1. Crystal structure averages represent solution behavior
- **Assumption:** Roll, tilt, twist, rise, slide, shift from Olson 1998 crystal survey represent the average conformation in solution.
- **Justification:** Olson 1998 averaged across hundreds of crystal structures; broadly consistent with NMR and MD.
- **Domain:** B-form DNA. Does not apply to A-form, Z-form, or non-canonical structures.
- **What breaks:** In regions that adopt non-B conformations, B-form structural parameters are incorrect.
- **Status:** JUSTIFIED

### B2. Curvature from roll/tilt accumulation
- **Assumption:** Local curvature = sqrt(mean(roll²) + mean(tilt²)) over a 21bp window.
- **Justification:** Standard approach for predicting intrinsic DNA bending (Bolshoy/Trifonov, De Santis).
- **Domain:** Works well for A-tracts and phased bends at ~10-50bp scale. At 1kb resolution, phase information is destroyed.
- **What breaks:** At 1kb averaging, curvature becomes a GC-correlated scalar that loses phase-dependent bending information.
- **Status:** DOMAIN-LIMITED — valid at per-step resolution, degraded at 1kb
- **Validation needed:** Tier 4.2 (A-tract known bending)

### B3. TRX deformability as flexibility proxy
- **Assumption:** The fraction of time a dinucleotide spends in BII backbone conformation (Heddi 2010) measures deformability.
- **Justification:** BII population correlates with crystallographic B-factors and MD flexibility.
- **Domain:** Single dinucleotide steps in B-DNA context.
- **What breaks:** Deformability is context-dependent; neighboring steps influence each other.
- **Status:** JUSTIFIED

---

## C. Derived Properties

### C1. Bubble propensity sigmoid parameters
- **Assumption:** Bubble propensity = sigmoid(-4.0 × (local_ΔG + 1.2)), center at -1.2 kcal/mol/step, gain 4.0.
- **Justification:** **NONE.** The center (-1.2) was chosen as "typical genome average" and the gain (4.0) is arbitrary.
- **Domain:** Unknown — these parameters have never been calibrated against experimental denaturation data.
- **What breaks:** If the actual relationship between local ΔG and bubble probability is not sigmoidal, or has different center/gain, the propensity values are meaningless probabilities.
- **Status:** UNJUSTIFIED
- **Validation needed:** Tier 3A (permanganate-seq comparison)

### C2. Context deviation interpretation
- **Assumption:** A dinucleotide step with ΔG higher than its local context is a "vulnerability."
- **Justification:** Physically reasonable — locally weaker steps are more likely to denature first.
- **Domain:** Relative ranking within a sequence.
- **What breaks:** In absolute terms, even a "weak" step in a GC-rich region may be stronger than a "strong" step in an AT-rich region.
- **Status:** JUSTIFIED (relative measure only)

### C3. CpG island definition thresholds
- **Assumption:** CpG islands: length ≥200bp, GC ≥0.5, CpG obs/exp ≥0.6.
- **Justification:** Gardiner-Garden & Frommer 1987 definition, widely adopted.
- **Domain:** Universal standard.
- **Status:** VALIDATED (community standard, extensively benchmarked)

---

## D. Motif Detection

### D1. G-quadruplex regex
- **Assumption:** G4 = G₃₊N₁₋₇G₃₊N₁₋₇G₃₊N₁₋₇G₃₊.
- **Justification:** Standard G4 motif definition (Huppert & Balasubramanian 2005).
- **Domain:** Predicts potential G4-forming sequences. Does not guarantee folding.
- **What breaks:** Not all sequences matching this regex form stable G4s; many G4s have bulges or longer loops not captured.
- **Status:** JUSTIFIED — but should note "predicted, not confirmed"
- **Validation needed:** Tier 3B (G4-seq comparison)

### D2. Z-DNA propensity threshold
- **Assumption:** Z-prone = alternating purine-pyrimidine ≥8bp with mean Z-penalty < 2.5 kcal/mol.
- **Justification:** 2.5 threshold chosen to include CG/CA/TG dinucleotides but exclude purely AT.
- **Domain:** Predicts Z-forming potential under negative supercoiling.
- **What breaks:** Threshold is semi-arbitrary; in vivo Z-DNA formation depends on torsional stress.
- **Status:** DOMAIN-LIMITED

---

## E. Resolution and Averaging

### E1. 1kb windowed averaging preserves biophysical information
- **Assumption:** Averaging per-dinucleotide properties over 1000bp windows retains meaningful variation.
- **Justification:** Isochore theory (Bernardi); GC content varies meaningfully at 1-100kb.
- **Domain:** Properties that track GC (stability, Tm) retain their gradient. Properties that depend on phase (periodicity, some curvature) do not.
- **What breaks:** Periodicity at 10.5bp is completely averaged out at 1kb (confirmed: Phase 1 validation). Curvature loses phase information.
- **Status:** DOMAIN-LIMITED — valid for thermodynamic properties, invalid for structural properties
- **Validation needed:** Tier 5 (PCA dimensional independence)

### E2. Multiple tracks from same parameters = independent information
- **Assumption:** The 64 biophysical columns provide 64 dimensions of information.
- **Justification:** **NONE at 1kb resolution.** Most thermodynamic tracks are GC-derivatives.
- **Domain:** At per-dinucleotide resolution, properties are more distinct. At 1kb, they collapse.
- **Status:** UNJUSTIFIED until Tier 5 PCA determines effective dimensionality

---

## F. Physics Linter (evaluate_design)

### F1. Flag thresholds predict construct behavior
- **Assumption:** Flags like LOW_STABILITY, Z_FORM_PRONE, HOMOPOLYMER predict real design problems.
- **Justification:** **NONE.** Thresholds are internally defined, not calibrated against construct performance.
- **Domain:** Unknown.
- **What breaks:** If flagged sequences perform fine and unflagged sequences fail, the linter is misleading.
- **Status:** UNJUSTIFIED
- **Validation needed:** Tier 3G (MPRA construct performance)

### F2. CpG island detection as warning
- **Assumption:** CpG islands in constructs warrant a warning flag.
- **Justification:** CpG islands are targets for methylation silencing in mammalian cells.
- **Domain:** Relevant for stable expression constructs; less relevant for transient assays.
- **Status:** JUSTIFIED (well-established biology)

---

## G. Evidence Classification

### G1. Evidence class D ("Deterministic") for biophysics
- **Assumption:** Biophysics tracks deserve evidence class D because they are reproducible computations.
- **Justification:** Computationally reproducible ≠ biologically validated.
- **Domain:** D correctly describes the computation. It does not describe the biological relevance.
- **What breaks:** Users may interpret D as "established fact" rather than "computed from model."
- **Status:** JUSTIFIED for computational reproducibility, UNJUSTIFIED for biological interpretation
- **Action needed:** Consider whether D needs a qualifier, or whether some tracks should be H

---

*Last updated: 2026-04-06*
*This document is a living registry. As validation results come in, statuses will be updated.*
