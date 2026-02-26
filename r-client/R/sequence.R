#' Get DNA sequence for a region
#'
#' Returns the raw nucleotide sequence for the specified region.
#'
#' @param region Region string, e.g. "chr16:70699930-70700000".
#' @param build Genome build. Uses default from pg_connect() if NULL.
#' @return A character string containing the DNA sequence.
#' @export
pg_sequence <- function(region, build = NULL) {
  build <- .get_build(build)
  resp <- .pg_request(sprintf("/v1/sequence/%s/%s", build, region))
  resp$sequence
}
