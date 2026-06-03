#' Load the cell-type crosswalk table.
#' @return data.frame with columns source_label, bucket
load_crosswalk <- function(path = "data/crosswalk.tsv") {
  cw <- utils::read.delim(path, stringsAsFactors = FALSE)
  stopifnot(all(c("source_label", "bucket") %in% names(cw)))
  cw
}

#' Map a source cell-type label to one of the 12 canonical buckets.
#' @return single character bucket, or NA_character_ if unknown
map_to_bucket <- function(label, crosswalk) {
  hit <- crosswalk$bucket[match(label, crosswalk$source_label)]
  if (length(hit) == 0) return(NA_character_)
  hit
}
