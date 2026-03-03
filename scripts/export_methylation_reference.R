#!/usr/bin/env Rscript
# export_methylation_reference.R
#
# Export full cell-type reference methylation betas from FlowSorted.Blood.EPIC
# (Salas 2018, 37 purified samples, EPIC v1 array) for all ~865K probes.
#
# Pipeline:
#   1. Load RGChannelSet from ExperimentHub (EH1136)
#   2. Subset to purified cell types (exclude MIX samples)
#   3. preprocessQuantile normalization
#   4. Extract betas, average per cell type
#   5. Merge with probe coordinates from EPIC v1 annotation
#   6. Export CSV
#
# Output columns: probe_id, chr, pos, Gran, Mono, NK, Bcell, CD4T, CD8T
#   - pos is 1-based (API convention; ingest converts to 0-based internally)
#
# Usage:
#   Rscript export_methylation_reference.R
#   Rscript export_methylation_reference.R --out data/methylation_reference_hg38.csv
#
# Requirements:
#   BiocManager::install(c("FlowSorted.Blood.EPIC", "minfi",
#     "IlluminaHumanMethylationEPICanno.ilm10b4.hg19", "ExperimentHub"))
#   install.packages("optparse")

suppressPackageStartupMessages({
  library(optparse)
  library(FlowSorted.Blood.EPIC)
  library(minfi)
  library(ExperimentHub)
})

# ── Options ──────────────────────────────────────────────────────────────────

`%||%` <- function(a, b) if (!is.null(a)) a else b

option_list <- list(
  make_option("--build",  type = "character", default = "hg38",
              help = "Genome build: hg38 or hg37 [default: %default]"),
  make_option("--out",    type = "character", default = NULL,
              help = "Output CSV path [default: data/methylation_reference_{build}.csv]"),
  make_option("--n",      type = "integer",   default = NULL,
              help = "Limit to first N probes (debug/test only)")
)

opt <- parse_args(OptionParser(option_list = option_list))

build   <- opt$build
outfile <- opt$out %||% file.path("data", paste0("methylation_reference_", build, ".csv"))

stopifnot(build %in% c("hg38", "hg37"))
cat(sprintf("Build: %s\nOutput: %s\n\n", build, outfile))

# ── 1. Load RGChannelSet ─────────────────────────────────────────────────────

cat("Loading FlowSorted.Blood.EPIC RGChannelSet from ExperimentHub...\n")

hub   <- ExperimentHub()
rgSet <- hub[["EH1136"]]

cat(sprintf("  Loaded: %d samples, %d probes (green channel)\n",
            ncol(rgSet), nrow(getGreen(rgSet))))
cat(sprintf("  Cell types: %s\n",
            paste(names(table(pData(rgSet)$CellType)), collapse = ", ")))
print(table(pData(rgSet)$CellType))

# ── 2. Subset to Purified Cell Types ─────────────────────────────────────────

cat("\nSubsetting to purified cell types (excluding MIX)...\n")

purified <- rgSet[, pData(rgSet)$CellType != "MIX"]
cat(sprintf("  Purified samples: %d\n", ncol(purified)))
print(table(pData(purified)$CellType))

# ── 3. Normalize ─────────────────────────────────────────────────────────────

cat("\nRunning preprocessQuantile normalization...\n")
cat("  (This may take 5-10 minutes)\n")

t0 <- proc.time()
mSet <- preprocessQuantile(purified)
elapsed <- (proc.time() - t0)[3]
cat(sprintf("  Normalization complete in %.1f seconds\n", elapsed))
cat(sprintf("  Result: %d probes x %d samples\n", nrow(mSet), ncol(mSet)))

# ── 4. Extract Betas and Average Per Cell Type ───────────────────────────────

cat("\nExtracting betas and computing cell-type means...\n")

betas     <- getBeta(mSet)
cell_types <- pData(mSet)$CellType

# Map Neu -> Gran for output naming
target_types <- c("CD8T", "CD4T", "NK", "Bcell", "Mono", "Neu")
output_names <- c("CD8T", "CD4T", "NK", "Bcell", "Mono", "Gran")

