#' BFS depth from a root over data-backed edges. Returns named integer vector.
graph_depth <- function(edges, root = "hsc") {
  e <- edges[edges$model == "data-backed", c("from","to"), drop=FALSE]
  depth <- c(); depth[[root]] <- 0L
  frontier <- root
  while (length(frontier)) {
    nxt <- character(0)
    for (n in frontier) for (ch in e$to[e$from == n]) {
      if (is.null(depth[[ch]])) { depth[[ch]] <- depth[[n]] + 1L; nxt <- c(nxt, ch) }
    }
    frontier <- nxt
  }
  unlist(depth)
}

#' 2D layout: y = BFS depth; x = leaves spaced sequentially, internal = mean(children x).
node_layout <- function(nodes, edges, root = "hsc") {
  e <- edges[edges$model == "data-backed", c("from","to"), drop=FALSE]
  ids <- nodes$id
  depth <- graph_depth(edges, root)
  y <- vapply(ids, function(i) as.numeric(if (is.na(depth[i])) max(depth, na.rm=TRUE) else depth[i]), numeric(1))
  children <- function(n) e$to[e$from == n]
  is_leaf <- vapply(ids, function(i) length(children(i)) == 0, logical(1))
  leaves <- ids[is_leaf]
  xslot <- setNames(seq_along(leaves), leaves)
  x <- setNames(rep(NA_real_, length(ids)), ids)
  x[leaves] <- as.numeric(xslot[leaves])
  resolve <- function(n) {
    if (!is.na(x[n])) return(x[n])
    ch <- children(n); if (!length(ch)) return(NA_real_)
    v <- mean(vapply(ch, resolve, numeric(1))); x[n] <<- v; v
  }
  for (i in ids) x[i] <- resolve(i)
  m <- cbind(x = x[ids], y = y[ids]); rownames(m) <- ids
  m
}

#' Normalized Shannon entropy of a non-negative vector. Returns 0..1.
shannon_entropy <- function(v) {
  v <- v[is.finite(v) & v > 0]; if (length(v) <= 1) return(0)
  p <- v / sum(v); h <- -sum(p * log(p)); h / log(length(v))
}

#' Count features whose |a-b| > threshold; NA in either side skipped.
edge_change <- function(a, b, threshold) {
  common <- intersect(names(a), names(b)); da <- a[common]; db <- b[common]
  ok <- is.finite(da) & is.finite(db); sum(abs(da[ok] - db[ok]) > threshold)
}
