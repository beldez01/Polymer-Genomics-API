suppressPackageStartupMessages({
  library(MultiAssayExperiment)
  library(digest)
})

#' Build a MultiAssayExperiment from a named list of SEs whose columns are cell-type buckets.
#' colData primary unit = cell type (union across experiments). sampleMap built automatically.
build_cbc_mae <- function(experiments, cell_meta = NULL) {
  all_cells <- sort(unique(unlist(lapply(experiments, colnames))))
  cd <- S4Vectors::DataFrame(cell = all_cells, row.names = all_cells)
  if (!is.null(cell_meta)) {
    mm <- cell_meta[match(all_cells, cell_meta$cell), , drop = FALSE]
    cd$compartment <- mm$compartment; cd$lineage <- mm$lineage
  }
  MultiAssayExperiment::MultiAssayExperiment(
    experiments = MultiAssayExperiment::ExperimentList(experiments),
    colData = cd
  )
}

#' Deterministic integrity hash over primary ids and experiment names + per-assay colnames.
compute_mae_dimnames_hash <- function(mae) {
  prim <- sort(rownames(MultiAssayExperiment::colData(mae)))
  exps <- MultiAssayExperiment::experiments(mae)
  parts <- vapply(sort(names(exps)), function(n) {
    paste0(n, ":", paste(sort(colnames(exps[[n]])), collapse = ","))
  }, character(1))
  payload <- paste(c(paste(prim, collapse = "|"), parts), collapse = "||")
  paste0("sha256:", digest::digest(payload, algo = "sha256", serialize = FALSE))
}

#' Write the MAE contract JSON (mirrors Polymer MAEContract structure).
write_mae_contract <- function(mae, path, cell_meta = NULL) {
  exps <- MultiAssayExperiment::experiments(mae)
  primary <- rownames(MultiAssayExperiment::colData(mae))
  contract <- list(
    type = "MAEContract",
    experiments = lapply(names(exps), function(n) list(
      name = n, n_features = nrow(exps[[n]]), n_samples = ncol(exps[[n]]),
      samples = I(colnames(exps[[n]]))
    )),
    primary_data = lapply(primary, function(p) list(primary_id = p, tissue_type = "blood")),
    dimnames_hash = compute_mae_dimnames_hash(mae)
  )
  jsonlite::write_json(contract, path, auto_unbox = TRUE, pretty = TRUE)
  invisible(contract)
}
