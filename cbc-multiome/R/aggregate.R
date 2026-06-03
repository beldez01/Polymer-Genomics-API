#' Aggregate a feature×donor matrix to feature×cell-type by a grouping vector.
#' @param mat numeric matrix (features × donor columns)
#' @param groups named character vector mapping colnames(mat) -> bucket
#' @param fun "mean" or "median"
.aggregate_matrix <- function(mat, groups, fun) {
  g <- groups[colnames(mat)]
  keep <- !is.na(g)
  mat <- mat[, keep, drop = FALSE]; g <- g[keep]
  f <- if (fun == "median") function(x) stats::median(x, na.rm = TRUE) else function(x) mean(x, na.rm = TRUE)
  buckets <- sort(unique(g))
  # sapply over buckets: each apply() returns a numeric vector of length nrow(mat)
  # so sapply produces a nrow(mat) x length(buckets) matrix
  out <- sapply(buckets, function(b) apply(mat[, g == b, drop = FALSE], 1, f))
  # Guarantee matrix (handles single-bucket or single-feature edge cases)
  out <- matrix(out, nrow = nrow(mat), ncol = length(buckets))
  rownames(out) <- rownames(mat)
  colnames(out) <- buckets
  out
}

aggregate_region <- function(mat, groups, fun = "mean") .aggregate_matrix(mat, groups, fun)
aggregate_rna    <- function(mat, groups, fun = "median") .aggregate_matrix(mat, groups, fun)
