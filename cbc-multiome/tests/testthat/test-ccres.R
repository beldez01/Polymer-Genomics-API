test_that("load_ccres returns a named GRanges with ccre class", {
  gr <- load_ccres(fixture_path("ccre_mini.bed"))
  expect_s4_class(gr, "GRanges")
  expect_equal(length(gr), 5L)
  expect_true("ccre_class" %in% names(S4Vectors::mcols(gr)))
  expect_equal(names(gr)[1], "EH38E0001")
  expect_equal(as.character(GenomicRanges::seqnames(gr))[4], "chr2")
})
