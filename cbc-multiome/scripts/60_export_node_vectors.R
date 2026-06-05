# Export the 12 bulk node vectors from the assembled MAE to parquet for the
# Python manifold projection. RNA drives placement; cCRE methylation exported
# too for the drill-down / P1.
for (f in list.files("R", pattern = "\\.R$", full.names = TRUE)) source(f)
suppressPackageStartupMessages({
  library(MultiAssayExperiment); library(SummarizedExperiment); library(arrow)
})

mae <- readRDS("output/cbc_multiome.rds")
dir.create("data/manifold", recursive = TRUE, showWarnings = FALSE)

export_node_vectors(mae, "rnaseq", "data/manifold/node_rna.parquet")
if ("methylation" %in% names(experiments(mae))) {
  export_node_vectors(mae, "methylation", "data/manifold/node_methylation.parquet")
}
cat("node vectors written to data/manifold/\n")
