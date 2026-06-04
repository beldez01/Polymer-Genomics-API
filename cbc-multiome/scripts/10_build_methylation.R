# WGBS methylation (Loyfer 2023, local CpG beds) -> cCRE-summarized, pooled to cell types -> SE.
for (f in list.files("R", pattern="\\.R$", full.names=TRUE)) source(f)
suppressPackageStartupMessages({ library(GenomicRanges); library(data.table); library(jsonlite) })
dir.create("output/se", recursive = TRUE, showWarnings = FALSE)

ccres <- readRDS("output/ccres_hg38.rds")
cw    <- load_crosswalk("data/crosswalk.tsv")

bed_dir <- "../data/wgbs/loyfer_2023/bed_hg38"
files <- list.files(bed_dir, pattern = "\\.hg38\\.bed\\.gz$", full.names = TRUE)
label_of <- function(fp) sub("-Z[0-9A-Za-z]+$", "",
                    sub("^GSM[0-9]+_", "", sub("\\.hg38\\.bed\\.gz$", "", basename(fp))))
labels  <- vapply(files, label_of, character(1), USE.NAMES = FALSE)
buckets <- map_to_bucket(labels, cw)
keep <- !is.na(buckets)
files <- files[keep]; buckets <- buckets[keep]
stopifnot(length(files) > 0)
cat(sprintf("Loyfer: %d samples -> %d buckets: %s\n",
            length(files), length(unique(buckets)), paste(sort(unique(buckets)), collapse = ", ")))

summ_one <- function(fp) {
  dt <- data.table::fread(fp, skip = 1L, header = FALSE, select = 1:4,
                          col.names = c("chr", "start", "end", "beta"))
  gr <- GenomicRanges::GRanges(dt$chr,
          IRanges::IRanges(dt$start + 1L, dt$end), score = dt$beta)
  v <- summarize_over_ccres(gr, ccres, agg = "mean")
  rm(dt, gr); gc()
  v
}
mat <- vapply(seq_along(files), function(i) {
  cat("  [", i, "/", length(files), "] ", basename(files[i]), "\n", sep = "")
  summ_one(files[i])
}, numeric(length(ccres)))
colnames(mat) <- paste0("loyfer_", seq_along(files))
rownames(mat) <- names(ccres)
groups <- setNames(buckets, colnames(mat))

agg <- aggregate_region(mat, groups, fun = "mean")
se  <- build_region_se(agg, ccres, assay_name = "beta")
saveRDS(se, "output/se/methylation.rds")
jsonlite::write_json(se_contract(se, "methylation", "WGBS-Loyfer2023"),
                     "output/se/methylation.se.json", auto_unbox = TRUE, pretty = TRUE)
cat(sprintf("methylation SE: %d features x %d cells (%s)\n",
            nrow(se), ncol(se), paste(colnames(se), collapse = ", ")))
