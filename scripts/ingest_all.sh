#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# Polymer Genomics — Full Ingestion Pipeline (56 modules, 9 tiers)
# ──────────────────────────────────────────────────────────────────
#
# Runs the complete data ingestion pipeline in dependency order.
# Assumes: Docker Compose is up (Postgres + MinIO running).
#
# Usage:
#   ./scripts/ingest_all.sh                    # full pipeline
#   ./scripts/ingest_all.sh --step 7           # resume from step 7
#   ./scripts/ingest_all.sh --tier 3           # run only tier 3
#   ./scripts/ingest_all.sh --module genes     # run single module
#   ./scripts/ingest_all.sh --dry-run          # print plan without running
#   ./scripts/ingest_all.sh --build hg37       # alternate build (default hg38)
#
# Flags can be combined:
#   ./scripts/ingest_all.sh --tier 3 --dry-run
#   ./scripts/ingest_all.sh --step 22 --build hg37
#
set -euo pipefail

# ── PYTHONPATH ──────────────────────────────────────────────────────
export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}src"

# ── Defaults ────────────────────────────────────────────────────────
BUILD="hg38"
START_STEP=1
DRY_RUN=false
TIER_ONLY=""
MODULE_ONLY=""

# ── Parse flags ─────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --step)    START_STEP="${2:?--step requires a number}"; shift 2 ;;
        --tier)    TIER_ONLY="${2:?--tier requires a number}";  shift 2 ;;
        --module)  MODULE_ONLY="${2:?--module requires a name}"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --build)   BUILD="${2:?--build requires a name}";       shift 2 ;;
        -h|--help)
            sed -n '2,/^set -euo/{ /^#/s/^# \?//p }' "$0"
            exit 0 ;;
        *) echo "Unknown flag: $1"; exit 1 ;;
    esac
done

# ── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

DIVIDER="${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── Timing ledger ───────────────────────────────────────────────────
# Parallel arrays: step number, step name, elapsed seconds
declare -a LEDGER_STEP=()
declare -a LEDGER_NAME=()
declare -a LEDGER_TIME=()
PIPELINE_START=$(date +%s)

# ── Helpers ─────────────────────────────────────────────────────────

step_header() {
    local step_num=$1
    local tier=$2
    local step_name=$3
    local est_time=$4
    echo ""
    echo -e "${DIVIDER}"
    echo -e "${BOLD}  STEP ${step_num}${NC}  ${DIM}[Tier ${tier}]${NC}  ${BOLD}${step_name}${NC}"
    echo -e "  ${YELLOW}Estimated: ${est_time}${NC}"
    echo -e "${DIVIDER}"
    echo ""
}

tier_header() {
    local tier=$1
    local name=$2
    local range=$3
    echo ""
    echo -e "${CYAN}${BOLD}  ┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}${BOLD}  │  TIER ${tier}: ${name}$(printf '%*s' $((43 - ${#name})) '')│${NC}"
    echo -e "${CYAN}${BOLD}  │  Steps ${range}$(printf '%*s' $((51 - ${#range})) '')│${NC}"
    echo -e "${CYAN}${BOLD}  └─────────────────────────────────────────────────────────────┘${NC}"
}

