# ATAC accessibility (Corces 2016 GSE74912 + Calderon 2019 GSE118189)
# -> cCRE-summarized, pooled to the 12 canonical buckets -> SE.
#
# GENOME BUILD: both peak matrices are hg19/GRCh37 (peaks start ~chr1:10025,
# classic hg19 telomeric peak coords). Our cCREs are hg38, so every peak set is
# lifted hg19 -> hg38 with rtracklayer::liftOver (UCSC hg19ToHg38 chain) BEFORE
# summarizing over cCREs. Peaks that do not lift 1:1 (drop or split) are removed.
#
# Corces gives the sorted hematopoietic HIERARCHY (hsc/mpp/cmp/gmp/clp + some
# mature). Calderon gives sorted MATURE immune cells (RESTING / "-U" only).
# Buckets present in both sources (e.g. monocyte, cd4_t, cd8_t, b_cell, nk)
# pool across both sources in the final mean.
#
# Re-runnable: sources R/*.R, reads raw/atac/, writes output/se/atac.rds + .json.

for (f in list.files("R", pattern = "\\.R$", full.names = TRUE)) source(f)
suppressPackageStartupMessages({
  library(GenomicRanges)
  library(IRanges)
  library(data.table)
  library(rtracklayer)
  library(jsonlite)
})

dir.create("output/se", recursive = TRUE, showWarnings = FALSE)

ccres <- readRDS("output/ccres_hg38.rds")

# ---- liftOver chain (hg19 -> hg38) ---------------------------------------
CHAIN_GZ <- "raw/atac/hg19ToHg38.over.chain.gz"
CHAIN    <- "raw/atac/hg19ToHg38.over.chain"
if (!file.exists(CHAIN)) {
  if (!file.exists(CHAIN_GZ)) {
    options(timeout = 600)
    download.file(
      "http://hgdownload.soe.ucsc.edu/goldenPath/hg19/liftOver/hg19ToHg38.over.chain.gz",
      CHAIN_GZ, mode = "wb", quiet = TRUE)
  }
  R.utils::gunzip(CHAIN_GZ, destname = CHAIN, remove = FALSE, overwrite = TRUE)
}
chain <- rtracklayer::import.chain(CHAIN)
cat("liftOver chain loaded (hg19 -> hg38):", length(chain), "seqs\n")

# Cap donors per (source, bucket) to bound memory / balance pooling.
MAX_DONORS_PER_BUCKET <- 4L

# ---- liftOver helper: hg19 GRanges of peaks -> hg38, keeping 1:1 lifts ----
# Returns list(gr = hg38 GRanges, keep = logical index into the input peaks).
lift_peaks <- function(gr_hg19) {
  lifted <- rtracklayer::liftOver(gr_hg19, chain)   # GRangesList, one per input peak
  n1 <- S4Vectors::elementNROWS(lifted) == 1L       # keep only 1:1 lifts
  gr_hg38 <- unlist(lifted[n1])
  list(gr = gr_hg38, keep = n1)
}

# ==========================================================================
# SOURCE 1: Corces 2016 (GSE74912) -- sorted hematopoietic hierarchy
# ==========================================================================
# Column -> bucket mapping operates on the DESCRIPTIVE "DonorXXXX-CellType-..."
# columns (cell type is explicit). The numeric "NNNN-NA" columns and the
# SU***/BM-CD34/CB*-CD34 columns (AML / bulk CD34) are dropped.
corces_bucket <- function(col) {
  # token after the first "Donor####-"
  m <- regmatches(col, regexec("^Donor[0-9]+-([A-Za-z0-9]+)-", col))[[1]]
  if (length(m) < 2) return(NA_character_)
  ct <- m[2]
  switch(ct,
    HSC      = "hsc",
    MPP      = "mpp",
    CMP      = "cmp",
    GMP      = "gmp",
    CLP      = "clp",
    Mono     = "monocyte",
    Monocyte = "monocyte",
    CD4      = "cd4_t",
    CD8      = "cd8_t",
    Bcell    = "b_cell",
    NK       = "nk",
    Nkcell   = "nk",
    NA_character_)   # Erythroblast, MEP, Leuk, LSC, pHSC, etc. -> drop
}

