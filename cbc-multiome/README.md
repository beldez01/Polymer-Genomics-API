# cbc-multiome

Hematopoietic multi-omic MultiAssayExperiment: 12 cell types (HSC→progenitor→mature CBC-diff)
across WGBS, RNA-seq, ATAC, DNase, and 6 histone marks. See
`../docs/superpowers/specs/2026-06-03-cbc-multiome-mae-design.md`.

Build order: `scripts/00_fetch_ccres.R` → `10`–`14` (per-assay SEs) → `30_assemble_mae.R`
→ `31_manifest.R` → `40_correlation_smoke.R`.

Tests: `Rscript tests/testthat.R`.
