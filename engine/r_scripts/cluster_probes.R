#!/usr/bin/env Rscript
# cluster_probes.R — Hierarchical clustering heatmap of top variable probes
# Input JSON: {session_dir, n_probes, method, distance}
# Output JSON: {image_path, cluster_assignments, probes_used}

source("utils.R")

suppressPackageStartupMessages({
  library(minfi)
  library(matrixStats)
})

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a

main <- function() {
  params <- parse_args()
  session_dir <- params$session_dir
  n_probes    <- params$n_probes %||% 1000
  method      <- params$method %||% "hclust"
  distance    <- params$distance %||% "euclidean"

  require_checkpoint(session_dir, "filtered.rds")
  grSet <- load_checkpoint(session_dir, "filtered.rds")

  betas <- getBeta(grSet)

  # Select top variable probes
  vars <- rowVars(betas, na.rm = TRUE)
  n_select <- min(n_probes, nrow(betas))
  top_idx <- order(vars, decreasing = TRUE)[1:n_select]
  mat <- betas[top_idx, , drop = FALSE]
  probes_used <- rownames(mat)

  # Remove any rows with NA
  complete <- complete.cases(mat)
  mat <- mat[complete, , drop = FALSE]
  probes_used <- rownames(mat)

  # Hierarchical clustering on samples
  d_samples <- dist(t(mat), method = distance)
  hc_samples <- hclust(d_samples, method = "ward.D2")
  cluster_k <- min(2, ncol(mat))
  clusters <- cutree(hc_samples, k = cluster_k)

  # Generate heatmap
  svg_path <- file.path(session_dir, "heatmap.svg")
  png_path <- file.path(session_dir, "heatmap.png")

  heatmap_ok <- tryCatch({
    suppressPackageStartupMessages(library(ComplexHeatmap))
    suppressPackageStartupMessages(library(circlize))

    col_fun <- colorRamp2(c(0, 0.5, 1), c("blue", "white", "red"))

    # Annotation from phenodata
    pd <- as.data.frame(pData(grSet))
    ha <- NULL
    if (ncol(pd) > 0) {
      # Use first non-ID column as annotation
      ann_cols <- setdiff(colnames(pd), c("Basename", "filenames", "predictedSex"))
      if (length(ann_cols) > 0) {
        ann_col <- ann_cols[1]
        ha <- HeatmapAnnotation(
          Group = pd[[ann_col]],
          show_legend = TRUE
        )
      }
    }

    ht <- Heatmap(
      mat,
      name = "Beta",
      col = col_fun,
      show_row_names = FALSE,
      show_column_names = TRUE,
      column_names_rot = 45,
      top_annotation = ha,
      clustering_distance_columns = distance,
      clustering_method_columns = "ward.D2",
      clustering_distance_rows = distance,
      clustering_method_rows = "ward.D2",
      column_title = paste0("Top ", nrow(mat), " variable probes")
    )

    # SVG
    tryCatch({
      suppressPackageStartupMessages(library(svglite))
      svglite(svg_path, width = 8, height = 10)
    }, error = function(e) {
      svg(svg_path, width = 8, height = 10)
    })
    draw(ht)
    dev.off()

    # PNG
    png(png_path, width = 800, height = 1000, res = 100)
    draw(ht)
    dev.off()

    TRUE
  }, error = function(e) {
    # Fallback: base R heatmap
    tryCatch({
      suppressPackageStartupMessages(library(svglite))
      svglite(svg_path, width = 8, height = 10)
    }, error = function(e2) {
      svg(svg_path, width = 8, height = 10)
    })
    heatmap(mat, scale = "none", col = colorRampPalette(c("blue", "white", "red"))(100),
            main = paste0("Top ", nrow(mat), " variable probes"),
            labRow = NA)
    dev.off()

    png(png_path, width = 800, height = 1000, res = 100)
    heatmap(mat, scale = "none", col = colorRampPalette(c("blue", "white", "red"))(100),
            main = paste0("Top ", nrow(mat), " variable probes"),
            labRow = NA)
    dev.off()

    TRUE
  })

  # Save cluster assignments
  cluster_df <- data.frame(
    sample = names(clusters),
    cluster = clusters,
    stringsAsFactors = FALSE
  )
  write.csv(cluster_df, file.path(session_dir, "clusters.csv"), row.names = FALSE)

  # Base64 encode PNG
  png_bytes <- readBin(png_path, "raw", file.info(png_path)$size)
  b64 <- base64enc::base64encode(png_bytes)

  emit_json(list(
    image_path = svg_path,
    png_path = png_path,
    format = "svg+png",
    n_probes_used = length(probes_used),
    n_samples = ncol(mat),
    cluster_assignments = as.list(clusters),
    image_base64 = b64
  ))
}

main()
