# Pipeline Integration Analysis: Where Polymer Genomics Maps Fit in Established Workflows

**Date**: 2026-03-20
**Source**: Systematic review of Bioconductor packages, Galaxy tools, and published literature

---

## The Gap

Bioconductor's annotation ecosystem (GenomicFeatures, TxDb, OrgDb, AnnotationHub) provides gene models, GO, KEGG — but **zero biophysical properties**. GBshape (Chiu 2015) provides 5 geometric shape tracks but no thermodynamics, no mechanics, no methylation perturbation. DNAshapeR computes on-the-fly but isn't pre-computed genome-wide. **We are the only source of genome-wide biophysical annotations in a queryable format.**

---

## Top 5 Integration Points (by market size × gap severity)

### 1. EWAS Annotation (HIGHEST PRIORITY)

**The workflow**: Researcher runs minfi → dmpFinder() → gets 500 DMPs → runs missMethyl::gometh() for GO/KEGG enrichment → publishes.

**The gap**: After gometh, there is NO way to ask "are my DMPs enriched in thermodynamically unstable regions?" or "do my hits cluster at high-curvature loci?" These are biologically meaningful questions (TET2 LOF, nucleosome positioning, chromatin state transitions) that require computing biophysics from scratch.

**Our integration**: `batch_probes` API call returning biophysical context per probe. Future: R package with `biophysicsEnrich(dmp_list)` analogous to gometh().

**Market**: Thousands of EWAS papers/year. Every methylation array study.

### 2. Structural Variant Fragility Prediction

**The evidence**: NAR 2024 paper built ML models for genome fragility using "intrinsic k-meric susceptibility scores, DNA shape parameters, changes in heat of DNA duplex formations" — all features we pre-compute.

**Our integration**: Pre-computed fragility maps as drop-in ML features. Currently researchers compute these ad hoc over hours/days.

### 3. Mutation Signature Analysis (DNA Shape)

**The evidence**: Karolak/Supek 2022 (PLOS ONE) built "a framework for mutational signature analysis based on DNA shape parameters" — NMF on shape-stratified spectra extracts novel mechanistic signatures.

**Our integration**: `lookup_sbs_spectrum` already provides δΔG per trinucleotide mutation. Pre-computed shape tracks enable routine shape-based signature analysis.

### 4. Transposable Element Target Site Analysis

**The evidence**: Science 2025 cryo-EM of LINE-1 ORF2p shows "EN cleavage is based primarily on DNA structure rather than sequence." The AT-rich consensus reflects low stacking energy / easy deformation. Our stacking energy maps literally quantify what the enzyme senses.

**Our integration**: Stacking energy + curvature + deformability maps for L1 insertion site preference analysis.

### 5. Primer/Probe Design Validation

**The gap**: Primer3 computes Tm in isolation but doesn't tell you about the genomic neighborhood. A primer with perfect Tm landing in a G4 region or high-curvature zone will have unexpected problems.

**Our integration**: `evaluate_design` endpoint already does this. `compare_sequences` for design variants.

---

## Key Published Validations of Our Approach

| Paper | Year | Key Finding | Our Feature |
|-------|------|-------------|-------------|
| Karolak/Supek PLOS ONE | 2022 | DNA shape parameters extract novel mutation signatures | MGW, Roll, HelT, ProT tracks |
| NAR "Genomic sequence code of DNA fragility" | 2024 | K-meric susceptibility + shape predict breakpoints | Fragility composite layer |
| Science LINE-1 cryo-EM | 2025 | EN cuts based on structure not sequence | Stacking energy maps |
| ORILINX bioRxiv | 2026 | Language model learns GC + G4 predict replication origins | GC, G4 density tracks |
| NatComm Replication/Fragility | 2025 | Replication timing correlates with fragility | Both layers available |

---

## Benchmark Questions to Add (Real-World Scenarios)

Based on this research, the benchmarking study should include questions that test whether the API can support real pipeline use cases:

1. "A researcher has 500 DMPs from an aging EWAS. How would they test whether these probes are enriched in thermodynamically unstable regions?"
2. "An SV caller found a recurrent breakpoint at chr17:7680000. What biophysical features of this region might explain its fragility?"
3. "A CRISPR guide targets a region with stacking ΔG₃₇ = -2.1 kcal/mol. Is this thermodynamically favorable or unfavorable for guide binding?"
4. "Cancer genomics data shows C>T mutations enriched in GCG trinucleotides. What is the thermodynamic impact (δΔG) of this specific mutation type?"
5. "An ancient DNA sample from a cave bear shows preferential preservation of GC-rich regions. What biophysical property explains this?"
