# DNase-I hotspot (BLUEPRINT) -> cCRE-summarized, pooled to cell types -> SE.
# Reads DNASE_HOTSPOT_BED rows from the manifest, caps to 2 donors per bucket,
# downloads each BED.gz, scores over cCREs (agg="max"), aggregates to buckets.

for (f in list.files("R", pattern = "\\.R$", full.names = TRUE)) source(f)
suppressPackageStartupMessages({
  library(GenomicRanges)
  library(IRanges)
  library(data.table)
  library(jsonlite)
})
dir.create("output/se",        recursive = TRUE, showWarnings = FALSE)
dir.create("raw/blueprint_dnase", recursive = TRUE, showWarnings = FALSE)

ccres <- readRDS("output/ccres_hg38.rds")
cw    <- load_crosswalk("data/crosswalk.tsv")

MANIFEST <- "../internal/InSilico/HLA experiment/data_staging/blueprint_immune_subset/subset_dnase_hotspots.tsv"
m <- data.table::fread(MANIFEST, sep = "\t", quote = "")

# Use real column names via the header
stopifnot(all(c("CELL_TYPE", "FILE_TYPE", "URL") %in% names(m)))

# Keep only hotspot (not peaks) rows
m <- m[FILE_TYPE == "DNASE_HOTSPOT_BED"]
cat(sprintf("DNase: %d DNASE_HOTSPOT_BED rows in manifest\n", nrow(m)))

# Map cell types -> buckets; drop unmapped
m[, bucket := map_to_bucket(CELL_TYPE, cw)]
dropped_labels <- unique(m[is.na(bucket), CELL_TYPE])
if (length(dropped_labels) > 0)
  cat("DNase: dropping unmapped cell types:", paste(dropped_labels, collapse = "; "), "\n")
m <- m[!is.na(bucket)]

# Cap to 2 donors per bucket (deterministic: first 2)
m <- m[, head(.SD, 2L), by = bucket]
cat(sprintf("DNase: %d files across %d buckets: %s\n",
            nrow(m), length(unique(m$bucket)), paste(sort(unique(m$bucket)), collapse = ", ")))

# Helper: read a peak/hotspot BED.gz -> GRanges with score
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

# Download (skip on failure / size < 500 bytes), summarize over cCREs
local_path <- function(url) file.path("raw/blueprint_dnase", basename(url))
vecs <- list()
bk   <- character()
skips <- character()

for (i in seq_len(nrow(m))) {
  url  <- m$URL[i]
  dest <- local_path(url)
  bkt  <- m$bucket[i]

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

if (length(vecs) == 0) stop("DNase: no files loaded successfully")
if (length(skips) > 0)
  cat(sprintf("DNase: %d file(s) skipped: %s\n", length(skips), paste(skips, collapse = ", ")))

# Build features x donor matrix
mat <- do.call(cbind, vecs)
rownames(mat) <- names(ccres)
colnames(mat) <- paste0("dnase_", seq_along(vecs))
groups <- setNames(bk, colnames(mat))

agg <- aggregate_region(mat, groups, fun = "mean")
se  <- build_region_se(agg, ccres, assay_name = "dnase_signal")

saveRDS(se, "output/se/dnase.rds")
jsonlite::write_json(
  se_contract(se, "other", "DNase-hotspot"),
  "output/se/dnase.se.json",
  auto_unbox = TRUE, pretty = TRUE
)
cat(sprintf("dnase SE: %d features x %d cells (%s)\n",
            nrow(se), ncol(se), paste(colnames(se), collapse = ", ")))
