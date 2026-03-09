#!/usr/bin/env Rscript
# load_idats.R — Load IDAT files into RGChannelSet
# Input JSON: {session_dir, idat_directory, sample_sheet?}
# Output JSON: {session_id, n_samples, array_type, qc_summary}

source("utils.R")

suppressPackageStartupMessages({
  library(minfi)
})

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a

detect_array <- function(rgSet) {
  n <- nrow(rgSet)
  if (n > 1000000) return(list(type = "EPICv2", genome = "hg38", expected = 1107072))
  if (n > 600000)  return(list(type = "EPIC",   genome = "hg19", expected = 1052641))
  list(type = "450K", genome = "hg19", expected = 622399)
}

main <- function() {
  params <- parse_args()
  session_dir    <- params$session_dir
  idat_directory <- params$idat_directory
  sample_sheet   <- params$sample_sheet

  if (!dir.exists(idat_directory)) {
    stop_json(paste("IDAT directory not found:", idat_directory))
  }

  # Find IDAT files
  idats <- list.files(idat_directory, pattern = "_(?:Red|Grn)\\.idat(\\.gz)?$",
                      recursive = TRUE, full.names = TRUE)
  if (length(idats) == 0) {
    stop_json("No IDAT files found in directory")
  }

  # Load sample sheet or create from IDAT basenames
  if (!is.null(sample_sheet) && file.exists(sample_sheet)) {
    targets <- read.metharray.sheet(dirname(sample_sheet),
                                     pattern = basename(sample_sheet))
  } else {
    # Auto-detect from IDAT basenames
    basenames <- unique(sub("_(Red|Grn)\\.idat(\\.gz)?$", "", idats))
    targets <- data.frame(
      Basename = basenames,
      Sample_Name = basename(basenames),
      stringsAsFactors = FALSE
    )
  }

  n_samples <- nrow(targets)
  if (n_samples == 0) {
    stop_json("No samples found in sample sheet")
  }

  # Read IDATs
  rgSet <- tryCatch(
    read.metharray.exp(targets = targets, force = TRUE),
    error = function(e) {
      # Try reading from basenames directly
      tryCatch(
        read.metharray(basenames = targets$Basename, force = TRUE),
        error = function(e2) stop_json(paste("Failed to read IDATs:", e2$message))
      )
    }
  )

  # Set sample names
  if ("Sample_Name" %in% colnames(targets)) {
    sampleNames(rgSet) <- targets$Sample_Name
    pData(rgSet) <- DataFrame(targets)
  }

  # Detect array type
  arr <- detect_array(rgSet)

  # Basic QC: detection p-values
  detP <- detectionP(rgSet)
  failed_frac <- colMeans(detP > 0.01)
  qc_summary <- list(
    mean_detection_pval = round(mean(detP), 6),
    max_sample_fail_rate = round(max(failed_frac), 4),
    failed_samples = names(which(failed_frac > 0.05)),
    n_failed_samples = sum(failed_frac > 0.05)
  )

  # Save checkpoint
  save_checkpoint(rgSet, session_dir, "raw.rds")
  save_checkpoint(detP, session_dir, "detP.rds")

  # Save sample metadata as CSV for inspection
  write.csv(pData(rgSet), file.path(session_dir, "samples.csv"), row.names = FALSE)

  emit_json(list(
    session_id = basename(session_dir),
    n_samples = n_samples,
    array_type = arr$type,
    genome = arr$genome,
    n_probes = nrow(rgSet),
    sample_names = sampleNames(rgSet),
    qc_summary = qc_summary
  ))
}

main()
