# BixBench Methods Inventory

Comprehensive catalog of all methods, packages, and statistical techniques required to solve BixBench questions. Generated from analysis of ~45 reference notebooks.

---

## 1. DIFFERENTIAL EXPRESSION ANALYSIS

### 1.1 DESeq2 (Primary RNA-seq Method)

**R Package**: `DESeq2` (Bioconductor)
**Python Port**: `pydeseq2`

**Core Functions**:
| Function | Purpose | Parameters |
|----------|---------|------------|
| `DESeqDataSetFromMatrix()` | Create DESeq2 object | countData, colData, design |
| `DESeq()` | Full pipeline | fitType, test, betaPrior |
| `estimateSizeFactors()` | Library normalization | - |
| `estimateDispersions()` | Gene-wise dispersion | fitType='parametric'/'local' |
| `results()` | Extract contrasts | contrast, alpha, lfcThreshold |
| `lfcShrink()` | Effect size shrinkage | coef, type='apeglm'/'ashr' |
| `rlog()` | Variance stabilization | blind=TRUE/FALSE |
| `vst()` | Variance stabilizing transform | blind=TRUE/FALSE |

**Design Formulas Observed**:
- `~ condition` (simple two-group)
- `~ sex + condition` (covariate adjustment)
- `~ Replicate + Strain + Media` (multi-factor)
- `~ batch + condition` (batch correction)

**Threshold Parameters**:
- FDR/padj: 0.05 (standard), 0.01 (stringent)
- log2FC: 0.5, 0.58 (1.5-fold), 1.0 (2-fold), 1.5, 2.0
- baseMean: ≥10 (minimum expression)

### 1.2 edgeR (Alternative)

**R Package**: `edgeR` (Bioconductor)

**Core Functions**:
- `DGEList()` - Create edgeR object
- `calcNormFactors()` - TMM normalization
- `estimateDisp()` - Dispersion estimation
- `glmQLFit()` - Quasi-likelihood fitting
- `glmQLFTest()` - QL F-test
- `topTags()` - Extract results

### 1.3 limma-voom

**R Package**: `limma` (Bioconductor)

**Core Functions**:
- `voom()` - Transform counts
- `lmFit()` - Linear model fit
- `eBayes()` - Empirical Bayes moderation
- `topTable()` - Extract results
- `makeContrasts()` - Define contrasts

---

## 2. FUNCTIONAL ENRICHMENT ANALYSIS

### 2.1 Gene Ontology (GO) Enrichment

**R Packages**: `clusterProfiler`, `org.Hs.eg.db`, `enrichplot`
**Python Packages**: `gseapy`, `gprofiler-official`

**Core Functions**:
| Function | Purpose | Key Parameters |
|----------|---------|----------------|
| `enrichGO()` | GO enrichment | OrgDb, ont='BP'/'MF'/'CC', pvalueCutoff |
| `simplify()` | Remove redundancy | cutoff=0.7 (similarity) |
| `pairwise_termsim()` | Term similarity | method='JC'/'Wang' |
| `emapplot()` | Enrichment map | - |
| `dotplot()` | Dot visualization | showCategory |
| `gp.profile()` | Gprofiler query | organism, sources |

**Databases Used**:
- GO (Gene Ontology): BP, MF, CC
- KEGG Pathways
- Reactome
- WikiPathways
- CORUM (protein complexes)

### 2.2 KEGG Pathway Enrichment

**R Package**: `clusterProfiler`

**Core Functions**:
- `enrichKEGG()` - KEGG enrichment
  - organism codes: "hsa" (human), "mmu" (mouse), "pau" (P. aeruginosa)
  - pvalueCutoff: 0.05
  - qvalueCutoff: 0.05

### 2.3 Gene Set Enrichment Analysis (GSEA)

**Python Package**: `gseapy`

**Core Functions**:
- `gp.gsea()` - Rank-based GSEA
- `gp.prerank()` - Pre-ranked GSEA
- `gp.enrichr()` - Enrichr API
- `gp.profile()` - g:Profiler

