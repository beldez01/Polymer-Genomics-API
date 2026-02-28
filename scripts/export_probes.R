#!/usr/bin/env Rscript
# ──────────────────────────────────────────────────────────────────
# Export Illumina probe manifests from sesameData for Polymer ingestion
# ──────────────────────────────────────────────────────────────────
#
# Exports probe coordinates (not proprietary sequences) from sesameData
# for the three Illumina methylation platforms: 450k, EPIC v1, EPIC v2.
#
# Output: TSV files in data/ directory with columns:
#   probe_id, chr, pos, strand, platform, gene_symbol, cpg_context
#
# Prerequisites:
#   install.packages("BiocManager")
#   BiocManager::install(c("sesameData", "GenomicRanges"))
#
# Usage:
#   Rscript scripts/export_probes.R
#   Rscript scripts/export_probes.R --build hg38
#   Rscript scripts/export_probes.R --platforms 450k,epic_v1
#

suppressPackageStartupMessages({
  library(sesameData)
  library(GenomicRanges)
})

# ── Config ────────────────────────────────────────────────────────

args <- commandArgs(trailingOnly = TRUE)
build <- "hg38"
platforms <- c("HM450", "EPIC", "EPICv2")

for (i in seq_along(args)) {
  if (args[i] == "--build" && i < length(args)) {
    build <- args[i + 1]
  }
  if (args[i] == "--platforms" && i < length(args)) {
    mapping <- c("450k" = "HM450", "epic_v1" = "EPIC", "epic_v2" = "EPICv2")
    requested <- strsplit(args[i + 1], ",")[[1]]
    platforms <- unname(mapping[requested])
  }
}

genome <- if (build == "hg38") "hg38" else "hg19"
output_dir <- file.path("data", "probes")
dir.create(output_dir, showWarnings = FALSE, recursive = TRUE)

# ── Platform name mapping ────────────────────────────────────────

platform_names <- c(
  "HM450"  = "450k",
  "EPIC"   = "epic_v1",
  "EPICv2" = "epic_v2"
)

sesame_datasets <- c(
  "HM450"  = "HM450.hg38.manifest",
  "EPIC"   = "EPIC.hg38.manifest",
  "EPICv2" = "EPICv2.hg38.manifest"
)

if (build == "hg37") {
  sesame_datasets <- c(
    "HM450"  = "HM450.hg19.manifest",
    "EPIC"   = "EPIC.hg19.manifest",
    "EPICv2" = "EPICv2.hg19.manifest"
  )
}

# ── Export function ──────────────────────────────────────────────

export_platform <- function(platform_key) {
  platform_label <- platform_names[platform_key]
  dataset_name <- sesame_datasets[platform_key]

  cat(sprintf("\n━━━ %s (%s) ━━━\n", platform_label, dataset_name))
  cat("  Loading manifest...\n")

  manifest <- sesameData_getManifestGRanges(platform_key, genome = genome)

  cat(sprintf("  Total probes: %d\n", length(manifest)))

  # Extract coordinates — only derived/public data, no proprietary sequences
  df <- data.frame(
    probe_id    = names(manifest),
    chr         = as.character(seqnames(manifest)),
    pos         = start(manifest) - 1L,  # 0-based position (database convention)
    strand      = as.character(strand(manifest)),
    platform    = platform_label,
    stringsAsFactors = FALSE
  )

  # Add gene symbol and CpG context if available in mcols
  mc <- mcols(manifest)
  if ("gene" %in% colnames(mc)) {
    df$gene_symbol <- as.character(mc$gene)
  } else {
    df$gene_symbol <- NA_character_
  }

  # Map to our CpG context enum: island, n_shore, s_shore, n_shelf, s_shelf, open_sea
  if ("CpG_Relation" %in% colnames(mc)) {
    context_map <- c(
      "Island"  = "island",
      "N_Shore" = "n_shore",
      "S_Shore" = "s_shore",
      "N_Shelf" = "n_shelf",
      "S_Shelf" = "s_shelf",
      "OpenSea" = "open_sea"
    )
    raw_context <- as.character(mc$CpG_Relation)
    df$cpg_context <- context_map[raw_context]
    df$cpg_context[is.na(df$cpg_context)] <- "open_sea"
  } else {
    df$cpg_context <- NA_character_
  }

  # Filter to standard chromosomes only (chr1-22, chrX, chrY, chrM)
  valid_chr <- paste0("chr", c(1:22, "X", "Y", "M"))
  df <- df[df$chr %in% valid_chr, ]
  cat(sprintf("  After chr filter: %d probes\n", nrow(df)))

  # Sort by chr, pos for deterministic output
  chr_order <- setNames(seq_along(valid_chr), valid_chr)
  df <- df[order(chr_order[df$chr], df$pos), ]

  # Write TSV
  outfile <- file.path(output_dir, sprintf("%s_%s_probes.tsv", platform_label, build))
  write.table(df, outfile, sep = "\t", row.names = FALSE, quote = FALSE, na = "")
  cat(sprintf("  Written: %s (%d probes)\n", outfile, nrow(df)))

  return(nrow(df))
}

# ── Main ─────────────────────────────────────────────────────────

cat("╔═══════════════════════════════════════════════════════╗\n")
cat("║  Polymer Genomics — Probe Manifest Export            ║\n")
cat(sprintf("║  Build: %s                                          ║\n", build))
cat("╚═══════════════════════════════════════════════════════╝\n")

total <- 0
for (p in platforms) {
  tryCatch({
    n <- export_platform(p)
    total <- total + n
  }, error = function(e) {
    cat(sprintf("  ERROR exporting %s: %s\n", p, conditionMessage(e)))
    cat("  Try: sesameDataCache(sesameDataList())\n")
  })
}

# ── Merge into single file for ingestion ─────────────────────────
# The Python ingestion script expects: data/probe_manifest_{build}.csv

cat("\n  Merging platform files into combined manifest...\n")
platform_files <- list.files(output_dir, pattern = sprintf(".*_%s_probes\\.tsv$", build), full.names = TRUE)
if (length(platform_files) > 0) {
  combined <- do.call(rbind, lapply(platform_files, function(f) {
    read.table(f, header = TRUE, sep = "\t", stringsAsFactors = FALSE, na.strings = "")
  }))
  combined_file <- file.path("data", sprintf("probe_manifest_%s.csv", build))
  write.table(combined, combined_file, sep = "\t", row.names = FALSE, quote = FALSE, na = "")
  cat(sprintf("  Written: %s (%d probes)\n", combined_file, nrow(combined)))
}

cat(sprintf("\n✓ Done. Total probes exported: %d\n", total))
cat(sprintf("  Per-platform files in: %s/\n", output_dir))
cat(sprintf("  Combined manifest: data/probe_manifest_%s.csv\n", build))
