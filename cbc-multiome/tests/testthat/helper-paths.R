# testthat runs test files with the working directory set to tests/testthat/.
# These helpers resolve paths regardless of that: proj_path() -> project root,
# fixture_path() -> tests/testthat/fixtures/. Used by all test-*.R files.
proj_path    <- function(...) file.path("..", "..", ...)
fixture_path <- function(...) file.path("fixtures", ...)
