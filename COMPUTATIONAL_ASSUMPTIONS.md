# Computational Assumptions Registry

Every computation in this platform rests on assumptions. This document makes each one explicit: what it is, why we use it, where it's valid, and what breaks if it's wrong.

Status key: **VALIDATED** (tested against external data) | **JUSTIFIED** (published basis, not independently tested here) | **UNJUSTIFIED** (no external basis) | **DOMAIN-LIMITED** (valid in a narrow range)

---

## FOUNDATIONAL: The GC–Arrangement Decomposition

> **Read this section first. It governs the interpretation of every biophysical track in the platform.**

All nearest-neighbor biophysical parameters are functions of dinucleotide frequencies. GC content constrains the marginal base frequencies, but it does **not** uniquely determine the dinucleotide frequencies — many different dinucleotide distributions are consistent with the same GC. The residual freedom is the **arrangement space**.

**Experiment 21 (The Arrangement Envelope)** quantifies this exactly via linear programming. At each GC level, the LP finds the dinucleotide frequency distribution that minimizes and maximizes each biophysical parameter, subject to the constraint that marginal base frequencies are consistent with that GC. The results, at genome-average GC = 0.41:

| Parameter | Arrangement Capacity | Interpretation |
|-----------|---------------------|----------------|
| Rise | **87%** | Almost entirely arrangement-determined |
| Minor Groove Width | **84%** | Almost entirely arrangement-determined |
| Twist | **83%** | Almost entirely arrangement-determined |
| Roll | **81%** | Almost entirely arrangement-determined |
| Stacking ΔS | **64%** | Majority arrangement-determined |
| Major Groove Width | **64%** | Majority arrangement-determined |
| Slide | **59%** | Mixed |
| Stacking ΔH | **55%** | Mixed |
| Deformability (TRX) | **44%** | Mixed |
| Extinction ε₂₆₀ | **37%** | Majority composition-determined |
| A-Form Propensity | **33%** | Majority composition-determined |
| Stacking ΔG₃₇ | **31%** | Majority composition-determined |
| Z-Form Propensity | **9%** | Almost entirely composition-determined |

**Arrangement capacity** = (LP_max − LP_min at fixed GC) / (global LP_max − global LP_min across all GC levels). It measures the fraction of a parameter's total range accessible by dinucleotide reordering alone.

### Implications for every analysis in this platform

1. **Parameters with capacity >60% (rise, groove width, twist, roll) carry information that GC cannot see.** Controlling for GC does not remove their signal — it isolates it. These parameters are the strongest candidates for GC-independent biological prediction.

2. **Parameters with capacity <35% (ΔG₃₇, A-form, Z-form) are predominantly GC proxies.** Correlations between these parameters and biological outcomes must be interpreted with extreme caution — partial correlations after GC correction will be small, and raw correlations will largely recapitulate GC.

3. **The 31% capacity of ΔG₃₇ has been confirmed empirically.** In Exp 03 (TE silencing), the decomposition M0 → M0.5 (adding GC) gained +0.063 AUROC. The further gain M0.5 → M1 (adding biophysics beyond GC) was +0.030. The ratio 0.030/0.093 = 32% — matching the LP prediction to within 1%.

4. **Z-form's 9% capacity is real and biologically exploited.** Despite near-perfect GC correlation (r = -0.9998), Z-form carries the strongest independent replication timing signal (partial r = 0.100 within GC strata). The 9% corridor encodes purine-pyrimidine alternation patterns invisible to GC.

5. **The arrangement hierarchy predicts experimental outcomes.** Across Exp 01, 03, 17, 18, 20, and Tier 5, the parameters that succeed in GC-independent tests are consistently those with high arrangement capacity, and the parameters that fail are those with low capacity.

**Reference**: `internal/InSilicoExperiments/exp21_gc_conditional_variance/` — LP proof, figures, cross-experiment synthesis.

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
- **What breaks:** Periodicity at 10.5bp is completely averaged out at 1kb (confirmed: Phase 1 validation). Curvature loses phase information. At 1kb, the Central Limit Theorem squeezes the distribution of mean parameter values toward the random null — most of the arrangement envelope (Exp 21) is inaccessible to single 1kb windows under random shuffling, though it remains accessible through biologically structured sequences.
- **Resolution gradient (Exp F):** Curvature ATAC AUC: 0.587 at 147bp → 0.520 at 1kb. Periodicity partial r: -0.067 at 147bp → -0.009 at 1kb. Structural properties with high arrangement capacity (rise 87%, twist 83%) become more informative at finer resolution because individual windows sample more of the arrangement space.
- **Status:** DOMAIN-LIMITED — valid for thermodynamic properties at any resolution; structural properties require sub-1kb resolution for full information content
- **Validation:** Tier 5 (PCA), Exp F (resolution sweep), Exp 21 (theoretical bounds)

### E2. Multiple tracks from same parameters = independent information
- **Assumption:** The 64 biophysical columns provide 64 dimensions of information.
- **Justification:** **FALSE at 1kb resolution.** Tier 5 PCA finds 5 effective dimensions (95% variance). PC1 (61%) is GC content.
- **Arrangement envelope (Exp 21) explains the structure:** Parameters with low arrangement capacity (<35%: ΔG₃₇, A-form, Z-form) collapse onto the GC axis (PC1). Parameters with high arrangement capacity (>60%: rise, twist, roll, groove width) project onto PCs 2-5 and carry independent information. Effective dimensionality = 1 (composition) + 4 (arrangement axes).
- **Domain:** At per-dinucleotide resolution, properties are more distinct. At 1kb, most collapse to GC. At 147bp (nucleosome scale), ≥3 effective dimensions emerge (Exp F).
- **Status:** VALIDATED — Tier 5 + Exp 21 LP provide exact decomposition

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
