make_se <- function(cells, assay_name = "v") {
  m <- matrix(seq_along(cells), nrow = 1, dimnames = list("F1", cells))
  SummarizedExperiment::SummarizedExperiment(assays = setNames(list(m), assay_name))
}

test_that("build_cbc_mae links experiments by cell type and is ragged", {
  exps <- list(
    methylation = make_se(c("hsc","cd4_t","monocyte")),
    rnaseq      = make_se(c("cd4_t","monocyte","nk"))  # no hsc, adds nk
  )
  mae <- build_cbc_mae(exps)
  expect_s4_class(mae, "MultiAssayExperiment")
  expect_true(all(c("methylation","rnaseq") %in% names(MultiAssayExperiment::experiments(mae))))
  # union of cells across assays present in colData
  expect_true(all(c("hsc","cd4_t","monocyte","nk") %in% rownames(MultiAssayExperiment::colData(mae))))
})

test_that("compute_mae_dimnames_hash is stable and order-independent", {
  exps <- list(a = make_se(c("hsc","cd4_t")), b = make_se(c("cd4_t","hsc")))
  h1 <- compute_mae_dimnames_hash(build_cbc_mae(exps))
  h2 <- compute_mae_dimnames_hash(build_cbc_mae(exps[c("b","a")]))
  expect_equal(h1, h2)
  expect_match(h1, "^sha256:[a-f0-9]{64}$")
})

test_that("write_mae_contract writes JSON whose hash matches the MAE", {
  exps <- list(methylation = make_se(c("hsc","cd4_t")))
  mae <- build_cbc_mae(exps)
  tmp <- tempfile(fileext = ".json")
  write_mae_contract(mae, tmp)
  ct <- jsonlite::read_json(tmp)
  expect_equal(ct$type, "MAEContract")
  expect_equal(ct$dimnames_hash, compute_mae_dimnames_hash(mae))
})
