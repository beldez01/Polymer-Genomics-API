#!/usr/bin/env Rscript
# filter_probes.R — Filter probes by QC criteria
# Input JSON: {session_dir, remove_snp, remove_sex, remove_crossreactive, detection_threshold}
# Output JSON: {n_before, n_after, removed_counts}

source("utils.R")

suppressPackageStartupMessages({
  library(minfi)
})

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a

main <- function() {
  params <- parse_args()
  session_dir          <- params$session_dir
  remove_snp           <- params$remove_snp %||% TRUE
  remove_sex           <- params$remove_sex %||% TRUE
  remove_crossreactive <- params$remove_crossreactive %||% TRUE
  detection_threshold  <- params$detection_threshold %||% 0.01

  require_checkpoint(session_dir, "normalized.rds")
  grSet <- load_checkpoint(session_dir, "normalized.rds")

  n_before <- nrow(grSet)
  removed <- list()

  # 1. Detection p-value filter
  detP_path <- file.path(session_dir, "detP.rds")
  if (file.exists(detP_path)) {
    detP <- readRDS(detP_path)
    # Align probes
    common <- intersect(rownames(grSet), rownames(detP))
    detP <- detP[common, , drop = FALSE]
    # Remove probes failing in ANY sample
    failed <- rownames(detP)[apply(detP > detection_threshold, 1, any)]
    n_det <- length(failed)
    if (n_det > 0) {
      keep <- setdiff(rownames(grSet), failed)
      grSet <- grSet[keep, ]
    }
    removed$detection_pval <- n_det
  }

  # 2. SNP filtering
  if (isTRUE(remove_snp)) {
    snp_probes <- tryCatch({
      snps <- getSnpInfo(grSet)
      if (!is.null(snps)) {
        # Remove probes at SNP positions (CpG or SBE site)
        has_snp <- !is.na(snps$CpG_maf) & snps$CpG_maf > 0 |
                   !is.na(snps$SBE_maf) & snps$SBE_maf > 0
        rownames(snps)[has_snp]
      } else character(0)
    }, error = function(e) {
      # Fallback: drop probes with "rs" in name
      grep("^rs", rownames(grSet), value = TRUE)
    })
    n_snp <- length(intersect(snp_probes, rownames(grSet)))
    if (n_snp > 0) {
      grSet <- grSet[!rownames(grSet) %in% snp_probes, ]
    }
    removed$snp_probes <- n_snp
  }

  # 3. Sex chromosome filtering
  if (isTRUE(remove_sex)) {
    ann <- getAnnotation(grSet)
    if ("chr" %in% colnames(ann)) {
      sex_probes <- rownames(ann)[ann$chr %in% c("chrX", "chrY")]
    } else {
      sex_probes <- character(0)
    }
    n_sex <- length(intersect(sex_probes, rownames(grSet)))
    if (n_sex > 0) {
      grSet <- grSet[!rownames(grSet) %in% sex_probes, ]
    }
    removed$sex_chr <- n_sex
  }

  # 4. Cross-reactive probe filtering
  if (isTRUE(remove_crossreactive)) {
    n_xreact <- 0
    tryCatch({
      if (requireNamespace("maxprobes", quietly = TRUE)) {
        xreactive <- maxprobes::xreactive_probes(array_type = "EPIC")
        n_xreact <- length(intersect(xreactive, rownames(grSet)))
        if (n_xreact > 0) {
          grSet <- grSet[!rownames(grSet) %in% xreactive, ]
        }
      }
    }, error = function(e) {
      # maxprobes not available, skip
    })
    removed$crossreactive <- n_xreact
  }

  n_after <- nrow(grSet)
  save_checkpoint(grSet, session_dir, "filtered.rds")

  emit_json(list(
    n_before = n_before,
    n_after = n_after,
    n_removed = n_before - n_after,
    removed_counts = removed
  ))
}

main()
