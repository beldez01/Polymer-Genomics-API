# Export one assay of a MultiAssayExperiment as a genes(rows) x cells(cols)
# parquet, with a leading `gene` column. Used as the R->Python seam for the
# landscape-p0 manifold projection.
suppressPackageStartupMessages({
  library(SummarizedExperiment)
  library(MultiAssayExperiment)
})

export_node_vectors <- function(mae, assay_name, out_path) {
  stopifnot(assay_name %in% names(experiments(mae)))
  se <- experiments(mae)[[assay_name]]
  m <- as.matrix(assay(se))
  df <- data.frame(gene = rownames(m), m, check.names = FALSE,
                   stringsAsFactors = FALSE, row.names = NULL)
  arrow::write_parquet(df, out_path)
  invisible(out_path)
}
