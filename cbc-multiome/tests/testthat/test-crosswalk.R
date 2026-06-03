test_that("map_to_bucket resolves known labels and pools subsets", {
  cw <- load_crosswalk(proj_path("data/crosswalk.tsv"))
  expect_equal(map_to_bucket("hematopoietic stem cell", cw), "hsc")
  expect_equal(map_to_bucket("regulatory T cell", cw), "cd4_t")
  expect_equal(map_to_bucket("Blood-Monocytes", cw), "monocyte")
})

test_that("map_to_bucket returns NA for unknown labels", {
  cw <- load_crosswalk(proj_path("data/crosswalk.tsv"))
  expect_true(is.na(map_to_bucket("erythroblast", cw)))
})
