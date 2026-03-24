# GPU Cross-Layer Correlation Analysis: Ontological Framework & Test Plan

## The Question

**How much of genome biology is determined by the material properties of DNA as a polymer?**

This is not "correlate everything with everything." The correlation matrix tests a specific hypothesis from the Polymer Evolution framework: that intrinsic sequence-derived material properties (stacking energy, curvature, groove geometry, persistence length) predict — and in some cases determine — biological outcomes (chromatin state, gene regulation, mutation rate, replication timing, evolutionary conservation).

---

## Ontological Hierarchy of Layers

The data layers are NOT all equivalent. They form a causal hierarchy:

### Tier 0: Immutable Material Properties (sequence-intrinsic)
*Computed from DNA sequence alone. Cannot be changed by the cell without changing the sequence.*

| Column | What It Measures | Physical Basis |
|--------|-----------------|----------------|
| gc_content | Base composition | Fundamental |
| stacking_dg37 | Thermodynamic stability (kcal/mol) | SantaLucia NN stacking |
| melting_temp | Strand separation temperature | Derived from stacking |
| curvature | Intrinsic bending (rad/bp) | Bolshoy wedge model |
| groove_width | Minor groove accessibility (Å) | El Hassan structural data |
| dipole_density | Electrostatic asymmetry | Charge distribution |
| periodicity_power | 10.5bp AA/TT phasing | FFT of dinucleotide signal |
| deformability | Local flexibility | Olson flexibility parameters |
| mgw_mean, prot_mean, roll_mean, helt_mean | DNA shape | DNAshapeR pentamer lookup |
| kmer_complexity | Sequence complexity | Shannon entropy |
| dinucleotide_entropy | Compositional diversity | Information content |

**These are the INDEPENDENT VARIABLES of the analysis.**

### Tier 1: Methylation-Modulable Properties (sequence + epigenetic)
*Computed from sequence CpG content. Represent the POTENTIAL for methylation to perturb material properties — not actual methylation state.*

| Column | What It Measures |
|--------|-----------------|
| cpg_count, cpg_density, cpg_obs_exp | CpG distribution |
| meth_delta_g, meth_delta_tm | Predicted methylation thermodynamic perturbation |
| meth_sensitivity | How much methylation changes local mechanics |
| methylation_capacity | Total methylation potential per window |
| demethylation_cost, oxidation_depth | TET oxidation cascade energy |
| taut_relaxed | CGI bistability threshold (snap-band) |

**These are INTERMEDIATE VARIABLES — they connect material properties to epigenetic regulation.**

### Tier 2: Predicted Polymer Physics (sequence-derived, higher-order)
*Computed from Tier 0 properties using polymer physics models.*

