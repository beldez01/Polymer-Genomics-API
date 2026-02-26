test_that("pg_connect stores settings", {
  pg_connect("http://test:9999", build = "hg37")
  env <- polymergenomics:::.pg_env
  expect_equal(env$base_url, "http://test:9999")
  expect_equal(env$build, "hg37")
})

test_that("pg_connect rejects invalid build", {
  expect_error(pg_connect(build = "hg99"))
})

test_that(".get_build uses default when NULL", {
  pg_connect(build = "hg38")
  expect_equal(polymergenomics:::.get_build(NULL), "hg38")
  expect_equal(polymergenomics:::.get_build("hg37"), "hg37")
})

test_that(".get_base_url errors when not connected", {
  # Reset state
  rm(list = ls(envir = polymergenomics:::.pg_env), envir = polymergenomics:::.pg_env)
  expect_error(polymergenomics:::.get_base_url(), "Not connected")
})