# run_step STEP_NUM TIER MODULE_NAME EST_TIME COMMAND...
#
# Skips if:
#   - step_num < START_STEP (--step resume)
#   - TIER_ONLY is set and doesn't match this tier
#   - MODULE_ONLY is set and doesn't match this module name
run_step() {
    local step_num=$1
    local tier=$2
    local module_name=$3
    local est_time=$4
    shift 4
    local cmd="$*"

    # Filter: --module
    if [[ -n "$MODULE_ONLY" && "$module_name" != "$MODULE_ONLY" ]]; then
        return 0
    fi

    # Filter: --tier
    if [[ -n "$TIER_ONLY" && "$tier" != "$TIER_ONLY" ]]; then
        return 0
    fi

    # Filter: --step (resume)
    if (( step_num < START_STEP )); then
        echo -e "${DIM}  [skip] Step ${step_num}: ${module_name}${NC}"
        return 0
    fi

    step_header "$step_num" "$tier" "$module_name" "$est_time"

    if $DRY_RUN; then
        echo -e "  ${BLUE}[DRY RUN]${NC} Would execute:"
        echo "    $cmd"
        return 0
    fi

    local t0=$(date +%s)

    if eval "$cmd"; then
        local t1=$(date +%s)
        local elapsed=$((t1 - t0))
        echo ""
        echo -e "  ${GREEN}✓  Step ${step_num} complete${NC} (${elapsed}s)"
        # Record in ledger
        LEDGER_STEP+=("$step_num")
        LEDGER_NAME+=("$module_name")
        LEDGER_TIME+=("$elapsed")
    else
        local t1=$(date +%s)
        local elapsed=$((t1 - t0))
        echo ""
        echo -e "  ${RED}✗  Step ${step_num} FAILED${NC} after ${elapsed}s"
        echo -e "  ${YELLOW}Resume with:${NC}"
        echo "    ./scripts/ingest_all.sh --step ${step_num} --build ${BUILD}"
        exit 1
    fi
}

# ── Banner ──────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${BLUE}"
echo "  ╔═══════════════════════════════════════════════════════════╗"
echo "  ║                                                           ║"
echo "  ║            P O L Y M E R   G E N O M I C S               ║"
echo "  ║           Data Ingestion Pipeline  (56 modules)           ║"
echo "  ║                                                           ║"
echo "  ║  Build:  ${BUILD}                                            ║"
echo -e "  ║  Mode:   $(if $DRY_RUN; then echo 'DRY RUN '; else echo 'LIVE    '; fi)                                         ║"
echo "  ╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [[ -n "$TIER_ONLY" ]]; then
    echo -e "  ${YELLOW}Filter: running tier ${TIER_ONLY} only${NC}"
fi
if [[ -n "$MODULE_ONLY" ]]; then
    echo -e "  ${YELLOW}Filter: running module '${MODULE_ONLY}' only${NC}"
fi
if (( START_STEP > 1 )); then
    echo -e "  ${YELLOW}Resuming from step ${START_STEP}${NC}"
fi

# ── Pre-flight checks ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}Pre-flight checks:${NC}"

# PYTHONPATH
if echo "$PYTHONPATH" | grep -q 'src'; then
    echo -e "  ${GREEN}✓${NC}  PYTHONPATH includes 'src'"
else
    echo -e "  ${RED}✗${NC}  PYTHONPATH does not include 'src' — this should not happen"
    exit 1
fi

# Docker / PostgreSQL
if docker compose ps --format '{{.Service}}' 2>/dev/null | grep -q postgres; then
    echo -e "  ${GREEN}✓${NC}  PostgreSQL container running"
else
    echo -e "  ${RED}✗${NC}  PostgreSQL container not running"
    echo "     Run: docker compose up -d"
    if [[ "$DRY_RUN" != true ]]; then
        exit 1
    fi
fi

# Genome FASTA
if [[ -f "data/${BUILD}.fa" ]]; then
    SIZE=$(du -h "data/${BUILD}.fa" | cut -f1)
    echo -e "  ${GREEN}✓${NC}  ${BUILD}.fa present (${SIZE})"
else
    echo -e "  ${RED}✗${NC}  data/${BUILD}.fa not found"
    echo "     Download: https://hgdownload.soe.ucsc.edu/goldenPath/${BUILD}/bigZips/${BUILD}.fa.gz"
    if [[ "$DRY_RUN" != true ]]; then
        exit 1
    fi
fi

if [[ -f "data/${BUILD}.fa.fai" ]]; then
    echo -e "  ${GREEN}✓${NC}  ${BUILD}.fa.fai present"
else
    echo -e "  ${YELLOW}!${NC}  ${BUILD}.fa.fai not found — pyfaidx will create it on first use"
fi