build_corces <- function() {
  path <- "raw/atac/GSE74912/GSE74912_ATACseq_All_Counts.txt.gz"
  hdr  <- strsplit(readLines(gzfile(path), n = 1), "\t")[[1]]
  samp <- hdr[4:length(hdr)]
  bk   <- vapply(samp, corces_bucket, character(1))
  keep <- !is.na(bk)
  sel  <- data.frame(col = samp[keep], bucket = bk[keep], stringsAsFactors = FALSE)

  # cap donors per bucket (deterministic: first N)
  sel <- do.call(rbind, lapply(split(sel, sel$bucket), function(d)
    head(d, MAX_DONORS_PER_BUCKET)))
  cat(sprintf("Corces: keeping %d sample columns across %d buckets\n",
              nrow(sel), length(unique(sel$bucket))))

  dropped <- setdiff(samp, sel$col)
  attr(sel, "dropped") <- dropped

  dt <- data.table::fread(
    cmd = paste("gzip -dc", shQuote(path)),
    select = c("Chr", "Start", "End", sel$col))
  # BED-like (0-based start in the matrix); +1 for 1-based GRanges.
  gr19 <- GenomicRanges::GRanges(dt$Chr,
            IRanges::IRanges(dt$Start + 1L, dt$End))
  lf <- lift_peaks(gr19)
  cat(sprintf("Corces: %d peaks, %d lifted 1:1 to hg38 (%.1f%%)\n",
              length(gr19), length(lf$gr), 100 * length(lf$gr) / length(gr19)))

  list(dt = dt[lf$keep], gr = lf$gr, sel = sel)
}

# ==========================================================================
# SOURCE 2: Calderon 2019 (GSE118189) -- sorted MATURE immune, RESTING only
# ==========================================================================
# Columns are "Donor-CellType-U|S"; keep ONLY "-U" (unstimulated). Peak id is
# the rowname "chr_start_end".
calderon_bucket <- function(ct) {
  if (ct %in% c("Bulk_B", "Naive_B", "Mem_B")) return("b_cell")
  if (ct %in% c("Monocytes")) return("monocyte")
  if (grepl("NK$", ct) || grepl("_NK$", ct)) return("nk")   # Immature/Mature/Memory_NK
  if (grepl("CD8", ct)) return("cd8_t")                     # CD8pos_T, Naive_CD8_T, *_CD8pos_T
  # CD4 / helper / regulatory lineages -> cd4_t
  if (ct %in% c("Effector_CD4pos_T", "Follicular_T_Helper", "Memory_Teffs",
                "Memory_Tregs", "Naive_Teffs", "Naive_Tregs", "Regulatory_T",
                "Th1_precursors", "Th17_precursors", "Th2_precursors")) return("cd4_t")
  NA_character_   # Gamma_delta_T, Myeloid_DCs, pDCs, Plasmablasts -> drop
}