| Column | What It Measures |
|--------|-----------------|
| correlation_length | Perturbation propagation distance (Green's function) |
| integrated_response | Total mechanical connectedness |
| perturbation_reach | Distance-weighted broadcast range |
| response_asymmetry | Directional bias of signal propagation |
| g4_density, g4_max_score | G-quadruplex propensity |
| bubble_propensity, melting_cooperativity, melting_width | Strand separation dynamics |
| dominant_period | Dominant dinucleotide periodicity |

**These are DERIVED PREDICTIONS from the material model.**

### Tier 3: Measured Biology (experimental, cell-type-dependent)
*From experiments. These are what the material properties should PREDICT.*

| Column | What It Measures | Source |
|--------|-----------------|--------|
| repli_gm12878 | Replication timing (early/late) | Repli-seq |
| gene_density, gene_bp_fraction | Gene content | GENCODE v44 |
| te_line/sine/ltr/dna/simple/total_fraction | Transposable element content | RepeatMasker |
| ccre_density | Regulatory element density | ENCODE cCRE v4 |
| histone_h3k4me3_gm12878 | Active promoter mark | ENCODE ChIP-seq |
| histone_h3k27me3_gm12878 | Polycomb repressive mark | ENCODE ChIP-seq |
| histone_h3k4me1_gm12878 | Enhancer mark | ENCODE ChIP-seq |
| histone_h3k27ac_gm12878 | Active enhancer mark | ENCODE ChIP-seq |
| chromhmm_active_frac_e029 | Chromatin state | ChromHMM 15-state |
| phylop_mean, phastcons_mean | Evolutionary conservation | 100-way alignment |
| fragility_score | Genome fragility | Composite (biophysics + non-B + breakpoints) |

**These are the DEPENDENT VARIABLES — the biological outcomes to explain.**

### Tier 4: Measured Biology (separate tables, not in biophysics)
*Additional experimental data from separate tables.*

| Table | Columns | What It Measures |
|-------|---------|-----------------|
| tf_binding_signal | 15 TF×cell combos | Transcription factor occupancy |
| accessibility_signal | DNase + ATAC | Chromatin openness |
| mutation_density | Pan-cancer + tissue rates | Somatic mutation rate |
| hic_compartment | PC1 eigenvector | A/B compartment (3D genome) |
| conservation.scores | phyloP, phastCons (mean + max) | Evolutionary constraint |
| fragility.composite_score | fragility + components | Genome breakage propensity |
| fragility.nonb_dna | G4, Z-DNA, cruciform, R-loop, triplex | Non-B DNA structures |

---

## The GC Confound (THE critical issue)

GC content correlates with almost everything:
- stacking_dg37: r ≈ -0.999 (by definition — NN params are GC-dependent)
- melting_temp: r ≈ 0.999
- replication_timing: r ≈ 0.5-0.6 (GC-rich = early replicating)
- gene_density: r ≈ 0.4-0.5 (genes cluster in GC-rich isochores)
- conservation: r ≈ 0.3-0.4
- te_line_fraction: r ≈ -0.4 (LINEs prefer AT-rich regions)

**The raw Pearson matrix will show that "everything correlates with everything" because GC content is the hidden variable driving all of them.**

This is why **Analysis 3 (GC-partialed correlation) is the KEY OUTPUT.** It asks:
*After removing the effect of GC content, which material properties STILL predict biology?*

If curvature predicts nucleosome occupancy after controlling for GC, that's a real material effect.
If stacking energy predicts mutation rate after controlling for GC, that's a real thermodynamic effect.
If the partial correlation drops to zero, GC was the only driver.

---

## The 9 Analyses (with ontological justification)

### Analysis 1: Raw Pearson Correlation Matrix
**Purpose**: Establish the baseline correlation structure.
**Expected**: Strong block structure. Tier 0 properties highly intercorrelated (all driven by GC). Tier 3 biology moderately correlated with Tier 0.
**Figure**: Full heatmap, clustered.

### Analysis 2: Spearman Rank Correlation Matrix
**Purpose**: Capture non-linear monotonic relationships.
**Expected**: Similar to Pearson but may reveal relationships where the rank order matters more than the magnitude (e.g., extreme GC bins may have different biology than the linear trend predicts).

### Analysis 3: GC-Partialed Correlation Matrix (THE KEY OUTPUT)
**Purpose**: Remove the GC confound. Reveal which material→biology connections are INDEPENDENT of base composition.
**Expected findings** (hypotheses to test):
- r(curvature, replication_timing | GC) > 0: curved DNA replicates differently regardless of GC
- r(g4_density, fragility | GC) > 0: G4 structures cause fragility independent of GC
- r(meth_sensitivity, chromhmm_active | GC) ≠ 0: methylation mechanics predict chromatin state beyond CpG density
- r(deformability, tf_binding | GC) ≠ 0: flexible DNA attracts TFs independent of GC
- r(stacking_dg37, mutation_rate | GC) → 0: if this drops to zero, stacking energy was just a proxy for GC all along

**This matrix is the NAR paper Figure 1.**

### Analysis 4: Per-Chromosome Pearson
**Purpose**: Test whether material→biology relationships are consistent across chromosomes, or driven by a few unusual chromosomes (e.g., chr19 is gene-dense, chrX has unique replication).
**Expected**: Core relationships should be consistent (±0.1) across autosomes. chrX and chrY may deviate.

### Analysis 5: Per-Isochore Pearson
**Purpose**: Test whether relationships hold WITHIN GC-composition bins.
**Isochore bins**: L1 (GC<37%), L2 (37-41%), H1 (41-46%), H2 (46-53%), H3 (>53%)
**Expected**: If material properties predict biology within each isochore, the relationship is not just an isochore-level artifact. This is a finer-grained version of the GC-partialing.

### Analysis 6: PCA (top 20 components)
**Purpose**: Identify the independent dimensions of genomic variation.
**Expected**:
- PC1 ≈ GC/isochore axis (explaining ~40-60% of variance)
- PC2 ≈ gene density / regulatory axis
- PC3 ≈ repeat content axis
- PC4+ ≈ independent material properties (curvature, G4, deformability)
**Key question**: How many PCs are needed to capture 90% of variance? If 3-5, the genome is low-dimensional. If 15+, there are many independent material axes.

### Analysis 7: UMAP Embedding (100K subsample)
**Purpose**: Visualize the high-dimensional structure of 1kb genomic windows.
**Expected**: Clusters by isochore class, with gene-rich/gene-poor separation. Possibly visible separation of centromeric, telomeric, and pericentromeric regions.
**Colored by**: chromosome (to check for chr-specific clustering).

### Analysis 8: Mutual Information Matrix
**Purpose**: Capture non-linear, non-monotonic dependencies that Pearson/Spearman miss.
**Expected**: MI between G4 density and fragility may be higher than Pearson suggests (threshold effect). MI between histone marks and TF binding may reveal combinatorial logic.

### Analysis 9: Distance Correlation Matrix (50K subsample)
**Purpose**: Detect ANY statistical dependence, including non-linear and non-monotonic.
**Expected**: dCor ≥ Pearson for all pairs. Any pair where dCor >> Pearson indicates a non-linear relationship worth investigating.

---

## Specific Hypotheses to Test

### H1: Material properties predict replication timing beyond GC
- **Test**: r(stacking_dg37, repli_gm12878 | GC), r(curvature, repli_gm12878 | GC), r(deformability, repli_gm12878 | GC)
- **Prediction**: At least one material property predicts replication timing after GC partialing
- **Significance**: Would mean DNA mechanics influence the replication program

### H2: G-quadruplex density independently predicts genome fragility
- **Test**: r(g4_density, fragility_score | GC), r(g4_density, total_nonb_density | GC)
- **Prediction**: Strong positive partial correlation (G4s cause fragility regardless of GC)
- **Significance**: Direct mechanical cause of breakpoints

### H3: Methylation sensitivity predicts chromatin state
- **Test**: r(meth_sensitivity, chromhmm_active | GC), r(meth_sensitivity, h3k27me3 | GC)
- **Prediction**: Regions where methylation has maximal mechanical effect have distinct chromatin
- **Significance**: Connects the snap-band model to observable chromatin marks

### H4: TE insertion preferences reflect DNA mechanics
- **Test**: r(stacking_dg37, te_line_fraction | GC), r(deformability, te_sine_fraction | GC)
- **Prediction**: LINE elements prefer mechanically flexible/unstable regions (low stacking, high deformability). Alu/SINEs may have different preferences.
- **Significance**: Validates the Science 2025 finding that L1 EN cuts based on structure

### H5: TF binding correlates with DNA shape beyond GC
- **Test**: r(mgw_mean, tf_ctcf | GC), r(roll_mean, tf_sp1 | GC)
- **Prediction**: Specific TFs prefer specific DNA shapes independent of GC
- **Significance**: Validates the Rohs lab "DNA shape readout" model genome-wide

### H6: Conservation tracks with material properties
- **Test**: r(phylop_mean, stacking_dg37 | GC), r(phastcons_mean, curvature | GC)
- **Prediction**: Thermodynamically stable AND curved regions are more conserved (beyond GC)
- **Significance**: Material properties are under purifying selection

### H7: Mutation rate reflects thermodynamic vulnerability
- **Test**: r(pan_cancer_rate, stacking_dg37 | GC), r(snv_rate, bubble_propensity | GC)
- **Prediction**: Regions with lower stacking stability have higher mutation rates
- **Significance**: DNA thermodynamics shapes the mutational landscape

### H8: The genome has independent material dimensions
- **Test**: PCA — how many components needed for 90% variance?
- **Prediction**: 5-8 components (GC, gene density, repeat content, curvature, G4, deformability, methylation sensitivity, replication timing)
- **Significance**: The genome is organized along a small number of material axes

---

## Data Available for This Run

### Full coverage (100%, ~2.94M rows):
- 43 core biophysics columns (Tier 0 + Tier 1 + Tier 2)
- gene_density, gene_bp_fraction
- All 6 TE fractions
- Conservation (4 columns)
- Fragility (4 columns)
- Non-B DNA (6 columns)

### Near-complete (96-97%):
- repli_gm12878 (chrY has no data — biologically correct)
- chromhmm_active_frac_e029

### Partial but usable:
- ccre_density (84%, actively filling)

### Available from separate tables (need JOIN in export):
- tf_binding_signal (15 columns, 3.1M rows)
- accessibility_signal (4 columns, 3.1M rows)
- mutation_density (7 columns, 2.8M rows = 94%)
- hic_compartment (1 column, 3.8K rows = 25kb resolution)

### Low coverage (exclude from this run):
- Histone signal columns (1-4%) — too sparse for meaningful correlation
- repli_k562, median_tpm (0%) — not ingested

### Total columns for correlation: ~75-80
(43 biophysics + 4 conservation + 4 fragility + 6 non-B DNA + 6 TE fractions + gene_density + gene_bp + ccre + chromhmm + repli_gm + 15 TF binding + 4 accessibility + ~7 mutation + 1 Hi-C PC1)

---

## Expected Output

1. **Raw Pearson heatmap** (80×80) — shows the full correlation structure
2. **GC-partialed heatmap** (80×80) — THE key figure, shows independent relationships
3. **Spearman heatmap** — robustness check
4. **PCA loadings** (top 5 components) — what drives genomic variation
5. **UMAP scatter** (100K windows, colored by chromosome) — genome structure visualization
6. **Per-isochore matrices** (5 × 80×80) — within-GC-class relationships
7. **Per-chromosome summary** (22 autosomes) — consistency check
8. **MI and dCor matrices** — non-linear dependencies
9. **Hypothesis test results** (H1-H8 with effect sizes and p-values)

---

## What This Proves

If the GC-partialed matrix shows significant material→biology correlations:
- **For the NAR paper**: DNA biophysical properties predict genome biology beyond base composition
- **For AI companies**: The biophysics layer provides non-redundant information not available from GC content alone
- **For the Polymer Evolution thesis**: The material channel carries biological information independently of the symbolic channel
- **For the EWAS community**: Biophysical annotation reveals structure in methylation data that pathway analysis misses

If the GC-partialed matrix is mostly zero:
- GC content is the only material property that matters (the null hypothesis)
- The biophysics layer is redundant with GC content
- We would need to revise the platform's value proposition

**This is an honest scientific test. The GPU run will tell us which story is true.**