# GENCODE GTF
GENCODE_FILE="data/gencode.v44.annotation.gtf.gz"
if [[ -f "$GENCODE_FILE" ]]; then
    SIZE=$(du -h "$GENCODE_FILE" | cut -f1)
    echo -e "  ${GREEN}✓${NC}  GENCODE v44 GTF present (${SIZE})"
else
    echo -e "  ${YELLOW}!${NC}  GENCODE GTF not found — will be downloaded during ingestion"
fi

echo ""
echo -e "${BOLD}Starting ingestion pipeline...${NC}"

# ════════════════════════════════════════════════════════════════════
# TIER 0: Foundation  (Step 1)
# No dependencies. Seeds chromosome table from FASTA index.
# ════════════════════════════════════════════════════════════════════
tier_header 0 "Foundation" "1"

run_step 1 0 "seed_chromosomes" "< 5s" \
    "uv run python -m polymer_genomics.ingest.seed_chromosomes"

# ════════════════════════════════════════════════════════════════════
# TIER 1: Core geometry  (Steps 2-5)
# Require Tier 0 (chromosome table).
# ════════════════════════════════════════════════════════════════════
tier_header 1 "Core geometry" "2-5"

run_step 2 1 "genes" "5-15 min" \
    "uv run python -m polymer_genomics.ingest.genes --build ${BUILD}"

run_step 3 1 "cpg" "30-60 min" \
    "uv run python -m polymer_genomics.ingest.cpg --build ${BUILD}"

run_step 4 1 "probes" "10-20 min" \
    "uv run python -m polymer_genomics.ingest.probes --build ${BUILD}"

run_step 5 1 "isochores" "15-30 min" \
    "uv run python -m polymer_genomics.ingest.isochores --build ${BUILD}"

# ════════════════════════════════════════════════════════════════════
# TIER 2: Biophysics base rows  (Step 6)
# Require Tier 0. Creates the 1 kb biophysics windows genome-wide.
# ════════════════════════════════════════════════════════════════════
tier_header 2 "Biophysics base rows" "6"

run_step 6 2 "biophysics_tracks" "30-90 min" \
    "uv run python -m polymer_genomics.ingest.biophysics_tracks --build ${BUILD}"

# ════════════════════════════════════════════════════════════════════
# TIER 3: UPDATE modules  (Steps 7-21)
# Require Tier 2. Each adds columns or updates biophysics rows.
# ════════════════════════════════════════════════════════════════════
tier_header 3 "Biophysics UPDATE modules" "7-21"

run_step 7  3 "dnashape"                 "5-15 min" \
    "uv run python -m polymer_genomics.ingest.dnashape --build ${BUILD}"

run_step 8  3 "methyl_dnashape"          "5-15 min" \
    "uv run python -m polymer_genomics.ingest.methyl_dnashape --build ${BUILD}"

run_step 9  3 "shape_bulk"               "5-15 min" \
    "uv run python -m polymer_genomics.ingest.shape_bulk --build ${BUILD}"

run_step 10 3 "methylation_perturbation" "10-30 min" \
    "uv run python -m polymer_genomics.ingest.methylation_perturbation --build ${BUILD}"

run_step 11 3 "greens_function"          "10-30 min" \
    "uv run python -m polymer_genomics.ingest.greens_function --build ${BUILD}"

run_step 12 3 "extended_biophysics"      "10-30 min" \
    "uv run python -m polymer_genomics.ingest.extended_biophysics --build ${BUILD}"

run_step 13 3 "replication_timing"       "5-15 min" \
    "uv run python -m polymer_genomics.ingest.replication_timing --build ${BUILD}"

run_step 14 3 "gene_density"             "5-10 min" \
    "uv run python -m polymer_genomics.ingest.gene_density --build ${BUILD}"

run_step 15 3 "te_fractions"             "5-15 min" \
    "uv run python -m polymer_genomics.ingest.te_fractions --build ${BUILD}"

run_step 16 3 "derived_densities"        "5-10 min" \
    "uv run python -m polymer_genomics.ingest.derived_densities --build ${BUILD}"

