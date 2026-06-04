for (f in list.files("R", pattern="\\.R$", full.names=TRUE)) source(f)
suppressPackageStartupMessages({ library(MultiAssayExperiment); library(SummarizedExperiment) })
source("/Users/zbb2/Desktop/Polymer/R-Engine/R/analysis/mae_correlation.R")

mae  <- readRDS("output/cbc_multiome.rds")
meth <- SummarizedExperiment::assay(experiments(mae)[["methylation"]])
rna  <- SummarizedExperiment::assay(experiments(mae)[["rnaseq"]])
shared <- intersect(colnames(meth), colnames(rna))
cat("shared cells:", length(shared), "(", paste(shared, collapse=","), ")\n")
stopifnot(length(shared) >= 3)

# drop all-NA methylation features, then top-variable, to keep it fast/clean
meth <- meth[rowSums(is.na(meth[, shared, drop=FALSE])) == 0, , drop=FALSE]
m1 <- select_top_variable_features(meth[, shared, drop=FALSE], 200)
m2 <- select_top_variable_features(rna[,  shared, drop=FALSE], 200)
res <- compute_cross_assay_correlation(m1, m2, shared, method = "spearman")
cat(sprintf("cross-assay correlation ran on %d cells; cor matrix %d x %d\n",
            length(shared), nrow(res$correlation), ncol(res$correlation)))
