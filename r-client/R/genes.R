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
  # Gene endpoint returns data as a direct GRanges object (not layer-wrapped)
  gr_json <- resp$data
  if (is.null(gr_json) || is.null(gr_json$n) || gr_json$n == 0) {
    return(GenomicRanges::GRanges())
  }
  .json_to_granges(gr_json)
}
