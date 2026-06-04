# Stem/progenitor WGBS methylation (Farlik et al. 2016, Cell Stem Cell; GEO GSE87197)
# -> cCRE-summarized, pooled to progenitor buckets -> MERGED into the existing
# mature-cell methylation SE.
#
# MUST RUN AFTER scripts/10_build_methylation.R (which builds the 6 mature Loyfer
# cells). This script READS the current output/se/methylation.rds, computes the
# Farlik progenitor columns (hsc/mpp/clp/cmp/gmp), cbinds them onto the mature
# matrix, and OVERWRITES methylation.rds + methylation.se.json.
#
# GENOME BUILD: the GEO-processed Farlik per-sample files are ALREADY hg38
# (verified: chr22 has CpGs <16 Mb and chr21 starts ~5.0 Mb -- both impossible
# in hg19, whose p-arms are all-N there; chrY max 56.9 Mb < hg38 57.23 Mb).
# Therefore NO liftOver is needed. (Farlik's primary processing was hg19; the
# GEO supplementary files distributed here are the hg38-mapped versions.)
#
# FILE FORMAT: 4-column, no header, per single CpG:
#   chr   pos(1-based)   methylated_count   total_count
# beta = methylated_count / total_count in [0,1]. Coverage is sparse (low-input
# WGBS): most CpGs have total_count == 1. We summarize per-CpG beta over each
# cCRE by mean (summarize_over_ccres), matching the mature-cell pipeline.
#
# SAMPLE SELECTION: 1000-cell samples only (best coverage), capped at <=4 donors
# per bucket. Cell-type -> bucket via data/crosswalk.tsv:
#   HSC->hsc, MPP->mpp, CLP/MLP0-3->clp (MLP = multilymphoid progenitor,
#   approximated to common lymphoid progenitor), CMP->cmp, GMP->gmp.
#   MEP, MK and the mature types (already covered by Loyfer) are dropped.
#
# Re-runnable: sources R/*.R, reads raw/farlik/samples/, reads + overwrites
# output/se/methylation.rds + .json.

for (f in list.files("R", pattern = "\\.R$", full.names = TRUE)) source(f)
suppressPackageStartupMessages({
  library(GenomicRanges)
  library(IRanges)
  library(data.table)
  library(SummarizedExperiment)
  library(jsonlite)
})

ccres <- readRDS("output/ccres_hg38.rds")
cw    <- load_crosswalk("data/crosswalk.tsv")

MAX_DONORS_PER_BUCKET <- 4L
SAMPLE_DIR <- "raw/farlik/samples"

# --------------------------------------------------------------------------
# Resolve sample files -> (cell type label) -> bucket.
# The downloaded filenames are "GSM<id>_<title>.txt.gz"; the cell-type token is
# the first underscore-field of <title> (e.g. HSC, HSCbm, HSCfl, MPP, MPPbm,
# CLP, MLP0..MLP3, CMP, GMP). We normalise the suffixes (bm/fl tissue tags) and
# split MLP0..3 numerals before crosswalk mapping.
# --------------------------------------------------------------------------
files <- list.files(SAMPLE_DIR, pattern = "\\.txt\\.gz$", full.names = TRUE)
stopifnot(length(files) > 0)

celltype_of <- function(fp) {
  title <- sub("\\.txt\\.gz$", "", sub("^GSM[0-9]+_", "", basename(fp)))
  tok   <- strsplit(title, "_", fixed = TRUE)[[1]][1]
  # strip tissue suffixes: HSCbm/HSCfl -> HSC, MPPbm -> MPP, etc.
  tok <- sub("(bm|fl)$", "", tok)
  tok
}
labels  <- vapply(files, celltype_of, character(1), USE.NAMES = FALSE)
buckets <- map_to_bucket(labels, cw)

keep <- !is.na(buckets)
if (any(!keep))
  cat("Dropping", sum(!keep), "unmapped sample(s):",
      paste(unique(labels[!keep]), collapse = ", "), "\n")
files <- files[keep]; labels <- labels[keep]; buckets <- buckets[keep]
stopifnot(length(files) > 0)

