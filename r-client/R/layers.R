#' List available data layers
#'
#' @param build Genome build. Uses default from pg_connect() if NULL.
#' @param type Optional layer type filter.
#' @return A data.frame with layer metadata.
#' @export
pg_layers <- function(build = NULL, type = NULL) {
  build <- .get_build(build)
  params <- list(build = build)
  if (!is.null(type)) params$type <- type
  resp <- .pg_request("/v1/layers", params)

  if (is.null(resp$layers) || length(resp$layers) == 0) {
    return(data.frame(
      layer_key = character(0), version = character(0),
      name = character(0), type = character(0),
      row_count = integer(0), stringsAsFactors = FALSE
    ))
  }

  do.call(rbind, lapply(resp$layers, function(l) {
    data.frame(
      layer_key     = l$layer_key %||% NA_character_,
      version       = l$version %||% NA_character_,
      name          = l$name %||% NA_character_,
      type          = l$type %||% NA_character_,
      build         = l$build %||% NA_character_,
      license_class = l$license_class %||% NA_character_,
      row_count     = l$row_count %||% NA_integer_,
      is_default    = l$is_default %||% NA,
      stringsAsFactors = FALSE
    )
  }))
}


#' Search for genes
#'
#' @param query Search term (minimum 2 characters).
#' @param build Genome build. Uses default from pg_connect() if NULL.
#' @return A character vector of matching gene symbols.
#' @export
pg_search <- function(query, build = NULL) {
  build <- .get_build(build)
  resp <- .pg_request("/v1/search", list(q = query, build = build))
  if (is.null(resp$results) || length(resp$results) == 0) return(character(0))
  vapply(resp$results, function(r) r$gene_symbol, character(1))
}
