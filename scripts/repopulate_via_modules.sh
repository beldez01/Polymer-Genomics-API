#!/bin/bash
# Repopulate biophysics columns using the existing ingestion modules.
# Uses port 5433 proxy. Run in a terminal for stability.
#
# Usage:
#   cd /Users/zbb2/Desktop/PolymerGenomicsAPI
#   bash scripts/repopulate_via_modules.sh

set -euo pipefail

export POSTGRES_HOST=localhost
export POSTGRES_PORT=5433
export POSTGRES_DB=polymer_genomics_api
export POSTGRES_PASSWORD=4Nt2CNeHMncMjKv8WHPbo1w8w0ZupTdL
export POSTGRES_USER=polymer_genomics_api
export POSTGRES_USER_PASSWORD=4Nt2CNeHMncMjKv8WHPbo1w8w0ZupTdL
export POSTGRES_ADMIN_USER=polymer_genomics_api

PE=~/Desktop/Polymer_Evolution

run() {
    echo ""
    echo ">>> $1"
    shift
    if "$@" 2>&1 | tail -5; then
        echo "  ✓ done"
    else
        echo "  ✗ FAILED (continuing)"
    fi
}

echo "============================================"
echo " Repopulating biophysics columns"
echo " Proxy: localhost:5433"
echo "============================================"

# These use BigWig staging + UPDATE JOIN — may fail on proxy timeout
# If they fail, we need the chunked approach

run "shape_bulk (8 DNAshape cols)" \
    uv run python -m polymer_genomics.ingest.shape_bulk \
    --data-dir "$PE/phase1/output/window_1000" --build hg38

run "greens_function (4 cols)" \
    uv run python -m polymer_genomics.ingest.greens_function \
    --data-dir "$PE/phase3_5/output/window_1000" --build hg38

# FASTA-based (compute locally, update DB)
run "melting_domains (3 cols)" \
    uv run python -m polymer_genomics.ingest.melting_domains \
    --fasta data/hg38.fa --build hg38

run "sbs_bulk_update (4 SBS cols)" \
    uv run python -m polymer_genomics.ingest.sbs_bulk_update \
    --fasta data/hg38.fa --build hg38

# BED-based
run "replication_timing (2 cols)" \
    uv run python -m polymer_genomics.ingest.replication_timing --build hg38

# DB-derived (no external files)
run "gene_density (3 cols)" \
    uv run python -m polymer_genomics.ingest.gene_density --build hg38

run "te_fractions (6 cols)" \
    uv run python -m polymer_genomics.ingest.te_fractions --build hg38

run "derived_densities (ccre, histone, chromhmm)" \
    uv run python -m polymer_genomics.ingest.derived_densities --build hg38

run "palsson_recombination" \
    uv run python -m polymer_genomics.ingest.palsson_recombination --build hg38

echo ""
echo "============================================"
echo " DONE"
echo " Missing: phylop, phastcons, b_score (need 9GB download)"
echo "============================================"
