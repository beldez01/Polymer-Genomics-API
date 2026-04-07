#!/bin/bash
# Repopulate the 69 NULL biophysics columns after the base-row reinsert.
#
# Run this in a terminal (not through Claude) for reliable proxy connections:
#   cd /Users/zbb2/Desktop/PolymerGenomicsAPI
#   bash scripts/repopulate_biophysics_columns.sh
#
# Prerequisites:
#   - fly proxy 15432:5432 -a polymer-db  (must be running)
#   - ~/Desktop/Polymer_Evolution/ BigWig files (phases 1, 2, 3.5)
#   - data/replication/*.bed files
#   - data/hg38.fa

set -e

export POSTGRES_HOST=localhost
export POSTGRES_PORT=15432
export POSTGRES_DB=polymer_genomics_api
export POSTGRES_PASSWORD=4Nt2CNeHMncMjKv8WHPbo1w8w0ZupTdL
export POSTGRES_USER=polymer_genomics_api
export POSTGRES_USER_PASSWORD=4Nt2CNeHMncMjKv8WHPbo1w8w0ZupTdL
export POSTGRES_ADMIN_USER=polymer_genomics_api

PE=~/Desktop/Polymer_Evolution
P1="$PE/phase1/output/window_1000"
P2="$PE/phase2/output/window_1000"
P35="$PE/phase3_5/output/window_1000"

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

run() {
    local name=$1
    shift
    echo -e "\n${BOLD}>>> $name${NC}"
    if "$@"; then
        echo -e "${GREEN}  ✓ $name complete${NC}"
    else
        echo -e "${RED}  ✗ $name FAILED${NC}"
    fi
}

echo "============================================"
echo " Repopulating 69 biophysics columns (hg38)"
echo " Source: Polymer Evolution Phases 1/2/3.5"
echo "============================================"

# Phase 1: DNAshape + extended
run "shape_bulk (8 cols: mgw, prot, roll, helt + deltas)" \
    uv run python -m polymer_genomics.ingest.shape_bulk --data-dir "$P1" --build hg38

run "extended_biophysics (6 cols: deformability, g4, kmer, entropy, period)" \
    uv run python -m polymer_genomics.ingest.extended_biophysics --data-dir "$P1" --build hg38

# Phase 2: Methylation perturbation + CpG
run "methylation_perturbation (10 cols: cpg, meth_delta, sensitivity, capacity)" \
    uv run python -m polymer_genomics.ingest.methylation_perturbation --data-dir "$P2" --build hg38

# Phase 3.5: Green's function
run "greens_function (4 cols: correlation, response, reach, asymmetry)" \
    uv run python -m polymer_genomics.ingest.greens_function --data-dir "$P35" --build hg38

# FASTA-based computations
run "melting_domains (3 cols: cooperativity, bubble, width)" \
    uv run python -m polymer_genomics.ingest.melting_domains --fasta data/hg38.fa --build hg38

run "sbs_bulk_update (4 cols: SBS ddG per mutation type)" \
    uv run python -m polymer_genomics.ingest.sbs_bulk_update --fasta data/hg38.fa --build hg38

# Replication timing (BED files, still on disk)
run "replication_timing (2 cols: repli_gm12878, repli_k562)" \
    uv run python -m polymer_genomics.ingest.replication_timing --build hg38

# DB-derived (no external files needed)
run "gene_density (3 cols: density, bp_fraction, median_tpm)" \
    uv run python -m polymer_genomics.ingest.gene_density --build hg38

run "te_fractions (6 cols: LINE, SINE, LTR, DNA, simple, total)" \
    uv run python -m polymer_genomics.ingest.te_fractions --build hg38

run "derived_densities (2 cols: ccre_density, histone marks)" \
    uv run python -m polymer_genomics.ingest.derived_densities --build hg38

run "fragility_composite" \
    uv run python -m polymer_genomics.ingest.fragility_composite --build hg38

# Recombination (loaded from DB, just needs UPDATE)
run "recombination columns" \
    uv run python -m polymer_genomics.ingest.palsson_recombination --build hg38 2>/dev/null || echo "  (may need --data-dir)"

echo ""
echo "============================================"
echo " DONE. Check with:"
echo "   psql \"postgres://polymer_genomics_api:...@localhost:15432/polymer_genomics_api\" \\"
echo "     -c \"SELECT deformability, mgw_mean, cpg_count FROM biophysics.sequence_properties WHERE build='hg38' LIMIT 1;\""
echo ""
echo " MISSING (needs 9GB re-download):"
echo "   - phylop_241way_mean, phastcons_241way_mean (zoonomia_conservation)"
echo "   - b_score_mean (b_scores)"
echo "============================================"
