suppressPackageStartupMessages({
  library(GenomicRanges)
  library(data.table)
  library(rtracklayer)
})

#' Summarize a scored signal GRanges over cCRE elements.
#' @param signal GRanges with a numeric 'score' mcol (e.g. from rtracklayer::import of a bigWig)
#' @param ccres named GRanges of elements
#' @param agg "mean" or "max"
#' @return named numeric vector (one value per ccre, NA if no overlap)
summarize_over_ccres <- function(signal, ccres, agg = c("mean", "max")) {
  stopifnot("score" %in% colnames(S4Vectors::mcols(signal)))
  agg <- match.arg(agg)
  hits <- GenomicRanges::findOverlaps(ccres, signal)
  scores <- S4Vectors::mcols(signal)$score[S4Vectors::subjectHits(hits)]
  idx <- S4Vectors::queryHits(hits)
  fun <- if (agg == "mean") function(x) mean(x, na.rm = TRUE) else function(x) max(x, na.rm = TRUE)
  agg_by_elem <- tapply(scores, idx, fun)
  out <- rep(NA_real_, length(ccres))
  out[as.integer(names(agg_by_elem))] <- as.numeric(agg_by_elem)
  out[!is.finite(out)] <- NA_real_
  names(out) <- names(ccres)
  out
}

#' Import a bigWig/bed signal track restricted to cCRE ranges (memory-frugal).
#'
#' Acquisition scripts MUST use this helper rather than importing full tracks.
#' Importing genome-wide bigWigs in full would exceed available RAM against
#' 2.35M cCRE elements. This restricts the import to the supplied cCRE ranges
#' via rtracklayer's `which` argument.
#'
#' @param path Path to a bigWig (or other rtracklayer-supported) signal file.
#' @param ccres Named GRanges of cCRE elements (from load_ccres()).
#' @return GRanges with a 'score' mcol, suitable for summarize_over_ccres().
import_signal_over <- function(path, ccres) {
  rtracklayer::import(path, which = ccres)
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
