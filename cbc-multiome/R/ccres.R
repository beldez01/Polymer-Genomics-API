suppressPackageStartupMessages({
  library(GenomicRanges)
  library(data.table)
})

#' Load ENCODE SCREEN cCREs (9+1 col bed) into a named GRanges.
#' Columns 1-3 coords, 4 = accession (names), last col = cCRE class.
load_ccres <- function(path) {
  dt <- data.table::fread(path, header = FALSE)
  gr <- GenomicRanges::GRanges(
    seqnames = dt[[1]],
    ranges   = IRanges::IRanges(start = dt[[2]] + 1L, end = dt[[3]]),  # bed 0-based -> 1-based
    ccre_class = dt[[ncol(dt)]]
  )
  names(gr) <- dt[[4]]
  gr
}
