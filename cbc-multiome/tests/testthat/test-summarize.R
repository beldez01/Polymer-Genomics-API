test_that("summarize_over_ccres averages signal per element", {
  ccres <- GenomicRanges::GRanges("chr1",
    IRanges::IRanges(c(100, 300), c(200, 400)))
  names(ccres) <- c("E1", "E2")
  # signal intervals with a 'score' column
  sig <- GenomicRanges::GRanges("chr1",
    IRanges::IRanges(c(100, 150, 300), c(149, 200, 400)),
    score = c(2, 4, 10))
  v <- summarize_over_ccres(sig, ccres, agg = "mean")
  expect_equal(unname(v["E1"]), 3)   # mean of 2 and 4 overlapping E1
  expect_equal(unname(v["E2"]), 10)
  expect_named(v, c("E1", "E2"))
})

test_that("summarize_over_ccres returns NA for elements with no overlap", {
  ccres <- GenomicRanges::GRanges("chr1", IRanges::IRanges(1000, 1100)); names(ccres) <- "E9"
  sig <- GenomicRanges::GRanges("chr1", IRanges::IRanges(1, 10), score = 5)
  v <- summarize_over_ccres(sig, ccres, agg = "mean")
  expect_true(is.na(v["E9"]))
})

test_that("load_rna_tpm keys TPM by gene id", {
  tmp <- tempfile(fileext = ".tsv")
  writeLines(c("gene_id\tTPM", "ENSG1\t5.0", "ENSG2\t0.0"), tmp)
  v <- load_rna_tpm(tmp)
  expect_equal(unname(v["ENSG1"]), 5.0)
  expect_named(v, c("ENSG1", "ENSG2"))
})
