test_that(".json_to_granges converts valid data", {
  gr_json <- list(
    class = "GRanges",
    seqnames = list("chr1", "chr1"),
    ranges = list(start = list(100, 200), end = list(150, 250), width = list(51, 51)),
    strand = list("*", "*"),
    mcols = list(context = list("island", "shore"), gc_content = list(0.6, 0.4)),
    n = 2
  )
  gr <- polymergenomics:::.json_to_granges(gr_json)
  expect_s4_class(gr, "GRanges")
  expect_equal(length(gr), 2)
})

test_that(".json_to_granges handles empty data", {
  gr_json <- list(n = 0)
  gr <- polymergenomics:::.json_to_granges(gr_json)
  expect_s4_class(gr, "GRanges")
  expect_equal(length(gr), 0)
})

test_that(".json_to_granges handles NULL mcols values", {
  gr_json <- list(
    class = "GRanges",
    seqnames = list("chr1"),
    ranges = list(start = list(100), end = list(200), width = list(101)),
    strand = list("+"),
    mcols = list(gene_symbol = list("TP53"), gene_id = list(NULL)),
    n = 1
  )
  gr <- polymergenomics:::.json_to_granges(gr_json)
  expect_true(is.na(S4Vectors::mcols(gr)$gene_id[1]))
})
