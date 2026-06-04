test_that("graph_depth does BFS distance from root over data-backed edges", {
  edges <- data.frame(from=c("hsc","hsc","mpp"), to=c("mpp","cmp","gmp"),
                      model=c("data-backed","data-backed","data-backed"), stringsAsFactors=FALSE)
  d <- graph_depth(edges, root="hsc")
  expect_equal(d[["hsc"]], 0); expect_equal(d[["mpp"]], 1)
  expect_equal(d[["cmp"]], 1); expect_equal(d[["gmp"]], 2)
})
test_that("node_layout gives y=depth and x=descendant-mean (leaves spaced)", {
  nodes <- data.frame(id=c("hsc","mpp","b","mono"), stringsAsFactors=FALSE)
  edges <- data.frame(from=c("hsc","mpp","mpp"), to=c("mpp","b","mono"),
                      model="data-backed", stringsAsFactors=FALSE)
  lay <- node_layout(nodes, edges, root="hsc")
  expect_equal(lay["hsc","y"], 0); expect_equal(lay["mpp","y"], 1)
  expect_equal(lay["b","y"], 2)
  expect_equal(lay["hsc","x"], lay["mpp","x"])
  expect_true(lay["b","x"] != lay["mono","x"])
})

test_that("shannon_entropy is max for uniform, 0 for a point mass, normalized 0..1", {
  expect_equal(shannon_entropy(c(1,1,1,1)), 1)
  expect_equal(shannon_entropy(c(5,0,0,0)), 0)
  expect_true(shannon_entropy(c(3,1)) > 0 && shannon_entropy(c(3,1)) < 1)
})
test_that("edge_change counts features whose abs diff exceeds threshold, ignoring NA", {
  a <- c(E1=0.1, E2=0.9, E3=NA); b <- c(E1=0.8, E2=0.85, E3=0.5)
  expect_equal(edge_change(a, b, threshold=0.2), 1L)
})
