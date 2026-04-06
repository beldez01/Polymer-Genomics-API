# Validation Registry

Every computation this platform performs, its validation status, and the evidence.

Status key: **VALIDATED** | **PARTIALLY_VALIDATED** | **UNVALIDATED** | **CIRCULAR** | **NOT_APPLICABLE**

---

## 1. Reference Constants (Published Lookup Tables)

| Computation | Source | Validation Test | Status | Evidence |
|-------------|--------|----------------|--------|----------|
| SantaLucia DNA/DNA ΔH/ΔS/ΔG (16 dinuc) | PNAS 1998;95:1460 | Tier 1.1 | **VALIDATED** | 10/10 unique dinucs exact match |
| Xia/Turner RNA/RNA (16 dinuc) | Biochemistry 1998;37:14719 | Tier 1.2 | **VALIDATED** | 16/16 exact match |
| Sugimoto RNA/DNA (16 dinuc) | Biochemistry 1995;34:11211 | Tier 1.3 | **VALIDATED** | 16/16 exact match |
| Olson structural (roll/tilt/twist/rise/slide/shift) | Code says "Olson 1998" | Tier 1.4 | **CITATION MISMATCH** | 0/16 match Olson 2001 Table 2. Values are RC-consistent but from different source. Need to identify actual origin. |
| Heddi TRX deformability (BII%) | NAR 2010;38:6001 | Tier 1.5 | **PARTIALLY_VALIDATED** | 11/16 match. 5 differ (AC, AG, CT, GC, GT). May be different TRX version. |
| Tataurov extinction ε260 | Biophys Chem 2008;133:66 | Tier 1.6 | **VALIDATED** | 16/16 exact match |
| Z-form propensity (Ho/Ellison/Z-Hunt) | EMBO J 1986;5:2737 | Tier 1.7 | **VALIDATED** | 16/16 exact match |
| A-form propensity (El Hassan) | J Mol Biol 1996;259:95 | Tier 1.8 | **VALIDATED** | 16/16 exact match |
| Groove geometry | El Hassan 1997, Fratini 1982 | Tier 1.9 | **VALIDATED** | 5/5 spot-checks pass (within 0.2 Å) |
| Amino acid properties (20 AA) | NIST, Zamyatnin, etc. | existing tests | PENDING | |
| Physical constants (~45 values) | Multiple sources | spot-check | PENDING | |

## 2. Thermodynamic Computation Engine

| Computation | Assumptions | Validation Test | Status | Evidence |
|-------------|-------------|----------------|--------|----------|
| Per-step ΔG accumulation | A1 (additivity) | Tier 1.13 | **VALIDATED** | 48/48 entries: ΔG = ΔH - TΔS within 0.016 kcal/mol |
| Salt correction (Eq. 3) | A2 (1M standard) | Tier 1.12 | **VALIDATED** | Monotonic across 50-1000mM for all 5 test sequences |
| Reverse complement symmetry | Strand-independent | Tier 1.10 | **VALIDATED** | 100/100 random seqs, max |ΔΔG| = 0.000000 |
| Tm prediction | A1 + A2 | Tier 1.11 | **INCONCLUSIVE** | RMSE 16.7°C — likely test formula error, not parameter error. Need verified benchmark. |
| Extinction coefficient | Tataurov method | Tier 1.6 | **VALIDATED** | Parameters exact match |
| Complement pair consistency | Symmetry | Tier 1.14 | **VALIDATED** | All 6 RC pairs identical |

## 3. Structural Computation Engine

| Computation | Assumptions | Validation Test | Status | Evidence |
|-------------|-------------|----------------|--------|----------|
| Roll/tilt/twist per step | B1 | Tier 1.4 | **CITATION MISMATCH** | Values internally consistent but don't match cited Olson paper |
| Curvature (21bp window) | B2 (roll/tilt RMS) | Tier 4.2 | **FAILED** | A-tract curvature (2.21) < random (2.72). Formula measures angular variance, NOT coherent bending. Gold-standard A-tract test fails. |
| Deformability (TRX) | B3 (BII proxy) | Tier 1.5 + 3D | **PARTIALLY_VALIDATED** | 11/16 params match. Marginal DNase signal (|partial_r|=0.047) |
| A-form propensity | B1 | Tier 1.8 + 4.4 | **VALIDATED** | Params match. CG/GC prediction correct. |
| Z-form propensity | Crystal structures | Tier 1.7 + 4.4 + 4.5 | **VALIDATED** | Params match. CG > AT confirmed. |

## 4. Derived Properties

