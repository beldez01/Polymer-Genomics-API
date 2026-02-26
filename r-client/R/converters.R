#' @title Internal GRanges Converters
#' @description Convert API JSON response to Bioconductor objects.

# Convert a single GRanges JSON object to a GRanges object
.json_to_granges <- function(gr_json, layer_key = NULL) {
  if (is.null(gr_json) || gr_json$n == 0) {
    return(GenomicRanges::GRanges())
  }

  seqnames <- unlist(gr_json$seqnames)
  starts   <- unlist(gr_json$ranges$start)
  ends     <- unlist(gr_json$ranges$end)
  widths   <- unlist(gr_json$ranges$width)
  strands  <- unlist(gr_json$strand)

  # Build metadata columns
  mcols_list <- list()
  if (!is.null(gr_json$mcols)) {
    for (col_name in names(gr_json$mcols)) {
      vals <- gr_json$mcols[[col_name]]
      # Replace NULL values with NA
      vals <- lapply(vals, function(v) if (is.null(v)) NA else v)
      mcols_list[[col_name]] <- unlist(vals)
    }
  }

  # Add layer_key if provided
  if (!is.null(layer_key)) {
    mcols_list$layer_key <- rep(layer_key, length(starts))
  }

  gr <- GenomicRanges::GRanges(
    seqnames = seqnames,
    ranges   = IRanges::IRanges(start = starts, end = ends),
    strand   = strands,
    S4Vectors::DataFrame(mcols_list)
  )

  gr
}

# Convert full region response (multiple layers) to a named list of GRanges
.region_response_to_granges_list <- function(response) {
  data <- response$data
  if (is.null(data) || length(data) == 0) return(list())

  result <- list()
  for (layer_key in names(data)) {
    gr_json <- data[[layer_key]]
    if (!is.null(gr_json) && gr_json$n > 0) {
      result[[layer_key]] <- .json_to_granges(gr_json, layer_key)
    }
  }
  result
}
