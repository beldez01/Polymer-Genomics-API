suppressPackageStartupMessages({ library(MultiAssayExperiment); library(jsonlite) })
mae <- readRDS("output/cbc_multiome.rds")
cells <- rownames(MultiAssayExperiment::colData(mae))
exps  <- MultiAssayExperiment::experiments(mae)

rows <- list()
for (e in names(exps)) {
  present <- colnames(exps[[e]])
  cjson <- file.path("output/se", paste0(e, ".se.json"))
  src <- if (file.exists(cjson)) jsonlite::read_json(cjson)$platform else NA
  for (c in cells) {
    rows[[length(rows)+1]] <- data.frame(
      cell = c, experiment = e,
      covered = c %in% present,
      n_features = if (c %in% present) nrow(exps[[e]]) else 0L,
      source = if (is.null(src)) NA else src,
      stringsAsFactors = FALSE)
  }
}
man <- do.call(rbind, rows)
write.table(man, "output/manifest.tsv", sep="\t", row.names=FALSE, quote=FALSE)
cat(sprintf("manifest: %d rows; overall coverage %.0f%%\n", nrow(man), 100*mean(man$covered)))
print(table(man$experiment, man$covered))