run_step 17 3 "nonb_dna"                 "10-30 min" \
    "uv run python -m polymer_genomics.ingest.nonb_dna --build ${BUILD}"

run_step 18 3 "melting_domains"          "5-15 min" \
    "uv run python -m polymer_genomics.ingest.melting_domains --build ${BUILD}"

run_step 19 3 "sbs_bulk_update"          "5-15 min" \
    "uv run python -m polymer_genomics.ingest.sbs_bulk_update --build ${BUILD}"

run_step 20 3 "fragility_composite"      "5-15 min" \
    "uv run python -m polymer_genomics.ingest.fragility_composite --build ${BUILD}"

run_step 21 3 "breakpoints"              "5-10 min" \
    "uv run python -m polymer_genomics.ingest.breakpoints --build ${BUILD}"

# ════════════════════════════════════════════════════════════════════
# TIER 4: Annotation layers  (Steps 22-28)
# Independent of Tier 2/3. Require Tier 0 (chromosomes).
# ════════════════════════════════════════════════════════════════════
tier_header 4 "Annotation layers" "22-30"

run_step 22 4 "repeats"         "10-30 min" \
    "uv run python -m polymer_genomics.ingest.repeats --build ${BUILD}"

run_step 23 4 "conservation"    "10-30 min" \
    "uv run python -m polymer_genomics.ingest.conservation --build ${BUILD}"

run_step 24 4 "regulatory"      "5-15 min" \
    "uv run python -m polymer_genomics.ingest.regulatory --build ${BUILD}"

run_step 25 4 "chromatin_state" "10-30 min" \
    "uv run python -m polymer_genomics.ingest.chromatin_state --build ${BUILD}"

run_step 26 4 "histone_marks"   "10-30 min" \
    "uv run python -m polymer_genomics.ingest.histone_marks --build ${BUILD}"

run_step 27 4 "gwas_catalog"    "5-10 min" \
    "uv run python -m polymer_genomics.ingest.gwas_catalog --build ${BUILD}"

run_step 28 4 "herv_loci"       "5-10 min" \
    "uv run python -m polymer_genomics.ingest.herv_loci --build ${BUILD}"

run_step 29 4 "tfbs_peaks"      "30-90 min" \
    "uv run python -m polymer_genomics.ingest.tfbs_peaks --build ${BUILD}"

run_step 30 4 "gnomad_sv"       "10-30 min" \
    "uv run python -m polymer_genomics.ingest.gnomad_sv --build ${BUILD}"

# ════════════════════════════════════════════════════════════════════
# TIER 5: Gene-level data  (Steps 31-41)
# Require Tier 1 (genes table).
# ════════════════════════════════════════════════════════════════════
tier_header 5 "Gene-level data" "31-41"

run_step 31 5 "expression"          "5-15 min" \
    "uv run python -m polymer_genomics.ingest.expression --build ${BUILD}"

run_step 32 5 "gene_costs"          "2-5 min" \
    "uv run python -m polymer_genomics.ingest.gene_costs --build ${BUILD}"

run_step 33 5 "gene_constraint"     "2-5 min" \
    "uv run python -m polymer_genomics.ingest.gene_constraint --build ${BUILD}"

run_step 34 5 "protein_evolution"   "2-5 min" \
    "uv run python -m polymer_genomics.ingest.protein_evolution --build ${BUILD}"

run_step 35 5 "protein_abundance"   "2-5 min" \
    "uv run python -m polymer_genomics.ingest.protein_abundance --build ${BUILD}"

run_step 36 5 "protein_properties"  "2-5 min" \
    "uv run python -m polymer_genomics.ingest.protein_properties --build ${BUILD}"

run_step 37 5 "protein_turnover"    "2-5 min" \
    "uv run python -m polymer_genomics.ingest.protein_turnover --build ${BUILD}"

run_step 38 5 "protein_atlas"       "5-10 min" \
    "uv run python -m polymer_genomics.ingest.protein_atlas --build ${BUILD}"

run_step 39 5 "gene_pathways"       "5-10 min" \
    "uv run python -m polymer_genomics.ingest.gene_pathways --build ${BUILD}"

