#' Get a presigned download URL for bulk layer data
#'
#' @param layer_key Layer identifier (e.g. "probe_epic_v2").
#' @return A list with download_url, content_hash, size_bytes, etc.
#' @export
pg_bulk <- function(layer_key) {
  .pg_request(sprintf("/v1/bulk/%s", layer_key))
}


#' Check API health
#'
#' @return A list with status, version, db status, and chromosome count.
#' @export
pg_health <- function() {
  .pg_request("/health")
}