---

## 3. STATISTICAL TESTS

### 3.1 Parametric Tests

| Test | Function | Package | Use Case |
|------|----------|---------|----------|
| t-test (independent) | `t.test()` / `ttest_ind()` | base R / scipy | Two-group comparison |
| t-test (paired) | `t.test(paired=TRUE)` | base R | Paired samples |
| ANOVA (one-way) | `anova_test()` / `f_oneway()` | rstatix / scipy | Multi-group comparison |
| ANOVA (two-way) | `ols() + anova_lm()` | statsmodels | Factorial design |
| Linear regression | `lm()` / `ols()` | base R / statsmodels | Continuous predictor |
| Logistic regression | `glm(family=binomial)` | base R | Binary outcome |
| Ordinal regression | `OrderedModel()` | statsmodels | Ordinal outcome |

### 3.2 Non-Parametric Tests

| Test | Function | Package | Use Case |
|------|----------|---------|----------|
| Mann-Whitney U | `mannwhitneyu()` | scipy.stats | Two-group (non-normal) |
| Wilcoxon signed-rank | `wilcox.test()` | base R | Paired (non-normal) |
| Kruskal-Wallis | `kruskal.test()` | base R | Multi-group (non-normal) |
| Chi-square | `chisq.test()` / `chi2_contingency()` | base R / scipy | Categorical independence |
| Fisher's exact | `fisher.test()` | base R | Small contingency tables |

### 3.3 Multiple Testing Correction

| Method | Function | When to Use |
|--------|----------|-------------|
| Benjamini-Hochberg (BH) | `p.adjust(method='BH')` | Standard FDR control |
| Benjamini-Yekutieli (BY) | `p.adjust(method='BY')` | Dependent tests |
| Bonferroni | `p.adjust(method='bonferroni')` | Conservative FWER |
| q-value | Implicit in enrichment | Enrichment analysis |

### 3.4 Normality Testing

| Test | Function | Package |
|------|----------|---------|
| Shapiro-Wilk | `shapiro.test()` / `stats.shapiro()` | base R / scipy |
| Anderson-Darling | `anderson()` | scipy.stats |
| D'Agostino-Pearson | `normaltest()` | scipy.stats |

### 3.5 Correlation Analysis

| Method | Function | Use Case |
|--------|----------|----------|
| Pearson | `cor()` / `pearsonr()` | Linear relationship (normal) |
| Spearman | `cor(method='spearman')` / `spearmanr()` | Monotonic (non-normal) |
| Kendall | `cor(method='kendall')` | Ordinal data |

---

## 4. MULTI-CONTRAST / SET ALGEBRA

### 4.1 Set Operations for DE Genes

**Implementation**: `backend/app/services/analysis/set_algebra.py`

| Operation | Algebra | Question Pattern |
|-----------|---------|------------------|
| `unique_to(A, exclude=[B,C])` | A - (B ∪ C) | "DE only in A, not B or C" |
| `shared_by([A,B])` | A ∩ B | "DE in both A and B" |
| `shared_exclusive([A,B], exclude=[C])` | (A ∩ B) - C | "DE in A and B but not C" |
| `union_not_in([A,B], exclude=[C])` | (A ∪ B) - C | "DE in A or B but not C" |

### 4.2 Percentage Base Calculation

| Base Type | Formula | Question Pattern |
|-----------|---------|------------------|
| FIRST_SET | \|result\| / \|first_include\| | "What % of genes in A..." |
| GENE_UNIVERSE | \|result\| / \|universe\| | "What % of all genes..." |

### 4.3 Asymmetric Thresholds

- **Inclusion sets**: FC + FDR threshold
- **Exclusion sets**: FDR only (FC = 0)

---

## 5. VISUALIZATION METHODS

### 5.1 R/ggplot2

