#' @title Polymer Genomics API Connection
#' @description Manage connection to the Polymer Genomics API.

# Package environment for storing connection state
.pg_env <- new.env(parent = emptyenv())

#' Connect to the Polymer Genomics API
#'
#' Stores the API base URL and optional API key in the package environment.
#' All subsequent \code{pg_*} functions use these settings.
#'
#' @param base_url API base URL (default: "http://localhost:8000").
#' @param api_key Optional API key for authenticated access.
#' @param build Default genome build ("hg38" or "hg37").
#' @return Invisibly returns a list with connection settings.
#' @export
pg_connect <- function(base_url = "http://localhost:8000",
                       api_key = NULL,
                       build = "hg38") {
  stopifnot(build %in% c("hg37", "hg38"))
  .pg_env$base_url <- sub("/$", "", base_url)
  .pg_env$api_key  <- api_key
  .pg_env$build    <- build
  message(sprintf("Connected to Polymer Genomics API at %s (build: %s)", base_url, build))
  invisible(list(base_url = base_url, build = build))
}

# Internal: get base URL or error
.get_base_url <- function() {
  url <- .pg_env$base_url
  if (is.null(url)) stop("Not connected. Call pg_connect() first.", call. = FALSE)
  url
}

# Internal: get default build
.get_build <- function(build = NULL) {
  if (!is.null(build)) return(build)
  b <- .pg_env$build
  if (is.null(b)) stop("No build specified and no default set. Call pg_connect() first.", call. = FALSE)
  b
}

# Internal: make an API request
.pg_request <- function(path, params = list(), method = "GET", body = NULL) {
  base <- .get_base_url()
  url <- paste0(base, path)

  req <- httr2::request(url)

  if (!is.null(.pg_env$api_key)) {
    req <- httr2::req_headers(req, Authorization = paste("Bearer", .pg_env$api_key))
  }

  if (method == "GET" && length(params) > 0) {
    req <- httr2::req_url_query(req, !!!params)
  }

  if (method == "POST" && !is.null(body)) {
    req <- httr2::req_body_json(req, body)
    req <- httr2::req_method(req, "POST")
  }

  req <- httr2::req_error(req, is_error = function(resp) FALSE)
  resp <- httr2::req_perform(req)

  status <- httr2::resp_status(resp)
  parsed <- httr2::resp_body_json(resp)

  if (status >= 400) {
    msg <- parsed$error$message %||% paste("API error:", status)
    stop(msg, call. = FALSE)
  }

  parsed
}

# Null coalescing operator
`%||%` <- function(x, y) if (is.null(x)) y else x
