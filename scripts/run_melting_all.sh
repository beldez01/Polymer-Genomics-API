#!/bin/bash
# Run melting domain ingestion chromosome by chromosome
# Each chromosome is a separate python invocation to avoid timeouts

set -e
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
export PYTHONPATH=src:$PYTHONPATH

CHROMS="chr1 chr2 chr3 chr4 chr5 chr6 chr7 chr8 chr9 chr10 chr11 chr12 chr13 chr14 chr15 chr16 chr17 chr18 chr19 chr20 chr21 chrX chrY"
TOTAL=0

for CHR in $CHROMS; do
    echo "=== Starting $CHR at $(date) ==="
    uv run python -m polymer_genomics.ingest.melting_domains \
        --fasta data/hg38.fa \
        --db polymer_genomics \
        --chr "$CHR"
    echo "=== Finished $CHR at $(date) ==="
    echo ""
done

echo "All chromosomes complete!"
