suppressPackageStartupMessages({
  library(GenomicRanges)
  library(data.table)
})

#' Load ENCODE SCREEN cCREs into a named GRanges.
#' Handles two layouts:
#'   6-col (real ENCODE SCREEN): chr start end rDHS-acc(EH38D) cCRE-acc(EH38E) class
#'  10-col (BED9+1 fixture):     chr start end cCRE-acc(EH38E) . . . . . class
#' Names are always keyed on the cCRE accession (EH38E...).
load_ccres <- function(path) {
  dt <- data.table::fread(path, header = FALSE)
  nc <- ncol(dt)
  stopifnot(nc %in% c(6L, 10L))
  name_col  <- if (nc == 6L) 5L else 4L   # cCRE accession (EH38E...)
  class_col <- if (nc == 6L) 6L else 10L
  nm <- dt[[name_col]]
  if (!all(grepl("^EH38E", nm)))
    stop("load_ccres: name column ", name_col, " does not look like cCRE accessions (EH38E...)")
  gr <- GenomicRanges::GRanges(
    seqnames = dt[[1]],
    ranges   = IRanges::IRanges(start = dt[[2]] + 1L, end = dt[[3]]),  # bed 0-based -> 1-based
    ccre_class = dt[[class_col]]
  )
  names(gr) <- nm
  gr
}
