test_that("build_region_se makes an SE with rowRanges and one assay", {
  ccres <- GenomicRanges::GRanges("chr1", IRanges::IRanges(c(100,300),c(200,400)))
  names(ccres) <- c("E1","E2")
  m <- matrix(c(0.1,0.9,0.2,0.8), nrow=2, dimnames=list(c("E1","E2"), c("cd4_t","monocyte")))
  se <- build_region_se(m, ccres, assay_name = "beta")
  expect_s4_class(se, "RangedSummarizedExperiment")
  expect_equal(SummarizedExperiment::assayNames(se), "beta")
  expect_equal(ncol(se), 2L)
})

test_that("se_contract emits assay_type and sample/feature counts", {
  ccres <- GenomicRanges::GRanges("chr1", IRanges::IRanges(100,200)); names(ccres) <- "E1"
  m <- matrix(0.5, nrow=1, dimnames=list("E1","cd4_t"))
  se <- build_region_se(m, ccres, assay_name = "beta")
  ct <- se_contract(se, assay_type = "methylation", platform = "WGBS")
  expect_equal(ct$assay_type, "methylation")
  expect_equal(ct$n_features, 1L)
  expect_equal(ct$n_samples, 1L)
})
