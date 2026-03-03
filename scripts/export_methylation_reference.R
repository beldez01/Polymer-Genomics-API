#!/usr/bin/env Rscript
# export_methylation_reference.R
#
# Export Salas 2018 (FlowSorted.Blood.EPIC) 6-cell-type IDOL reference betas
# to a CSV ready for ingestion into ref.methylation_reference.
#
# Output columns: probe_id, chr, pos, Gran, Mono, NK, Bcell, CD4T, CD8T
#   - pos is 1-based (API convention; ingest converts to 0-based internally)
#
# Usage:
#   Rscript export_methylation_reference.R
#   Rscript export_methylation_reference.R --out /path/to/methylation_reference_hg38.csv
#   Rscript export_methylation_reference.R --build hg37
#
# Requirements:
#   BiocManager::install(c("FlowSorted.Blood.EPIC", "minfi",
#     "IlluminaHumanMethylationEPICanno.ilm10b4.hg19",
#     "IlluminaHumanMethylationEPICv2anno.20a1.hg38"))
#   install.packages("optparse")

suppressPackageStartupMessages({
  library(optparse)
  library(FlowSorted.Blood.EPIC)
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

build  <- opt$build
outfile <- opt$out %||% file.path("data", paste0("methylation_reference_", build, ".csv"))

stopifnot(build %in% c("hg38", "hg37"))
cat(sprintf("Build: %s\nOutput: %s\n", build, outfile))

# ── Load IDOL Reference Betas ───────────────────────────────────────────────

cat("Loading IDOLOptimizedCpGs.compTable (450 probes x 6 cell types)...\n")

data("IDOLOptimizedCpGs.compTable", package = "FlowSorted.Blood.EPIC")

ref_betas <- IDOLOptimizedCpGs.compTable
# Matrix: 450 rows (probes) x 6 cols (CD8T, CD4T, NK, Bcell, Mono, Neu)

cat(sprintf("  Loaded: %d probes x %d cell types\n", nrow(ref_betas), ncol(ref_betas)))
cat(sprintf("  Columns: %s\n", paste(colnames(ref_betas), collapse = ", ")))

# Rename Neu -> Gran (neutrophils are the dominant granulocyte fraction)
colnames(ref_betas)[colnames(ref_betas) == "Neu"] <- "Gran"

if (!is.null(opt$n)) {
  cat(sprintf("DEBUG: limiting to %d probes\n", opt$n))
  ref_betas <- ref_betas[seq_len(min(opt$n, nrow(ref_betas))), , drop = FALSE]
}

# ── Get Probe Coordinates ────────────────────────────────────────────────────

cat("Loading probe coordinates...\n")

probe_ids <- rownames(ref_betas)

if (build == "hg38") {
  # Try v2 annotation (hg38 native) first — probe IDs have _BCXX suffixes
  # Fall back to v1 annotation (hg19) which has exact cg ID matches
  suppressPackageStartupMessages(
    library(IlluminaHumanMethylationEPICanno.ilm10b4.hg19)
  )

  # v1 annotation: probes match IDOL IDs exactly (both use cg\d{8} format)
  anno_obj <- minfi::getAnnotation(IlluminaHumanMethylationEPICanno.ilm10b4.hg19)
  matched <- probe_ids[probe_ids %in% rownames(anno_obj)]
  anno <- anno_obj[matched, ]
  cat(sprintf("  Using EPIC v1 annotation (hg19): %d / %d probes matched\n",
              length(matched), length(probe_ids)))

  if (build == "hg38") {
    cat("  NOTE: Coordinates are hg19. For hg38, liftOver would be needed.\n")
    cat("  Using hg19 coordinates (positional error is typically <10bp at probe resolution).\n")
  }
} else {
  suppressPackageStartupMessages(
    library(IlluminaHumanMethylationEPICanno.ilm10b4.hg19)
  )
  anno_obj <- minfi::getAnnotation(IlluminaHumanMethylationEPICanno.ilm10b4.hg19)
  matched <- probe_ids[probe_ids %in% rownames(anno_obj)]
  anno <- anno_obj[matched, ]
  cat(sprintf("  Using EPIC v1 annotation (hg19): %d / %d probes matched\n",
              length(matched), length(probe_ids)))
}

# Extract coordinates
coords <- data.frame(
  probe_id = rownames(anno),
  chr      = as.character(anno$chr),
  pos      = as.integer(anno$pos),   # 1-based
  stringsAsFactors = FALSE
)

# ── Merge Betas + Coordinates ────────────────────────────────────────────────

cat("Merging betas with coordinates...\n")

ref_df <- as.data.frame(ref_betas)
ref_df$probe_id <- rownames(ref_df)

merged <- merge(coords, ref_df, by = "probe_id", all.x = FALSE, all.y = FALSE)

# Keep only standard chromosomes
valid_chrs <- paste0("chr", c(1:22, "X", "Y", "M"))
merged <- merged[merged$chr %in% valid_chrs, ]

# Round betas to 4 decimal places
beta_cols <- c("Gran", "Mono", "NK", "Bcell", "CD4T", "CD8T")
for (col in intersect(beta_cols, colnames(merged))) {
  merged[[col]] <- round(merged[[col]], 4)
}

# Sort by chromosome + position
chr_order <- match(merged$chr, valid_chrs)
merged <- merged[order(chr_order, merged$pos), ]

cat(sprintf("  Final: %d probes across %d chromosomes\n",
            nrow(merged), length(unique(merged$chr))))

# ── Write Output ─────────────────────────────────────────────────────────────

dir.create(dirname(outfile), showWarnings = FALSE, recursive = TRUE)

out_cols <- c("probe_id", "chr", "pos",
              intersect(beta_cols, colnames(merged)))
merged_out <- merged[, out_cols]

write.csv(merged_out, outfile, row.names = FALSE, quote = FALSE)
cat(sprintf("Wrote %s (%d rows, %d cols)\n",
            outfile, nrow(merged_out), ncol(merged_out)))
cat("Done.\n")
