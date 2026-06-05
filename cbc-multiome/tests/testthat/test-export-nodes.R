test_that("export_node_vectors writes a genes x cells parquet", {
  skip_if_not_installed("arrow")
  skip_if_not_installed("SummarizedExperiment")
  skip_if_not_installed("MultiAssayExperiment")
  source(proj_path("R", "export_nodes.R"))

  library(SummarizedExperiment); library(MultiAssayExperiment)
  m <- matrix(c(1, 2, 3, 4, 5, 6), nrow = 3,
              dimnames = list(c("g1", "g2", "g3"), c("hsc", "cd4_t")))
  se <- SummarizedExperiment(assays = list(counts = m))
  mae <- MultiAssayExperiment(experiments = list(rnaseq = se))

  out <- tempfile(fileext = ".parquet")
  export_node_vectors(mae, "rnaseq", out)

  df <- as.data.frame(arrow::read_parquet(out))
  expect_equal(df$gene, c("g1", "g2", "g3"))
  expect_equal(df$hsc, c(1, 2, 3))
  expect_equal(df$cd4_t, c(4, 5, 6))
})
