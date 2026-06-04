for (f in list.files("R", pattern="\\.R$", full.names=TRUE)) source(f)
suppressPackageStartupMessages({ library(data.table); library(jsonlite) })
dir.create("output/se", recursive = TRUE, showWarnings = FALSE)
dir.create("raw/blueprint_rna", recursive = TRUE, showWarnings = FALSE)

manifest <- "../internal/InSilico/HLA experiment/data_staging/blueprint_immune_subset/subset_rna_gene_quant.tsv"
m <- data.table::fread(manifest, sep = "\t", quote = "")
setnames(m, c("V8","V20","V22"), c("CELL_TYPE","FILE_TYPE","URL"), skip_absent = TRUE)
# the manifest has named headers already; use the real column names:
ct_col  <- grep("CELL_TYPE", names(m), value=TRUE)[1]
ft_col  <- grep("FILE_TYPE", names(m), value=TRUE)[1]
url_col <- grep("^URL$",     names(m), value=TRUE)[1]
stopifnot(length(ct_col)==1, length(ft_col)==1, length(url_col)==1)
m <- m[grepl("GENE_QUANT", get(ft_col))]

cw <- load_crosswalk("data/crosswalk.tsv")
m[, bucket := map_to_bucket(get(ct_col), cw)]
m <- m[!is.na(bucket)]
# cap to <=4 donors per bucket (deterministic: first 4) to keep downloads bounded
m <- m[, head(.SD, 4), by = bucket]
cat(sprintf("RNA: %d files across %d buckets: %s\n",
            nrow(m), length(unique(m$bucket)), paste(sort(unique(m$bucket)), collapse=", ")))

# download (skip if present), load TPM
local_path <- function(url) file.path("raw/blueprint_rna", basename(url))
vecs <- list(); bk <- character()
for (i in seq_len(nrow(m))) {
  url <- m[[url_col]][i]; dest <- local_path(url)
  if (!file.exists(dest)) {
    ok <- tryCatch({ download.file(url, dest, mode="wb", quiet=TRUE); TRUE },
                   error = function(e) FALSE)
    if (!ok || !file.exists(dest) || file.size(dest) < 1000) { cat("  SKIP (download failed):", basename(url), "\n"); next }
  }
  v <- tryCatch(load_rna_tpm(dest), error=function(e) NULL)
  if (is.null(v)) { cat("  SKIP (parse failed):", basename(dest), "\n"); next }
  vecs[[length(vecs)+1]] <- v; bk <- c(bk, m$bucket[i])
  cat("  [", length(vecs), "] ", m$bucket[i], " <- ", basename(dest), "\n", sep="")
}
stopifnot(length(vecs) > 0)

genes <- sort(unique(unlist(lapply(vecs, names))))
mat <- vapply(vecs, function(v) v[genes], numeric(length(genes)))
rownames(mat) <- genes; colnames(mat) <- paste0("bp_", seq_along(vecs))
groups <- setNames(bk, colnames(mat))

agg <- aggregate_rna(mat, groups, fun = "median")
se  <- build_rna_se(agg, assay_name = "tpm")
saveRDS(se, "output/se/rnaseq.rds")
jsonlite::write_json(se_contract(se, "rnaseq", "BLUEPRINT-RSEM"),
                     "output/se/rnaseq.se.json", auto_unbox = TRUE, pretty = TRUE)
cat(sprintf("rnaseq SE: %d genes x %d cells (%s)\n",
            nrow(se), ncol(se), paste(colnames(se), collapse=", ")))