# cap donors per bucket (deterministic by filename)
ord <- order(buckets, basename(files))
files <- files[ord]; labels <- labels[ord]; buckets <- buckets[ord]
sel_idx <- unlist(lapply(split(seq_along(buckets), buckets),
                         function(ix) head(ix, MAX_DONORS_PER_BUCKET)))
files <- files[sel_idx]; labels <- labels[sel_idx]; buckets <- buckets[sel_idx]

cat(sprintf("Farlik: %d sample files across %d buckets: %s\n",
            length(files), length(unique(buckets)),
            paste(sort(unique(buckets)), collapse = ", ")))
print(data.frame(file = basename(files), label = labels, bucket = buckets),
      row.names = FALSE)

# --------------------------------------------------------------------------
# Summarize one sample: 4-col CpG file -> per-CpG beta GRanges -> per-cCRE mean.
# --------------------------------------------------------------------------
summ_one <- function(fp) {
  dt <- data.table::fread(fp, header = FALSE, select = 1:4,
                          col.names = c("chr", "pos", "meth", "total"))
  dt <- dt[is.finite(total) & total > 0]
  beta <- dt$meth / dt$total                      # 0..1 fraction
  gr <- GenomicRanges::GRanges(dt$chr,
          IRanges::IRanges(dt$pos, width = 1L), score = beta)
  v <- summarize_over_ccres(gr, ccres, agg = "mean")
  rm(dt, gr, beta); gc()
  v
}

mat <- vapply(seq_along(files), function(i) {
  cat(sprintf("  [%d/%d] %s (%s)\n", i, length(files),
              basename(files[i]), buckets[i]))
  summ_one(files[i])
}, numeric(length(ccres)))
colnames(mat) <- paste0("farlik_", seq_along(files))
rownames(mat) <- names(ccres)
groups <- setNames(buckets, colnames(mat))

prog <- aggregate_region(mat, groups, fun = "mean")   # cCRE x progenitor-bucket
cat(sprintf("Progenitor matrix: %d features x %d buckets (%s)\n",
            nrow(prog), ncol(prog), paste(colnames(prog), collapse = ", ")))

# --------------------------------------------------------------------------
# MERGE into existing mature methylation SE (do NOT lose the 6 Loyfer cells).
# --------------------------------------------------------------------------
se_mat_file <- "output/se/methylation.rds"
stopifnot(file.exists(se_mat_file))
se_old <- readRDS(se_mat_file)
old_mat <- SummarizedExperiment::assay(se_old, "beta")
cat(sprintf("Existing methylation SE: %d features x %d cells (%s)\n",
            nrow(old_mat), ncol(old_mat),
            paste(colnames(old_mat), collapse = ", ")))

# Reindex both matrices by names(ccres) to guarantee identical row order.
ref_rows <- names(ccres)
old_mat <- old_mat[ref_rows, , drop = FALSE]
prog     <- prog[ref_rows, , drop = FALSE]
stopifnot(identical(rownames(old_mat), rownames(prog)))

# Drop any progenitor bucket that somehow already exists in the mature set
# (none expected), then cbind.
dup <- intersect(colnames(prog), colnames(old_mat))
if (length(dup)) {
  cat("Note: dropping already-present columns from progenitor set:",
      paste(dup, collapse = ", "), "\n")
  prog <- prog[, setdiff(colnames(prog), dup), drop = FALSE]
}
combined <- cbind(old_mat, prog)
combined <- combined[ref_rows, , drop = FALSE]

se <- build_region_se(combined, ccres, assay_name = "beta")
saveRDS(se, se_mat_file)
jsonlite::write_json(
  se_contract(se, "methylation", "WGBS-Loyfer2023+Farlik2016"),
  "output/se/methylation.se.json", auto_unbox = TRUE, pretty = TRUE)

cat(sprintf("\nmerged methylation SE: %d features x %d cells (%s)\n",
            nrow(se), ncol(se), paste(colnames(se), collapse = ", ")))
cat(sprintf("beta range: [%.4f, %.4f]\n",
            min(SummarizedExperiment::assay(se), na.rm = TRUE),
            max(SummarizedExperiment::assay(se), na.rm = TRUE)))
for (cn in colnames(prog))
  cat(sprintf("  %s non-NA frac: %.4f\n", cn,
              mean(!is.na(SummarizedExperiment::assay(se)[, cn]))))
