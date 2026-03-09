#!/usr/bin/env Rscript
# get_values.R — Extract beta or M values from session
# Input JSON: {session_dir, value_type, probes}
# Output JSON: {values} or {file_path}

source("utils.R")

suppressPackageStartupMessages({
  library(minfi)
})

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a

main <- function() {
  params <- parse_args()
  session_dir <- params$session_dir
  value_type  <- tolower(params$value_type %||% "beta")
  probes      <- params$probes  # NULL = all

  # Find best checkpoint
  for (ckpt in c("filtered.rds", "normalized.rds")) {
    if (file.exists(file.path(session_dir, ckpt))) {
      grSet <- load_checkpoint(session_dir, ckpt)
      break
    }
  }
  if (!exists("grSet")) stop_json("No normalized data found. Run normalize first.")

  # Extract values
  if (value_type == "m") {
    mat <- getM(grSet)
  } else {
    mat <- getBeta(grSet)
  }

  # Subset probes if requested
  if (!is.null(probes) && length(probes) > 0) {
    found <- intersect(probes, rownames(mat))
    missing <- setdiff(probes, rownames(mat))
    mat <- mat[found, , drop = FALSE]

    if (nrow(mat) <= 100) {
      # Small enough to return inline
      values <- lapply(seq_len(nrow(mat)), function(i) {
        row_vals <- as.list(round(mat[i, ], 6))
        names(row_vals) <- colnames(mat)
        row_vals
      })
      names(values) <- rownames(mat)

      emit_json(list(
        n_probes = nrow(mat),
        n_samples = ncol(mat),
        n_missing = length(missing),
        missing_probes = if (length(missing) > 0) missing else NULL,
        values = values
      ))
      return(invisible(NULL))
    }
  }

  # Large result: write to CSV
  csv_path <- file.path(session_dir, paste0(value_type, "_values.csv"))
  write.csv(mat, csv_path)

  emit_json(list(
    n_probes = nrow(mat),
    n_samples = ncol(mat),
    file_path = csv_path
  ))
}

main()
