#!/usr/bin/env Rscript
# utils.R — Shared helpers for Polymer MCP R scripts
# Contract: JSON in (CLI arg) → JSON out (stdout)

suppressPackageStartupMessages({
  library(jsonlite)
})

#' Parse JSON input from CLI argument
#' @return Named list of parameters
parse_args <- function() {
  args <- commandArgs(trailingOnly = TRUE)
  if (length(args) == 0) {
    stop_json("No JSON argument provided")
  }
  tryCatch(
    fromJSON(args[1], simplifyVector = FALSE),
    error = function(e) stop_json(paste("Invalid JSON input:", e$message))
  )
}

#' Write JSON result to stdout
#' @param result Named list to serialize
emit_json <- function(result) {
  cat(toJSON(result, auto_unbox = TRUE, null = "null", na = "null"))
}

#' Write JSON error to stderr and exit with code 1
#' @param message Error message string
stop_json <- function(message) {
  cat(toJSON(list(error = message), auto_unbox = TRUE), file = stderr())
  quit(status = 1, save = "no")
}

#' Validate that session directory exists and contains expected checkpoint
#' @param session_dir Path to session directory
#' @param checkpoint Required .rds file (e.g., "raw.rds")
#' @return Invisible TRUE, or calls stop_json
require_checkpoint <- function(session_dir, checkpoint) {
  if (!dir.exists(session_dir)) {
    stop_json(paste("Session not found:", basename(session_dir)))
  }
  path <- file.path(session_dir, checkpoint)
  if (!file.exists(path)) {
    needed <- sub("\\.rds$", "", checkpoint)
    stop_json(paste0("Run '", needed, "' first. Missing: ", checkpoint))
  }
  invisible(TRUE)
}

#' Load the latest valid checkpoint from session
#' @param session_dir Path to session directory
#' @param checkpoint .rds filename
#' @return Deserialized R object
load_checkpoint <- function(session_dir, checkpoint) {
  path <- file.path(session_dir, checkpoint)
  readRDS(path)
}

#' Save checkpoint to session directory
#' @param obj R object to save
#' @param session_dir Path to session directory
#' @param checkpoint .rds filename
save_checkpoint <- function(obj, session_dir, checkpoint) {
  path <- file.path(session_dir, checkpoint)
  saveRDS(obj, path)
}