| Plot Type | Geom | Use Case |
|-----------|------|----------|
| Scatter | `geom_point()` | Continuous vs continuous |
| Bar | `geom_bar()` | Categorical counts |
| Box | `geom_boxplot()` | Distribution comparison |
| Violin | `geom_violin()` | Distribution shape |
| Heatmap | `pheatmap()` | Expression matrices |
| Venn | `ggvenn()` | Set overlaps |
| Volcano | `geom_point()` + thresholds | DE visualization |
| MA plot | `plotMA()` | Mean vs fold change |
| PCA | `plotPCA()` | Dimensionality reduction |
| Enrichment map | `emapplot()` | GO term networks |
| Dot plot | `dotplot()` | Enrichment results |

### 5.2 Python/matplotlib/seaborn

| Plot Type | Function | Use Case |
|-----------|----------|----------|
| Scatter | `sns.scatterplot()` | Continuous relationships |
| Histogram | `sns.histplot()` | Distributions |
| Box | `sns.boxplot()` | Group comparisons |
| Violin | `sns.violinplot()` | Distribution shape |
| Heatmap | `sns.heatmap()` / `sns.clustermap()` | Matrices |
| Venn | `matplotlib_venn` | Set overlaps |
| UpSet | `upsetplot` | Complex set intersections |

---

## 6. GENOMIC VARIANT ANALYSIS

### 6.1 Variant Filtering

**Quality Thresholds**:
- Read depth (DP): > 10
- Genotype quality (GQ): > 20
- Quality flag: "PASS"

**Variant Classification**:
- VAF < 0.3: Putative somatic
- 0.3 ≤ VAF ≤ 0.7: Heterozygous germline
- VAF > 0.7: Homozygous

**Region Filtering**:
- Remove: intronic, intergenic, 3' UTR, 5' UTR
- Keep: exonic, splice site

### 6.2 CHIP Gene Analysis

**Gene List**: Schenz et al. 2022 (PMID 36311800) - 56 CHIP genes

**Variant Effect Classification**:
- Missense
- Synonymous
- Loss of function (frameshift, nonsense, splice)
- Other

---

## 7. METHYLATION ANALYSIS

### 7.1 Array-Based (450K/EPIC)

**R Packages**: `minfi`, `ChAMP`, `sesame`

**Core Functions**:
- Beta value extraction
- Background correction (noob, dye-bias)
- Normalization (BMIQ, quantile, functional)
- Probe filtering (detection p-value, cross-reactive)
- Differential methylation (limma-based)

**Thresholds**:
- Detection p-value: < 0.01
- Delta beta: > 0.1 or > 0.2
- Methylation percentage: > 90% or < 10% (quality filter)

### 7.2 Bisulfite Sequencing

**Analysis Tools**: `methylKit`, `bsseq`

---

## 8. SEQUENCE/PHYLOGENETIC ANALYSIS

### 8.1 Ortholog Detection

**Tool**: BUSCO v5.8.0
- Mode: protein (`-m prot`)
- Lineage: eukaryota_odb10

### 8.2 Multiple Sequence Alignment

**Tool**: MAFFT
- Parameter: `--auto` (algorithm selection)

### 8.3 Phylogenetic Metrics

**Tool**: PhyKIT v2.0.1
- `pk_vs`: Variable sites
- `pk_erps`: Evolutionary rate per site
- `pk_cbps`: Compositional bias per site
- `pk_pairwise_id`: Pairwise identity

---

## 9. MACHINE LEARNING / SURVIVAL

### 9.1 Survival Analysis

**XGBoost AFT**:
- Model: Accelerated Failure Time
- Metric: aft-nloglik
- Distributions: normal, logistic, extreme

**Hyperparameter Tuning**:
- Optuna optimization
- Early stopping

### 9.2 Classification

**Feature Selection**:
- Embedded importance (XGBoost)
- Top-k selection

**Normalization**:
- Z-score standardization
- Min-max scaling

---

## 10. SINGLE-CELL ANALYSIS

### 10.1 Core Packages

**Python**: `scanpy`, `anndata`
**R**: `Seurat`, `SingleCellExperiment`

### 10.2 Preprocessing

- QC filtering (nGene, nUMI, mito%)
- Normalization (log1p, scran)
- Highly variable genes
- Scaling

