# Bioconductor Integration Report

See full agent output at:
- Pipeline agent: docs/PIPELINE_INTEGRATION_REPORT.md
- Bioconductor agent: this file

## Key Finding

The entire biophysical annotation concept is ABSENT from the Bioconductor/Galaxy ecosystem.
DNAshapeR is the closest (4-13 shape features, computed per-sequence, not pre-computed genome-wide).
There is NO competitor providing genome-wide biophysical property maps as Bioconductor-compatible resources.

## Immediate Integration (works today, ~5 lines of R)

```r
library(rtracklayer)
library(GenomicRanges)

# Load Polymer Genomics BigWig
stacking <- import.bw("stacking_dG37_1kb.bw")

# Annotate DMPs from minfi
dmp_gr <- makeGRangesFromDataFrame(dmp_results)
hits <- findOverlaps(dmp_gr, stacking)
dmp_results$stacking_dG37 <- stacking$score[subjectHits(hits)]
```

## The 5-Line User Story

"Dr. X runs minfi::dmpFinder(), gets 500 DMPs, loads our BigWig via rtracklayer::import.bw(),
runs findOverlaps(), and discovers 80% of her DMPs fall in the top decile of methylation
mechanical sensitivity — meaning these are sites where methylation changes maximally alter
chromatin stiffness."

## Strategic Distribution: AnnotationHub Package

Highest-leverage move: submit BigWig files as a Bioconductor AnnotationHub resource.
Then every Bioconductor user gets our data with:

```r
ah <- AnnotationHub()
stacking <- ah[["AH_polymer_stacking_dG37"]]  # returns GRanges
```

Requirements: R package with metadata, files on Zenodo, Bioconductor review.

## Published Validations

| Paper | Year | Journal | Finding | Our Feature |
|-------|------|---------|---------|-------------|
| Karolak/Supek | 2022 | PLOS ONE | DNA shape params extract novel mutation signatures | MGW/Roll/HelT/ProT |
| NAR Fragility | 2024 | NAR | K-meric susceptibility + shape predict breakpoints | Fragility layer |
| LINE-1 cryo-EM | 2025 | Science | EN cuts based on structure not sequence | Stacking energy |
| ORILINX | 2026 | bioRxiv | Language model learns GC + G4 predict origins | GC, G4 density |
| CADD v1.7 | 2024 | NAR | Uses 60+ features but NO thermodynamic stability | Our unique gap |
