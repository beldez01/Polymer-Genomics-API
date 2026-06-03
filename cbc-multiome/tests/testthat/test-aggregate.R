test_that("aggregate_region collapses donor cols to cell-type cols", {
  m <- matrix(c(1,2, 3,4, 10,10), nrow = 2,
              dimnames = list(c("E1","E2"), c("d1","d2","d3")))
  groups <- c(d1 = "cd4_t", d2 = "cd4_t", d3 = "monocyte")
  out <- aggregate_region(m, groups, fun = "mean")
  expect_equal(colnames(out), c("cd4_t", "monocyte"))
  expect_equal(unname(out["E1","cd4_t"]), 2)   # mean(1,3)
  expect_equal(unname(out["E2","monocyte"]), 10)
})

test_that("aggregate_rna uses median by default", {
  m <- matrix(c(1,3,100, 2,4,200), nrow = 2, byrow = TRUE,
              dimnames = list(c("g1","g2"), c("d1","d2","d3")))
  groups <- c(d1 = "b_cell", d2 = "b_cell", d3 = "nk")
  out <- aggregate_rna(m, groups)
  expect_equal(unname(out["g1","b_cell"]), 2)  # median(1,3)
})
