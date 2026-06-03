test_that("load_ccres returns a named GRanges with ccre class", {
  gr <- load_ccres(fixture_path("ccre_mini.bed"))
  expect_s4_class(gr, "GRanges")
  expect_equal(length(gr), 5L)
  expect_true("ccre_class" %in% names(S4Vectors::mcols(gr)))
  expect_equal(names(gr)[1], "EH38E0001")
  expect_equal(as.character(GenomicRanges::seqnames(gr))[4], "chr2")
})

test_that("load_ccres handles 6-col ENCODE SCREEN layout and keys on EH38E accession", {
  gr <- load_ccres(fixture_path("ccre_mini6.bed"))
  expect_s4_class(gr, "GRanges")
  expect_equal(length(gr), 3L)
  expect_equal(names(gr)[1], "EH38E2776516")   # keyed on col 5 (EH38E), NOT col 4 (EH38D)
  expect_equal(gr$ccre_class[2], "dELS")
  expect_true("ccre_class" %in% names(S4Vectors::mcols(gr)))
})

test_that("load_ccres 6-col: start coord is correctly 1-based (BED +1 offset)", {
  gr <- load_ccres(fixture_path("ccre_mini6.bed"))
  expect_equal(GenomicRanges::start(gr)[1], 10034L)  # 10033 + 1
})