### 10.3 Dimensionality Reduction

- PCA (`sc.tl.pca()`)
- UMAP (`sc.tl.umap()`)
- t-SNE (`sc.tl.tsne()`)

### 10.4 Clustering

- Leiden (`sc.tl.leiden()`)
- Louvain (`sc.tl.louvain()`)

### 10.5 Marker Detection

- Wilcoxon rank-sum
- t-test
- logistic regression

---

## 11. DATA I/O AND PREPROCESSING

### 11.1 File Formats

| Format | R Package | Python Package |
|--------|-----------|----------------|
| CSV/TSV | `readr`, `data.table` | `pandas` |
| Excel | `readxl`, `openxlsx` | `openpyxl`, `xlrd` |
| RDS | `readRDS()` | `pyreadr` |
| H5AD | - | `anndata` |
| FASTA | `Biostrings` | `biopython` |
| VCF | `VariantAnnotation` | `cyvcf2` |

### 11.2 Data Transformations

| Transform | Purpose | Function |
|-----------|---------|----------|
| Log2 | Variance stabilization | `log2(x + 1)` |
| Z-score | Standardization | `scale()` / `zscore()` |
| CPM | Library size normalization | counts / total * 1e6 |
| TPM | Length + library normalization | - |
| rlog | DESeq2 regularized log | `rlog()` |
| vst | Variance stabilizing | `vst()` |

---

## 12. PACKAGE DEPENDENCIES

### R/Bioconductor Core
```
BiocManager, DESeq2, edgeR, limma, apeglm, clusterProfiler,
org.Hs.eg.db, enrichplot, pheatmap, ggplot2, tidyverse,
dplyr, tidyr, readr, purrr, stringr, ggvenn, ggrepel,
rstatix, ggpubr, multcomp, RColorBrewer, viridis
```

### Python Core
```
pandas, numpy, scipy, matplotlib, seaborn, scikit-learn,
statsmodels, pydeseq2, scanpy, anndata, gseapy, gprofiler-official,
xgboost, optuna, biopython, requests
```

### External Tools
```
BUSCO, MAFFT, PhyKIT, GATK, VarSeq, featureCounts
```

---

## 13. QUESTION-TYPE TO METHOD MAPPING

| Question Type | Primary Method | Secondary Methods |
|---------------|----------------|-------------------|
| DE gene count | DESeq2 | edgeR, limma |
| DE percentage | DESeq2 + Set algebra | - |
| Multi-contrast | DESeq2 multi-contrast + Set algebra | Venn diagrams |
| Enrichment pathway | clusterProfiler/gseapy | GO/KEGG/Reactome |
| Correlation | Pearson/Spearman | Linear regression |
| Group comparison | t-test/ANOVA | Mann-Whitney/Kruskal-Wallis |
| Variant count | Filtering + counting | VAF stratification |
| Survival | XGBoost AFT / Cox | Kaplan-Meier |
| Methylation | minfi/limma | Delta beta |
| Distribution test | Chi-square | Fisher's exact |
| Cell type annotation | Marker genes | Clustering + visualization |
| Evolutionary rate | PhyKIT | MAFFT alignment |

---

## 14. IMPLEMENTATION PRIORITY

### Tier 1 - Must Have (BixBench Core)
1. DESeq2 full pipeline with contrasts
2. Multi-contrast with asymmetric thresholds
3. Set algebra operations
4. GO/KEGG enrichment
5. Basic statistical tests (t-test, ANOVA, chi-square)
6. Correlation analysis

### Tier 2 - High Value
1. Variant filtering and VAF analysis
2. Methylation analysis (minfi)
3. Survival modeling (XGBoost AFT)
4. Power analysis

### Tier 3 - Extended Capability
1. Single-cell analysis (Scanpy/Seurat)
2. Sequence alignment (MAFFT)
3. Phylogenetic metrics (PhyKIT)
4. BUSCO ortholog detection

---

*Generated: 2026-01-25*
*Notebooks analyzed: ~45*
*Capsules covered: 40+*