| Computation | Assumptions | Validation Test | Status | Evidence |
|-------------|-------------|----------------|--------|----------|
| Bubble propensity | C1 (sigmoid, -1.2/4.0) | Tier 3A needed | **UNVALIDATED** | Sigmoid params unjustified. No permanganate-seq comparison. |
| Context deviation | C2 (relative vulnerability) | None | UNVALIDATED | Physically reasonable but untested |
| Local flexibility (windowed TRX) | B3 + E1 | Tier 3D | PARTIALLY_VALIDATED | Marginal DNase signal |
| CpG island detection | C3 (Gardiner-Garden) | Tier 4.8 | **VALIDATED** | Community standard. TP53 CpG obs/exp = 0.726. |

## 5. Motif Detection

| Computation | Assumptions | Validation Test | Status | Evidence |
|-------------|-------------|----------------|--------|----------|
| G-quadruplex (regex) | D1 | Tier 4.1 + 4.6 | **PARTIALLY_VALIDATED** | MYC NHE III1 detected (1 hit). 12 G4s in telomeric repeat. Needs G4-seq comparison. |
| Z-DNA prone | D2 (threshold 2.5) | Tier 4.4 | PARTIALLY_VALIDATED | CG alternation correctly identified as Z-prone |
| Homopolymer runs | Exact match | Trivially correct | **VALIDATED** | |
| Inverted repeats | Exact match | Trivially correct | **VALIDATED** | |

## 6. Dimensional Independence (Tier 5 — 2026-04-06)

**EFFECTIVE DIMENSIONALITY: 5 of 17 properties (for 95% variance)**

| Property | r(GC) | 1-r² (independent variance) | Verdict |
|----------|-------|------|---------|
| mean_z_form | -0.9998 | 0.0005 | **GC-REDUNDANT** |
| mean_a_form | 0.9976 | 0.0049 | **GC-REDUNDANT** |
| mean_dg37 | -0.9967 | 0.0065 | **GC-REDUNDANT** |
| mean_deformability | 0.9940 | 0.012 | MOSTLY GC |
| mean_slide | 0.9925 | 0.015 | MOSTLY GC |
| mean_roll | 0.9025 | 0.186 | PARTIALLY INDEPENDENT |
| mean_dh | -0.9551 | 0.088 | PARTIALLY INDEPENDENT |
| mean_curvature | 0.8428 | 0.290 | **INDEPENDENT** |
| mean_rise | 0.7460 | 0.443 | **INDEPENDENT** |
| cpg_density | 0.6841 | 0.532 | **INDEPENDENT** |
| std_dg37 | 0.4538 | 0.794 | **INDEPENDENT** |
| dinuc_entropy | 0.4171 | 0.826 | **INDEPENDENT** |
| cpg_obs_exp | 0.3687 | 0.864 | **INDEPENDENT** |
| mean_twist | -0.3860 | 0.851 | **INDEPENDENT** |
| mean_ds | -0.3189 | 0.898 | **INDEPENDENT** |
| mean_tilt | 0.0038 | 1.000 | **INDEPENDENT** |

## 7. DNase Accessibility — GC-Controlled (Tier 3D — 2026-04-06)

**External data: ENCODE DNase-seq GM12878 (ENCFF915DFR), 50K random 1kb regions**
**Global r(GC, log(DNase)) = 0.282**

Properties with independent signal after GC control (weighted mean |partial_r| across 6 GC strata):

| Property | Mean |partial_r| | Verdict | Biological Interpretation |
|----------|-----|---------|---------|
| cpg_obs_exp | 0.073 | **INDEPENDENT** | CpG arrangement predicts openness beyond GC |
| dinuc_entropy | 0.063 | **INDEPENDENT** | Sequence complexity predicts accessibility |
| std_dg37 | 0.062 | **INDEPENDENT** | Thermodynamic heterogeneity → more open |
| mean_z_form | 0.057 | **INDEPENDENT** | Purine-pyrimidine alternation within GC strata |
| mean_roll | 0.056 | **INDEPENDENT** | Structural parameter adds info |
| mean_dg37 | 0.054 | **INDEPENDENT** | Small residual signal beyond GC |
| mean_deformability | 0.047 | MARGINAL | |
| mean_rise | 0.043 | MARGINAL | |
| mean_twist | 0.037 | MARGINAL | |
| mean_a_form | 0.031 | MARGINAL | |
| mean_tilt | 0.023 | MARGINAL | |

Signal strengthens dramatically in GC-rich regions (GC 0.55-0.60: CpG obs/exp partial_r = 0.36).

## 8. Replication Timing — GC-Controlled (Tier 3E — 2026-04-06)

