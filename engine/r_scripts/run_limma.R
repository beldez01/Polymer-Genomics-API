#!/usr/bin/env Rscript
# run_limma.R — Differential methylation analysis with limma
# Input JSON: {session_dir, group_column, contrast, covariates}
# Output JSON: {n_dmps, top_hits, full_table_path}

source("utils.R")

suppressPackageStartupMessages({
  library(minfi)
  library(limma)
})

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a

main <- function() {
  params <- parse_args()
  session_dir  <- params$session_dir
  group_column <- params$group_column
  contrast_str <- params$contrast  # e.g., "TET2_mut-WT"
  covariates   <- params$covariates  # optional character vector
  fdr          <- params$fdr %||% 0.05

  require_checkpoint(session_dir, "filtered.rds")
  grSet <- load_checkpoint(session_dir, "filtered.rds")

  pd <- as.data.frame(pData(grSet))

  # Validate group column
  if (!group_column %in% colnames(pd)) {
    stop_json(paste("Column not found:", group_column,
                     ". Available:", paste(colnames(pd), collapse = ", ")))
  }

  group <- factor(pd[[group_column]])
  levels_clean <- make.names(levels(group))
  levels(group) <- levels_clean

  # Use M-values for limma (not Beta)
  M <- getM(grSet)
  # Cap extreme M-values
  M[M > 10] <- 10
  M[M < -10] <- -10
  # Remove rows with NA/Inf
  finite_rows <- apply(M, 1, function(x) all(is.finite(x)))
  M <- M[finite_rows, ]

  # Build design matrix
  if (!is.null(covariates) && length(covariates) > 0) {
    # Validate covariate names against sample sheet columns
    missing_covs <- setdiff(covariates, colnames(pd))
    if (length(missing_covs) > 0) {
      stop_json(paste("Covariates not found in sample sheet:",
                       paste(missing_covs, collapse = ", "),
                       ". Available:", paste(colnames(pd), collapse = ", ")))
    }
    cov_formula <- paste(
      "~ 0 + group",
      paste0("pd$`", covariates, "`", collapse = " + "),
      sep = " + "
    )
    design <- model.matrix(as.formula(cov_formula))
  } else {
    design <- model.matrix(~ 0 + group)
  }
  colnames(design) <- gsub("^group", "", colnames(design))

  # Auto-generate contrast if not provided
  if (is.null(contrast_str)) {
    lvls <- levels_clean
    if (length(lvls) != 2) {
      stop_json(paste("Provide explicit contrast for >2 groups. Levels:",
                       paste(lvls, collapse = ", ")))
    }
    contrast_str <- paste0(lvls[1], "-", lvls[2])
  }

  # Fit model
  fit <- lmFit(M, design)
  contrast_matrix <- makeContrasts(contrasts = contrast_str, levels = design)
  fit2 <- contrasts.fit(fit, contrast_matrix)
  fit2 <- eBayes(fit2)

  # Extract results
  results <- topTable(fit2, number = Inf, sort.by = "P")

  # Add delta-beta
  betas <- getBeta(grSet)[rownames(results), , drop = FALSE]
  grp_levels <- levels_clean
  # Parse contrast to get groups
  contrast_parts <- strsplit(contrast_str, "-")[[1]]
  if (length(contrast_parts) == 2) {
    g1_samples <- which(group == contrast_parts[1])
    g2_samples <- which(group == contrast_parts[2])
    if (length(g1_samples) > 0 && length(g2_samples) > 0) {
      delta_beta <- rowMeans(betas[, g1_samples, drop = FALSE], na.rm = TRUE) -
                    rowMeans(betas[, g2_samples, drop = FALSE], na.rm = TRUE)
      results$deltaBeta <- delta_beta[rownames(results)]
    }
  }

  # Count significant
  n_dmps <- sum(results$adj.P.Val < fdr, na.rm = TRUE)

  # Top hits for JSON response (top 20)
  top <- head(results, 20)
  top_hits <- lapply(seq_len(nrow(top)), function(i) {
    row <- top[i, ]
    list(
      probe = rownames(top)[i],
      logFC = round(row$logFC, 4),
      adj_P_Val = signif(row$adj.P.Val, 4),
      deltaBeta = if ("deltaBeta" %in% names(row)) round(row$deltaBeta, 4) else NULL
    )
  })

  # Save full results
  results$probe <- rownames(results)
  csv_path <- file.path(session_dir, "dmps.csv")
  write.csv(results, csv_path, row.names = FALSE)
  save_checkpoint(fit2, session_dir, "dmps.rds")
  save_checkpoint(results, session_dir, "dmp_results.rds")

  emit_json(list(
    n_dmps = n_dmps,
    fdr_threshold = fdr,
    contrast = contrast_str,
    n_tested = nrow(results),
    top_hits = top_hits,
    full_table_path = csv_path
  ))
}

main()
