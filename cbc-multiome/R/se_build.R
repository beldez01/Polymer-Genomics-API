suppressPackageStartupMessages({
  library(SummarizedExperiment)
  library(GenomicRanges)
})

#' Build a RangedSummarizedExperiment for a region (cCRE-keyed) assay.
build_region_se <- function(mat, ccres, assay_name) {
  stopifnot(!is.null(rownames(mat)))
  missing <- setdiff(rownames(mat), names(ccres))
  if (length(missing))
    stop("build_region_se: ", length(missing), " rownames not in ccres, e.g. ",
         paste(head(missing, 3), collapse = ", "))
  stopifnot(!anyDuplicated(rownames(mat)))
  rr <- ccres[rownames(mat)]
  a <- list(mat); names(a) <- assay_name
  SummarizedExperiment::SummarizedExperiment(assays = a, rowRanges = rr)
}

#' Build a SummarizedExperiment for the gene-keyed RNA assay.
build_rna_se <- function(mat, assay_name = "tpm") {
  a <- list(mat); names(a) <- assay_name
  SummarizedExperiment::SummarizedExperiment(assays = a)
}

#' Emit a minimal SE contract (mirrors the Polymer SEContract fields used by MAEContract).
se_contract <- function(se, assay_type, platform = NULL) {
  list(
    assay_type = assay_type,
    platform   = platform,
    primary_assay = SummarizedExperiment::assayNames(se)[1],
    n_features = nrow(se),
    n_samples  = ncol(se),
    samples    = colnames(se)
  )
}
