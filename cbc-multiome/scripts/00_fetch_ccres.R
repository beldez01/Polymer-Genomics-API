# Download ENCODE SCREEN hg38 cCREs to raw/, save parsed GRanges to output/.
source("R/ccres.R")
dir.create("raw/ccre", recursive = TRUE, showWarnings = FALSE)
dir.create("output", showWarnings = FALSE)
url <- "https://downloads.wenglab.org/Registry-V4/GRCh38-cCREs.bed"
dest <- "raw/ccre/GRCh38-cCREs.bed"
if (!file.exists(dest)) download.file(url, dest, mode = "wb")
ccres <- load_ccres(dest)
saveRDS(ccres, "output/ccres_hg38.rds")
cat(sprintf("cCREs loaded: %d elements\n", length(ccres)))
