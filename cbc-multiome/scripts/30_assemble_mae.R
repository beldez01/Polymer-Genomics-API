for (f in list.files("R", pattern="\\.R$", full.names=TRUE)) source(f)
suppressPackageStartupMessages({ library(MultiAssayExperiment); library(jsonlite) })

se_files <- list.files("output/se", pattern = "\\.rds$", full.names = TRUE)
stopifnot(length(se_files) > 0)
experiments <- setNames(lapply(se_files, readRDS), sub("\\.rds$", "", basename(se_files)))
cell_meta <- read.delim("data/canonical_cells.tsv", stringsAsFactors = FALSE)

mae <- build_cbc_mae(experiments, cell_meta = cell_meta)
saveRDS(mae, "output/cbc_multiome.rds")
write_mae_contract(mae, "output/cbc_multiome.mae.json", cell_meta = cell_meta)

cat("MAE assembled.\n"); print(mae)
h <- compute_mae_dimnames_hash(mae)
cat("dimnames hash:", h, "\n")
ct <- jsonlite::read_json("output/cbc_multiome.mae.json")
stopifnot(identical(ct$dimnames_hash, h))
cat("contract hash verified\n")
