#' Look up a gene by symbol
#'
#' Returns gene features (exons, introns, UTRs, etc.) as a GRanges object.
#'
#' @param symbol Gene symbol (e.g. "VAC14", "BRCA1").
#' @param build Genome build. Uses default from pg_connect() if NULL.
#' @return A GRanges object with gene features.
#' @export
pg_gene <- function(symbol, build = NULL) {
  build <- .get_build(build)
  resp <- .pg_request(sprintf("/v1/genes/%s/%s", build, symbol))
  gr_list <- .region_response_to_granges_list(resp)
  if (length(gr_list) == 0) return(GenomicRanges::GRanges())
  # Return the first (and usually only) layer
  gr_list[[1]]
}