build_calderon <- function() {
  path <- "raw/atac/GSE118189/GSE118189_ATAC_counts.txt.gz"
  hdr  <- strsplit(readLines(gzfile(path), n = 1), "\t")[[1]]   # 175 sample names, no id col header
  parts <- strsplit(hdr, "-")
  stim  <- vapply(parts, function(x) x[length(x)], character(1))
  ct    <- vapply(parts, function(x) paste(x[2:(length(x) - 1)], collapse = "-"), character(1))
  bk    <- vapply(ct, calderon_bucket, character(1))
  keep  <- stim == "U" & !is.na(bk)                            # RESTING only
  sel   <- data.frame(col = hdr[keep], bucket = bk[keep], stringsAsFactors = FALSE)

  sel <- do.call(rbind, lapply(split(sel, sel$bucket), function(d)
    head(d, MAX_DONORS_PER_BUCKET)))
  cat(sprintf("Calderon: keeping %d unstimulated sample columns across %d buckets\n",
              nrow(sel), length(unique(sel$bucket))))

  dropped <- setdiff(hdr, sel$col)
  attr(sel, "dropped") <- dropped

  # Data rows have one extra leading field (the peak id) vs the header line
  # (header lists 175 sample names; rows have 176 fields). Read headerless,
  # skip the header line, then assign: col1 = peak id, cols 2..176 = `hdr`.
  dt <- data.table::fread(cmd = paste("gzip -dc", shQuote(path)),
                          header = FALSE, skip = 1L)
  stopifnot(ncol(dt) == length(hdr) + 1L)
  data.table::setnames(dt, c("peak_id", hdr))
  pid <- dt[["peak_id"]]
  coords <- tstrsplit(pid, "_", fixed = TRUE)
  gr19 <- GenomicRanges::GRanges(coords[[1]],
            IRanges::IRanges(as.integer(coords[[2]]) + 1L, as.integer(coords[[3]])))
  lf <- lift_peaks(gr19)
  cat(sprintf("Calderon: %d peaks, %d lifted 1:1 to hg38 (%.1f%%)\n",
              length(gr19), length(lf$gr), 100 * length(lf$gr) / length(gr19)))

  keepcols <- dt[lf$keep, sel$col, with = FALSE]
  list(dt = keepcols, gr = lf$gr, sel = sel)
}

# ---- summarize one source's selected columns over cCREs -------------------
# src: list(dt = data.table of count cols only-or-with-coords, gr = hg38 peaks, sel)
# coord_cols: names to exclude when iterating sample columns.
summarize_source <- function(src, tag, coord_cols = character()) {
  gr <- src$gr
  sel <- src$sel
  vecs <- list(); bk <- character(); cn <- character()
  for (i in seq_len(nrow(sel))) {
    col <- sel$col[i]
    sg <- gr
    S4Vectors::mcols(sg)$score <- as.numeric(src$dt[[col]])
    v <- summarize_over_ccres(sg, ccres, agg = "mean")
    vecs[[length(vecs) + 1]] <- v
    bk <- c(bk, sel$bucket[i])
    cn <- c(cn, paste0(tag, "_", make.names(col)))
    cat(sprintf("  [%s] %s <- %s\n", tag, sel$bucket[i], col))
  }
  mat <- do.call(cbind, vecs)
  rownames(mat) <- names(ccres)
  colnames(mat) <- cn
  list(mat = mat, groups = setNames(bk, cn))
}

# ==========================================================================
# RUN
# ==========================================================================
corces   <- build_corces()
calderon <- build_calderon()

cat("\n--- Corces column -> bucket ---\n");   print(corces$sel[order(corces$sel$bucket), ], row.names = FALSE)
cat("\n--- Calderon column -> bucket ---\n"); print(calderon$sel[order(calderon$sel$bucket), ], row.names = FALSE)

cat("\nSummarizing Corces over cCREs...\n")
s_corces   <- summarize_source(corces,   "corces")
cat("Summarizing Calderon over cCREs...\n")
s_calderon <- summarize_source(calderon, "calderon")

# Combine donor matrices (shared cCRE rownames) and groups, then aggregate.
mat    <- cbind(s_corces$mat, s_calderon$mat)
groups <- c(s_corces$groups, s_calderon$groups)
stopifnot(identical(rownames(s_corces$mat), rownames(s_calderon$mat)))

agg <- aggregate_region(mat, groups, fun = "mean")
se  <- build_region_se(agg, ccres, assay_name = "atac_signal")

saveRDS(se, "output/se/atac.rds")
jsonlite::write_json(
  se_contract(se, "atacseq", "Corces2016+Calderon2019"),
  "output/se/atac.se.json",
  auto_unbox = TRUE, pretty = TRUE)

cat(sprintf("\natac SE: %d features x %d cells (%s)\n",
            nrow(se), ncol(se), paste(colnames(se), collapse = ", ")))
cat(sprintf("nonzero frac: %.4f\n", mean(SummarizedExperiment::assay(se) > 0, na.rm = TRUE)))
