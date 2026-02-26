#' Look up a single probe
#'
#' Returns probe coordinates and cross-platform mappings.
#'
#' @param probe_id Probe identifier (e.g. "cg08796240").
#' @param build Genome build. Uses default from pg_connect() if NULL.
#' @return A list with \code{probe} (GRanges) and \code{crossmap} (data.frame).
#' @export
pg_probes <- function(probe_id, build = NULL) {
  build <- .get_build(build)
  resp <- .pg_request(sprintf("/v1/probes/%s/%s", build, probe_id))

  # Convert probe data
  probe_data <- resp$data$probe
  if (!is.null(probe_data)) {
    probe_gr <- GenomicRanges::GRanges(
      seqnames = probe_data$seqname,
      ranges   = IRanges::IRanges(start = probe_data$start, end = probe_data$end),
      probe_id    = probe_data$probe_id,
      gene_symbol = probe_data$gene_symbol %||% NA_character_,
      cpg_context = probe_data$cpg_context %||% NA_character_
    )
  } else {
    probe_gr <- GenomicRanges::GRanges()
  }

  # Convert crossmap data
  crossmap_data <- resp$data$crossmap
  if (!is.null(crossmap_data) && length(crossmap_data) > 0) {
    crossmap_df <- do.call(rbind, lapply(crossmap_data, as.data.frame, stringsAsFactors = FALSE))
  } else {
    crossmap_df <- data.frame(
      dst_platform = character(0),
      dst_probe_id = character(0),
      method       = character(0),
      confidence   = numeric(0)
    )
  }

  list(probe = probe_gr, crossmap = crossmap_df)
}


#' Batch probe lookup
#'
#' Look up multiple probes at once (max 10,000).
#'
#' @param probe_ids Character vector of probe identifiers.
#' @param build Genome build. Uses default from pg_connect() if NULL.
#' @return A GRanges object with all matched probes.
#' @export
pg_probe_batch <- function(probe_ids, build = NULL) {
  build <- .get_build(build)
  resp <- .pg_request(
    sprintf("/v1/probes/%s/batch", build),
    method = "POST",
    body = list(probe_ids = as.list(probe_ids))
  )
  gr_list <- .region_response_to_granges_list(resp)
  if (length(gr_list) == 0) return(GenomicRanges::GRanges())
  gr_list[[1]]
}
