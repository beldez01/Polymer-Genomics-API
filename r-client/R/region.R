#' Query genomic features in a region
#'
#' Returns all annotation features overlapping the specified region.
#'
#' @param region Region string, e.g. "chr16:70699930-70700000" (1-based closed).
#' @param build Genome build ("hg38" or "hg37"). Uses default from pg_connect() if NULL.
#' @param layers Character vector of layer keys, or NULL for all active layers.
#' @param as Character: "list" returns a named list of GRanges per layer;
#'   "combined" returns a single GRanges with a layer_key column.
#' @return Named list of GRanges objects (one per layer), or a single combined GRanges.
#' @export
pg_region <- function(region, build = NULL, layers = NULL, as = c("list", "combined")) {
  as <- match.arg(as)
  build <- .get_build(build)

  params <- list()
  if (!is.null(layers)) {
    params$layers <- paste(layers, collapse = ",")
  }

  resp <- .pg_request(sprintf("/v1/regions/%s/%s", build, region), params)
  gr_list <- .region_response_to_granges_list(resp)

  if (as == "combined" && length(gr_list) > 0) {
    # Combine all GRanges into one
    combined <- do.call(c, unname(gr_list))
    return(combined)
  }

  gr_list
}
