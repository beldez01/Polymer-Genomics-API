# ChIP-seq histone marks (BLUEPRINT, MACS2) -> cCRE-summarized, pooled to cell types -> 6 SEs.
# Reads CHIP_MACS2_BED rows from the manifest, processes each of the 6 marks independently,
# caps to 2 donors per bucket, downloads each BED.gz, scores over cCREs (agg="max"),
# aggregates to buckets.

for (f in list.files("R", pattern = "\\.R$", full.names = TRUE)) source(f)
suppressPackageStartupMessages({
  library(GenomicRanges)
  library(IRanges)
  library(data.table)
  library(jsonlite)
})
dir.create("output/se",         recursive = TRUE, showWarnings = FALSE)
dir.create("raw/blueprint_chip", recursive = TRUE, showWarnings = FALSE)

ccres <- readRDS("output/ccres_hg38.rds")
cw    <- load_crosswalk("data/crosswalk.tsv")

MANIFEST <- "../internal/InSilico/HLA experiment/data_staging/blueprint_immune_subset/subset_chip_peaks.tsv"
m <- data.table::fread(MANIFEST, sep = "\t", quote = "")

# Use real column names via the header
stopifnot(all(c("CELL_TYPE", "FILE_TYPE", "HISTONE_MARK", "URL") %in% names(m)))

# Accept both CHIP_MACS2_BED (narrow, H3K4me3/H3K27ac) and CHIP_MACS2_BROAD_BED
# (broad marks H3K4me1/H3K27me3/H3K36me3/H3K9me3). In this BLUEPRINT subset,
# the 4 broad marks only appear as CHIP_MACS2_BROAD_BED.
m <- m[FILE_TYPE %in% c("CHIP_MACS2_BED", "CHIP_MACS2_BROAD_BED")]
cat(sprintf("ChIP: %d CHIP_MACS2_*BED rows in manifest\n", nrow(m)))

# Map cell types -> buckets; drop unmapped
m[, bucket := map_to_bucket(CELL_TYPE, cw)]
dropped_labels <- unique(m[is.na(bucket), CELL_TYPE])
if (length(dropped_labels) > 0)
  cat("ChIP: dropping unmapped cell types:", paste(dropped_labels, collapse = "; "), "\n")
m <- m[!is.na(bucket)]

MARKS <- c("H3K4me1", "H3K4me3", "H3K27ac", "H3K27me3", "H3K36me3", "H3K9me3")

# Helper: read a MACS2 narrowPeak BED.gz -> GRanges with score
read_peak_bed <- function(path) {
  dt <- data.table::fread(path, header = FALSE)
  score_col <- NA_integer_
  for (j in 4:min(7L, ncol(dt))) {
    if (is.numeric(dt[[j]])) { score_col <- j; break }
  }
  sc <- if (is.na(score_col)) rep(1, nrow(dt)) else dt[[score_col]]
  GenomicRanges::GRanges(dt[[1]],
                         IRanges::IRanges(dt[[2]] + 1L, dt[[3]]),
                         score = sc)
}

local_path <- function(url) file.path("raw/blueprint_chip", basename(url))

all_skips <- character()

for (mark in MARKS) {
  mm <- m[HISTONE_MARK == mark]

  if (nrow(mm) == 0) {
    cat(sprintf("\n--- %s: no mappable rows, skipping ---\n", mark))
    next
  }

  # Cap to 2 donors per bucket
  mm <- mm[, head(.SD, 2L), by = bucket]
  cat(sprintf("\n--- %s: %d files across %d buckets: %s ---\n",
              mark, nrow(mm), length(unique(mm$bucket)),
              paste(sort(unique(mm$bucket)), collapse = ", ")))

  vecs <- list()
  bk   <- character()
  skips <- character()

  for (i in seq_len(nrow(mm))) {
    url  <- mm$URL[i]
    dest <- local_path(url)
    bkt  <- mm$bucket[i]

    if (!file.exists(dest)) {
      ok <- tryCatch(
        { download.file(url, dest, mode = "wb", quiet = TRUE); TRUE },
        error = function(e) FALSE
      )
      if (!ok || !file.exists(dest) || file.size(dest) < 500L) {
        cat("  SKIP (download failed):", basename(url), "\n")
        skips <- c(skips, basename(url))
        if (file.exists(dest)) file.remove(dest)
        next
      }
    }

    gr <- tryCatch(read_peak_bed(dest), error = function(e) {
      cat("  SKIP (parse failed):", basename(dest), "\n"); NULL
    })
    if (is.null(gr)) { skips <- c(skips, basename(dest)); next }

    v <- tryCatch(
      summarize_over_ccres(gr, ccres, agg = "max"),
      error = function(e) {
        cat("  SKIP (summarize failed):", basename(dest), e$message, "\n"); NULL
      }
    )
    if (is.null(v)) { skips <- c(skips, basename(dest)); next }

    vecs[[length(vecs) + 1]] <- v
    bk <- c(bk, bkt)
    cat(sprintf("  [%d] %s <- %s (peaks: %d)\n", length(vecs), bkt, basename(dest), length(gr)))
    rm(gr, v); gc()
  }

  if (length(skips) > 0)
    cat(sprintf("  %s: %d file(s) skipped: %s\n", mark, length(skips), paste(skips, collapse = ", ")))
  all_skips <- c(all_skips, skips)

  if (length(vecs) == 0) {
    cat(sprintf("  %s: no files loaded successfully, skipping mark\n", mark))
    next
  }

  # Build features x donor matrix
  mat <- do.call(cbind, vecs)
  rownames(mat) <- names(ccres)
  colnames(mat) <- paste0(tolower(mark), "_", seq_along(vecs))
  groups <- setNames(bk, colnames(mat))

  agg <- aggregate_region(mat, groups, fun = "mean")

  mark_lower <- tolower(gsub("H3K", "h3k", mark))
  out_rds    <- sprintf("output/se/chipseq_%s.rds", mark_lower)
  out_json   <- sprintf("output/se/chipseq_%s.se.json", mark_lower)

  se <- build_region_se(agg, ccres, assay_name = "signal")
  saveRDS(se, out_rds)
  jsonlite::write_json(
    se_contract(se, "chipseq", mark),
    out_json,
    auto_unbox = TRUE, pretty = TRUE
  )
  cat(sprintf("%s SE: %d features x %d cells (%s)\n",
              mark, nrow(se), ncol(se), paste(colnames(se), collapse = ", ")))
  rm(mat, vecs, agg, se); gc()
}

if (length(all_skips) > 0)
  cat(sprintf("\nTotal skipped across all marks: %d file(s)\n", length(all_skips)))

cat("\nDone: 14_build_histone.R\n")
