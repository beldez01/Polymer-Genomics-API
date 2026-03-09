#!/usr/bin/env Rscript
# normalize.R — Normalize RGChannelSet
# Input JSON: {session_dir, method}
# Output JSON: {n_probes, method, summary_stats}

source("utils.R")

suppressPackageStartupMessages({
  library(minfi)
})

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a

main <- function() {
  params <- parse_args()
  session_dir <- params$session_dir
  method <- tolower(params$method %||% "funnorm")

  require_checkpoint(session_dir, "raw.rds")
  rgSet <- load_checkpoint(session_dir, "raw.rds")

  # Detect array for method selection
  n_probes_raw <- nrow(rgSet)
  is_epicv2 <- n_probes_raw > 1000000

  # Normalize
  grSet <- tryCatch({
    switch(method,
      "opensesame" = , "sesame" = {
        suppressPackageStartupMessages(library(sesame))
        # sesame openSesame: canonical for EPICv2
        betas <- openSesame(rgSet, prep = "QCDPB", func = getBetas)
        # Build GenomicRatioSet from betas
        grSet <- makeGenomicRatioSetFromMatrix(
          betas, what = "Beta",
          pData = pData(rgSet)
        )
        grSet
      },
      "funnorm" = preprocessFunnorm(rgSet),
      "quantile" = preprocessQuantile(rgSet),
      "noob" = {
        mSet <- preprocessNoob(rgSet)
        ratioConvert(mapToGenome(mSet))
      },
      "raw" = {
        mSet <- preprocessRaw(rgSet)
        ratioConvert(mapToGenome(mSet))
      },
      stop_json(paste("Unknown method:", method,
                       ". Use: opensesame, funnorm, quantile, noob, raw"))
    )
  }, error = function(e) {
    stop_json(paste("Normalization failed:", e$message))
  })

  # Extract betas and compute summary
  betas <- getBeta(grSet)
  betas_finite <- betas[is.finite(betas)]

  summary_stats <- list(
    mean_beta = round(mean(betas_finite, na.rm = TRUE), 4),
    median_beta = round(median(betas_finite, na.rm = TRUE), 4),
    n_na = sum(is.na(betas)),
    n_probes = nrow(betas),
    n_samples = ncol(betas)
  )

  save_checkpoint(grSet, session_dir, "normalized.rds")

  emit_json(list(
    n_probes = nrow(grSet),
    n_samples = ncol(grSet),
    method = method,
    summary_stats = summary_stats
  ))
}

main()