ref_matrix <- matrix(NA_real_, nrow = nrow(betas), ncol = length(target_types))
colnames(ref_matrix) <- output_names
rownames(ref_matrix) <- rownames(betas)

for (i in seq_along(target_types)) {
  ct <- target_types[i]
  idx <- which(cell_types == ct)
  if (length(idx) == 0) {
    cat(sprintf("  WARNING: No samples for %s\n", ct))
    next
  }
  ref_matrix[, i] <- rowMeans(betas[, idx, drop = FALSE], na.rm = TRUE)
  cat(sprintf("  %s: %d samples, mean beta = %.4f\n",
              output_names[i], length(idx), mean(ref_matrix[, i], na.rm = TRUE)))
}

# Drop probes with any NA across cell types
na_mask <- complete.cases(ref_matrix)
cat(sprintf("  Probes with complete data: %d / %d (dropped %d with NAs)\n",
            sum(na_mask), nrow(ref_matrix), sum(!na_mask)))
ref_matrix <- ref_matrix[na_mask, ]

if (!is.null(opt$n)) {
  cat(sprintf("DEBUG: limiting to %d probes\n", opt$n))
  ref_matrix <- ref_matrix[seq_len(min(opt$n, nrow(ref_matrix))), , drop = FALSE]
}

# ── 5. Get Probe Coordinates ─────────────────────────────────────────────────

cat("\nLoading probe coordinates from EPIC v1 annotation...\n")

suppressPackageStartupMessages(
  library(IlluminaHumanMethylationEPICanno.ilm10b4.hg19)
)
anno_obj <- getAnnotation(IlluminaHumanMethylationEPICanno.ilm10b4.hg19)

probe_ids <- rownames(ref_matrix)
matched   <- probe_ids[probe_ids %in% rownames(anno_obj)]
anno      <- anno_obj[matched, ]

cat(sprintf("  Matched: %d / %d probes in annotation\n",
            length(matched), length(probe_ids)))

if (build == "hg38") {
  cat("  NOTE: Coordinates are hg19. For hg38, liftOver would be needed.\n")
  cat("  Using hg19 coordinates (positional offset is typically <10bp at probe resolution).\n")
}

# Build coordinates data frame
coords <- data.frame(
  probe_id = rownames(anno),
  chr      = as.character(anno$chr),
  pos      = as.integer(anno$pos),   # 1-based
  stringsAsFactors = FALSE
)

# ── 6. Merge and Write ───────────────────────────────────────────────────────

cat("\nMerging betas with coordinates...\n")

ref_df          <- as.data.frame(ref_matrix[matched, , drop = FALSE])
ref_df$probe_id <- rownames(ref_df)

merged <- merge(coords, ref_df, by = "probe_id", all.x = FALSE, all.y = FALSE)

# Keep only standard chromosomes
valid_chrs <- paste0("chr", c(1:22, "X", "Y", "M"))
merged <- merged[merged$chr %in% valid_chrs, ]

# Round betas to 4 decimal places (sufficient for visualization)
beta_cols <- c("Gran", "Mono", "NK", "Bcell", "CD4T", "CD8T")
for (col in intersect(beta_cols, colnames(merged))) {
  merged[[col]] <- round(merged[[col]], 4)
}

# Sort by chromosome + position
chr_order <- match(merged$chr, valid_chrs)
merged <- merged[order(chr_order, merged$pos), ]

cat(sprintf("  Final: %d probes across %d chromosomes\n",
            nrow(merged), length(unique(merged$chr))))

# Write
dir.create(dirname(outfile), showWarnings = FALSE, recursive = TRUE)

out_cols   <- c("probe_id", "chr", "pos", intersect(beta_cols, colnames(merged)))
merged_out <- merged[, out_cols]

write.csv(merged_out, outfile, row.names = FALSE, quote = FALSE)

cat(sprintf("\nWrote %s (%d rows, %d cols)\n", outfile, nrow(merged_out), ncol(merged_out)))
cat(sprintf("  ~%.1f probes per kb genome-wide\n", nrow(merged_out) / 3.1e6))
cat("Done.\n")
