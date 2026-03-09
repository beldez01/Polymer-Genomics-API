#!/usr/bin/env Rscript
# volcano_plot.R — Generate volcano plot from DMP results
# Input JSON: {session_dir, fdr, deltabeta}
# Output JSON: {image_path, format, n_significant}

source("utils.R")

suppressPackageStartupMessages({
  library(ggplot2)
})

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a

main <- function() {
  params <- parse_args()
  session_dir <- params$session_dir
  fdr_cutoff  <- params$fdr %||% 0.05
  db_cutoff   <- params$deltabeta %||% 0.1

  require_checkpoint(session_dir, "dmp_results.rds")
  results <- load_checkpoint(session_dir, "dmp_results.rds")

  # Prepare plot data
  df <- data.frame(
    deltaBeta = if ("deltaBeta" %in% colnames(results)) results$deltaBeta else results$logFC,
    neglog10p = -log10(results$adj.P.Val),
    stringsAsFactors = FALSE
  )
  # Remove non-finite
  df <- df[is.finite(df$deltaBeta) & is.finite(df$neglog10p), ]

  # Classify significance
  df$sig <- "NS"
  df$sig[abs(df$deltaBeta) >= db_cutoff & df$neglog10p >= -log10(fdr_cutoff)] <- "Significant"
  df$sig[abs(df$deltaBeta) >= db_cutoff & df$neglog10p < -log10(fdr_cutoff)] <- "Delta only"
  df$sig[abs(df$deltaBeta) < db_cutoff & df$neglog10p >= -log10(fdr_cutoff)] <- "FDR only"

  n_sig <- sum(df$sig == "Significant")

  colors <- c("NS" = "grey70", "Delta only" = "steelblue",
              "FDR only" = "orange", "Significant" = "red3")

  p <- ggplot(df, aes(x = deltaBeta, y = neglog10p, color = sig)) +
    geom_point(size = 0.5, alpha = 0.6) +
    scale_color_manual(values = colors) +
    geom_hline(yintercept = -log10(fdr_cutoff), linetype = "dashed", color = "grey40") +
    geom_vline(xintercept = c(-db_cutoff, db_cutoff), linetype = "dashed", color = "grey40") +
    labs(
      x = expression(Delta * beta),
      y = expression(-log[10](adj.P)),
      color = NULL,
      title = paste0("Volcano Plot (", n_sig, " significant)")
    ) +
    theme_minimal(base_size = 12) +
    theme(legend.position = "bottom")

  # Save as SVG
  svg_path <- file.path(session_dir, "volcano.svg")
  tryCatch({
    suppressPackageStartupMessages(library(svglite))
    svglite(svg_path, width = 7, height = 6)
  }, error = function(e) {
    svg(svg_path, width = 7, height = 6)
  })
  print(p)
  dev.off()

  # Also save PNG for base64 transport
  png_path <- file.path(session_dir, "volcano.png")
  png(png_path, width = 700, height = 600, res = 100)
  print(p)
  dev.off()

  # Base64 encode PNG
  png_bytes <- readBin(png_path, "raw", file.info(png_path)$size)
  b64 <- base64enc::base64encode(png_bytes)

  emit_json(list(
    image_path = svg_path,
    png_path = png_path,
    format = "svg+png",
    n_significant = n_sig,
    image_base64 = b64
  ))
}

main()