run_step 40 5 "gene_sets"           "2-5 min" \
    "uv run python -m polymer_genomics.ingest.gene_sets --build ${BUILD}"

run_step 41 5 "gene_aliases"        "2-5 min" \
    "uv run python -m polymer_genomics.ingest.gene_aliases --build ${BUILD}"

# ════════════════════════════════════════════════════════════════════
# TIER 6: Cross-references  (Steps 42-45)
# Require Tiers 1 + 4 + 5 (genes, repeats, gene-level data).
# ════════════════════════════════════════════════════════════════════
tier_header 6 "Cross-references" "42-45"

run_step 42 6 "probe_repeat_xref"  "5-15 min" \
    "uv run python -m polymer_genomics.ingest.probe_repeat_xref --build ${BUILD}"

run_step 43 6 "metabolic_burden"    "5-10 min" \
    "uv run python -m polymer_genomics.ingest.metabolic_burden --build ${BUILD}"

run_step 44 6 "gene_profiles"       "5-15 min" \
    "uv run python -m polymer_genomics.ingest.gene_profiles --build ${BUILD}"

run_step 45 6 "tcga_pan_cancer"     "30-60 min" \
    "uv run python -m polymer_genomics.ingest.tcga_pan_cancer --build ${BUILD}"

# ════════════════════════════════════════════════════════════════════
# TIER 7: Correlation engine layers  (Steps 46-52)
# Require Tier 2 (biophysics base rows) for spatial joins.
# ════════════════════════════════════════════════════════════════════
tier_header 7 "Correlation engine layers" "46-52"

run_step 46 7 "tad_domains"             "10-30 min" \
    "uv run python -m polymer_genomics.ingest.tad_domains --build ${BUILD}"

run_step 47 7 "hic_compartment"          "10-30 min" \
    "uv run python -m polymer_genomics.ingest.hic_compartment --build ${BUILD}"

run_step 48 7 "insulation_score"         "10-30 min" \
    "uv run python -m polymer_genomics.ingest.insulation_score --build ${BUILD}"

run_step 49 7 "tf_binding_signal"        "10-30 min" \
    "uv run python -m polymer_genomics.ingest.tf_binding_signal --build ${BUILD}"

run_step 50 7 "wgbs_hematopoietic"       "15-45 min" \
    "uv run python -m polymer_genomics.ingest.wgbs_hematopoietic --build ${BUILD}"

run_step 51 7 "accessibility_signal"     "10-30 min" \
    "uv run python -m polymer_genomics.ingest.accessibility_signal --build ${BUILD}"

run_step 52 7 "mutation_density"         "10-30 min" \
    "uv run python -m polymer_genomics.ingest.mutation_density --build ${BUILD}"

# ════════════════════════════════════════════════════════════════════
# TIER 8: Reference tables  (Steps 53-56)
# Standalone lookup tables. No genomic coordinate dependencies.
# Note: reference_constants and sbs_spectrum do not take --build.
# ════════════════════════════════════════════════════════════════════
tier_header 8 "Reference tables" "53-56"

run_step 53 8 "epigenetic_clocks"     "2-5 min" \
    "uv run python -m polymer_genomics.ingest.epigenetic_clocks --build ${BUILD}"

run_step 54 8 "reference_constants"   "< 30s" \
    "uv run python -m polymer_genomics.ingest.reference_constants"

run_step 55 8 "sbs_spectrum"          "< 30s" \
    "uv run python -m polymer_genomics.ingest.sbs_spectrum"

run_step 56 8 "methylation"           "15-45 min" \
    "uv run python -m polymer_genomics.ingest.methylation --build ${BUILD}"

# ════════════════════════════════════════════════════════════════════
# Verification queries
# ════════════════════════════════════════════════════════════════════
echo ""
echo -e "${DIVIDER}"
echo -e "${BOLD}  VERIFICATION${NC}"
echo -e "${DIVIDER}"

