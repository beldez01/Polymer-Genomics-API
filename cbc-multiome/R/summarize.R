suppressPackageStartupMessages({
  library(GenomicRanges)
  library(data.table)
})

#' Summarize a scored signal GRanges over cCRE elements.
#' @param signal GRanges with a numeric 'score' mcol (e.g. from rtracklayer::import of a bigWig)
#' @param ccres named GRanges of elements
#' @param agg "mean" or "max"
#' @return named numeric vector (one value per ccre, NA if no overlap)
summarize_over_ccres <- function(signal, ccres, agg = c("mean", "max")) {
  agg <- match.arg(agg)
  hits <- GenomicRanges::findOverlaps(ccres, signal)
  scores <- S4Vectors::mcols(signal)$score[S4Vectors::subjectHits(hits)]
  idx <- S4Vectors::queryHits(hits)
  fun <- if (agg == "mean") function(x) mean(x, na.rm = TRUE) else function(x) max(x, na.rm = TRUE)
  agg_by_elem <- tapply(scores, idx, fun)
  out <- rep(NA_real_, length(ccres))
  out[as.integer(names(agg_by_elem))] <- as.numeric(agg_by_elem)
  names(out) <- names(ccres)
  out
}

#' Load an RNA quantification file into a named TPM vector keyed by gene id.
#' @param path tab-delimited with columns given by gene_col and tpm_col
load_rna_tpm <- function(path, gene_col = "gene_id", tpm_col = "TPM") {
  dt <- data.table::fread(path)
  stopifnot(all(c(gene_col, tpm_col) %in% names(dt)))
  v <- dt[[tpm_col]]
  names(v) <- dt[[gene_col]]
  v
}