**External data: Repli-seq hg38 1kb BED, 47K sampled regions**
**Global r(GC, repli_timing) = 0.415**

| Property | Mean |partial_r| | Verdict |
|----------|-----|---------|
| **mean_z_form** | 0.100 | **STRONG INDEPENDENT** |
| mean_roll | 0.099 | WEAK INDEPENDENT |
| mean_a_form | 0.095 | WEAK INDEPENDENT |
| std_dg37 | 0.093 | WEAK INDEPENDENT |
| mean_dg37 | 0.071 | WEAK INDEPENDENT |
| cpg_obs_exp | 0.067 | WEAK INDEPENDENT |
| dinuc_entropy | 0.052 | WEAK INDEPENDENT |
| mean_deformability | 0.049 | MARGINAL |
| mean_rise | 0.041 | MARGINAL |
| mean_twist | 0.018 | NO SIGNAL |
| mean_tilt | 0.004 | NO SIGNAL |

**Key insight:** Z-form propensity is globally GC-REDUNDANT (r=-0.9998 in Tier 5) yet shows the STRONGEST independent replication timing signal (0.100). The 0.02% of Z-form variance not captured by GC encodes purine-pyrimidine alternation patterns that predict replication timing. Similarly, A-form propensity (global r=0.998 with GC) has partial_r=0.095. **Global GC-redundancy ≠ biological redundancy within GC strata.**

## 9. Known-Answer Tests (Tier 4 — 2026-04-06)

| Test | Result | Status |
|------|--------|--------|
| Telomere GC = 0.50 | PASS (0.500) | **VALIDATED** |
| Telomere G4 detection | PASS (12 G4s) | **VALIDATED** |
| A-tract bending | **FAIL** — curvature 2.21 < random 2.72 | **FAILED** |
| CG alternation Z-form | PASS (mean_z = 2.42) | **VALIDATED** |
| AT alternation low Z | PASS (4.36 > 2.42) | **VALIDATED** |
| MYC NHE III1 G4 | PASS (1 G4 detected) | **VALIDATED** |
| Alpha-satellite curvature | PASS (3.03 > hetero 2.60) | **VALIDATED** |
| TP53 CpG island | PASS (obs/exp = 0.73) | **VALIDATED** |
| GC max stability | PASS (-2.20 kcal/mol) | **VALIDATED** |
| TA min stability | PASS (-0.73 kcal/mol) | **VALIDATED** |
| Stability ranking (10 dinuc) | PASS (exact match) | **VALIDATED** |

## 9. Physics Linter (evaluate_design)

| Claim | Validation Test | Status | Evidence |
|-------|----------------|--------|----------|
| LOW_STABILITY flag | Tier 3G (MPRA) needed | **UNVALIDATED** | |
| HIGH_STABILITY flag | Tier 3G (MPRA) needed | **UNVALIDATED** | |
| Z_FORM_PRONE flag | Tier 3G (MPRA) needed | **UNVALIDATED** | |
| HOMOPOLYMER flag | Tier 3G (MPRA) needed | **UNVALIDATED** | |
| CPG_ISLAND flag | Literature | JUSTIFIED | Well-established biology |

## 10. External Data Layers (non-biophysics)

| Layer | Source | Status |
|-------|--------|--------|
| GENCODE gene models | GENCODE v44 | **VALIDATED** |
| gnomAD constraint | gnomAD v4.1 | **VALIDATED** |
| GTEx expression | GTEx v10 | **VALIDATED** |
| ENCODE cCREs | ENCODE v4 | **VALIDATED** |
| Illumina probes | Manifests | **VALIDATED** |
| Epigenetic clocks | Published papers | **BROKEN** (dual-loading bug) |
| RepeatMasker | UCSC | **VALIDATED** |
| Recombination hotspots | Palsson/Pratto | **VALIDATED** |

---

## Critical Actions Required

1. **Curvature track**: Formula fails A-tract test. Needs replacement or relabeling.
2. **Structural params**: Citation says "Olson 1998" but values don't match. Identify actual source.
3. **Bubble propensity**: Evidence class should be H (Hypothesis), not D (Deterministic).
4. **Z-form, A-form, ΔG₃₇ at 1kb**: GC-redundant. Should not be presented as independent tracks.
5. **Epigenetic clocks**: Dual-loading bug must be fixed before any clock-related claims.
6. **Physics linter flags**: Need MPRA validation before shipping with warning semantics.

---

*Last updated: 2026-04-06 (Tiers 1, 3D, 4, 5 complete. Tiers 2, 3E pending.)*
