# MAE + hematopoiesis graph -> landscape-viewer/public/landscape.json
`%||%` <- function(a,b) if (is.null(a)) b else a
for (f in list.files("R", pattern="\\.R$", full.names=TRUE)) source(f)
suppressPackageStartupMessages({ library(MultiAssayExperiment); library(SummarizedExperiment); library(GenomicRanges); library(jsonlite) })

mae   <- readRDS("output/cbc_multiome.rds")
ccres <- readRDS("output/ccres_hg38.rds")
graph <- jsonlite::read_json("map/hematopoiesis_graph.json", simplifyVector = TRUE)
nodes_df <- graph$nodes; edges_df <- graph$edges
dataNodes <- nodes_df$id[nodes_df$data_backed]

lay <- node_layout(data.frame(id=dataNodes, stringsAsFactors=FALSE),
                   edges_df[edges_df$model=="data-backed",], root="hsc")

rna <- assay(experiments(mae)[["rnaseq"]])
ent <- sapply(dataNodes, function(n) if (n %in% colnames(rna)) shannon_entropy(rna[,n]) else NA_real_)
elev <- (ent - min(ent,na.rm=TRUE)) / (diff(range(ent,na.rm=TRUE)))

getA <- function(nm) if (nm %in% names(experiments(mae))) assay(experiments(mae)[[nm]]) else NULL
meth <- getA("methylation"); atac <- getA("atac")
atacZ <- if (!is.null(atac)) { z <- t(scale(t(atac))); z[!is.finite(z)] <- NA; z } else NULL
ccre_class <- as.character(ccres$ccre_class); names(ccre_class) <- names(ccres)

edge_json <- list(); de <- edges_df[edges_df$model=="data-backed",]
for (i in seq_len(nrow(de))) {
  a <- de$from[i]; b <- de$to[i]; layers <- list()
  for (L in c("methylation","atac")) {
    M <- if (L=="methylation") meth else atacZ
    if (is.null(M) || !(a %in% colnames(M)) || !(b %in% colnames(M))) next
    thr <- if (L=="methylation") 0.2 else 1.0
    va <- M[,a]; vb <- M[,b]; ok <- is.finite(va) & is.finite(vb)
    changed <- names(va)[ok & abs(va - vb) > thr]
    if (!length(changed)) { layers[[L]] <- list(n=0); next }
    chr <- as.character(seqnames(ccres[changed])); cls <- ccre_class[changed]
    d <- abs(va[changed] - vb[changed]); top <- head(order(d, decreasing=TRUE), 50)
    layers[[L]] <- list(
      n = length(changed),
      by_chrom = as.list(table(chr)),
      by_class = as.list(table(cls)),
      top = lapply(top, function(k) list(id=changed[k],
                   chr=as.character(seqnames(ccres[changed[k]])),
                   start=start(ccres[changed[k]]),
                   class=unname(cls[k]), delta=round(unname(d[k]),3))))
  }
  edge_json[[length(edge_json)+1]] <- list(from=a, to=b, branch_nature=de$branch_nature[i], layers=layers)
}

# elevation_alt: cumulative methylation change from HSC (HSC high, mature low)
meth_n <- setNames(rep(0, length(dataNodes)), dataNodes)
for (ej in edge_json) {
  mn <- if (!is.null(ej$layers$methylation)) ej$layers$methylation$n else 0
  meth_n[ej$to] <- meth_n[ej$from] + (mn %||% 0)
}
alt <- 1 - (meth_n - min(meth_n)) / (max(meth_n) - min(meth_n) + 1e-9)

node_json <- lapply(dataNodes, function(n) list(
  id=n, label=nodes_df$label[nodes_df$id==n],
  compartment=nodes_df$compartment[nodes_df$id==n],
  lineage=nodes_df$lineage[nodes_df$id==n],
  modalities=nodes_df$modalities[nodes_df$id==n][[1]],
  x=unname(lay[n,"x"]), y=unname(lay[n,"y"]),
  elevation=unname(elev[n]), elevation_alt=unname(alt[n])))

dir.create("landscape-viewer/public", recursive=TRUE, showWarnings=FALSE)
jsonlite::write_json(list(
  meta=list(thresholds=list(methylation=0.2, atac_z=1.0),
            elevation="rna_transcriptional_entropy",
            elevation_alt="cumulative_methylation_change_from_hsc",
            generated_from="cbc_multiome.rds"),
  nodes=node_json, edges=edge_json),
  "landscape-viewer/public/landscape.json", auto_unbox=TRUE, pretty=TRUE)
cat("landscape.json written:", length(node_json), "nodes,", length(edge_json), "edges\n")