if ! $DRY_RUN; then
    echo ""
    echo "  Checking API health..."
    HEALTH=$(curl -sf http://localhost:8000/health 2>/dev/null || echo '{"error": "API not responding"}')
    echo "  $HEALTH"

    echo ""
    echo "  Testing BRCA1 region query..."
    BRCA1=$(curl -sf "http://localhost:8000/v1/regions/${BUILD}/chr17:43044295-43170245?layers=gencode_v44" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    count = len(d.get('data', {}).get('gencode_v44', []))
    print(f'  Found {count} gene features in BRCA1 region')
except:
    print('  Could not parse response (API may not be running)')
" 2>/dev/null || echo "  API not running — start with: uv run uvicorn polymer_genomics.main:app")
    echo "$BRCA1"

    echo ""
    echo "  Testing gene search..."
    SEARCH=$(curl -sf "http://localhost:8000/v1/search?q=TP53&build=${BUILD}" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    results = d.get('data', {}).get('results', [])
    print(f'  Search for TP53: {len(results)} results')
except:
    print('  Could not parse response')
" 2>/dev/null || echo "  API not running")
    echo "$SEARCH"
fi

# ════════════════════════════════════════════════════════════════════
# Summary table
# ════════════════════════════════════════════════════════════════════
PIPELINE_END=$(date +%s)
TOTAL_ELAPSED=$((PIPELINE_END - PIPELINE_START))

echo ""
echo -e "${DIVIDER}"
echo -e "${BOLD}  TIMING SUMMARY${NC}"
echo -e "${DIVIDER}"
echo ""

if (( ${#LEDGER_STEP[@]} > 0 )); then
    printf "  ${BOLD}%-6s  %-30s  %10s${NC}\n" "Step" "Module" "Elapsed"
    printf "  %-6s  %-30s  %10s\n" "------" "------------------------------" "----------"
    for i in "${!LEDGER_STEP[@]}"; do
        local_step="${LEDGER_STEP[$i]}"
        local_name="${LEDGER_NAME[$i]}"
        local_secs="${LEDGER_TIME[$i]}"
        # Format as Xm Ys
        if (( local_secs >= 60 )); then
            local_fmt="$((local_secs / 60))m $((local_secs % 60))s"
        else
            local_fmt="${local_secs}s"
        fi
        printf "  %-6s  %-30s  %10s\n" "$local_step" "$local_name" "$local_fmt"
    done
    echo ""
fi

# Total time formatted
if (( TOTAL_ELAPSED >= 3600 )); then
    TOTAL_FMT="$((TOTAL_ELAPSED / 3600))h $((TOTAL_ELAPSED % 3600 / 60))m $((TOTAL_ELAPSED % 60))s"
elif (( TOTAL_ELAPSED >= 60 )); then
    TOTAL_FMT="$((TOTAL_ELAPSED / 60))m $((TOTAL_ELAPSED % 60))s"
else
    TOTAL_FMT="${TOTAL_ELAPSED}s"
fi

echo -e "  ${BOLD}Total wall time: ${TOTAL_FMT}${NC}  (${#LEDGER_STEP[@]} steps completed)"

# ── Done ────────────────────────────────────────────────────────────
echo ""
echo -e "${DIVIDER}"
echo -e "${BOLD}${GREEN}"
echo "  ╔═══════════════════════════════════════════════════════════╗"
echo "  ║                                                           ║"
echo "  ║            INGESTION COMPLETE                             ║"
echo "  ║            56 modules across 9 tiers                      ║"
echo "  ║                                                           ║"
echo "  ║  Next steps:                                              ║"
echo "  ║  1. Start the API:                                        ║"
echo "  ║     uv run uvicorn polymer_genomics.main:app              ║"
echo "  ║                                                           ║"
echo "  ║  2. Open the viewer:                                      ║"
echo "  ║     cd viewer && npm run dev                              ║"
echo "  ║                                                           ║"
echo "  ║  3. Configure MCP in Claude Code:                         ║"
echo "  ║     See mcp/claude-code-config.example.json               ║"
echo "  ║                                                           ║"
echo "  ╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
