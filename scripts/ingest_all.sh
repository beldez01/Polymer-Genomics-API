#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# Polymer Genomics — Full hg38 Ingestion Pipeline
# ──────────────────────────────────────────────────────────────────
#
# Runs the complete data ingestion pipeline for the hg38 build.
# Assumes: Docker Compose is up (Postgres + MinIO running).
#
# Usage:
#   ./scripts/ingest_all.sh              # full pipeline
#   ./scripts/ingest_all.sh --step 3     # start from step 3
#   ./scripts/ingest_all.sh --dry-run    # print steps without running
#
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────
BUILD="${BUILD:-hg38}"
START_STEP="${1:-1}"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    START_STEP=1
fi

if [[ "${1:-}" == "--step" ]]; then
    START_STEP="${2:-1}"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

DIVIDER="${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

step_header() {
    local step_num=$1
    local step_name=$2
    local est_time=$3
    echo ""
    echo -e "${DIVIDER}"
    echo -e "${BOLD}  STEP ${step_num}  ${step_name}${NC}"
    echo -e "  ${YELLOW}Estimated time: ${est_time}${NC}"
    echo -e "${DIVIDER}"
    echo ""
}

run_step() {
    local step_num=$1
    local step_name=$2
    local est_time=$3
    shift 3
    local cmd="$*"

    if (( step_num < START_STEP )); then
        echo -e "${YELLOW}  ⏭  Skipping step ${step_num}: ${step_name}${NC}"
        return 0
    fi

    step_header "$step_num" "$step_name" "$est_time"

    if $DRY_RUN; then
        echo -e "  ${BLUE}[DRY RUN]${NC} Would execute:"
        echo "    $cmd"
        return 0
    fi

    local start_time=$(date +%s)

    if eval "$cmd"; then
        local end_time=$(date +%s)
        local elapsed=$((end_time - start_time))
        echo ""
        echo -e "  ${GREEN}✓  Step ${step_num} complete${NC} (${elapsed}s)"
    else
        echo ""
        echo -e "  ${RED}✗  Step ${step_num} FAILED${NC}"
        echo -e "  ${YELLOW}Resume from this step with:${NC}"
        echo "    ./scripts/ingest_all.sh --step ${step_num}"
        exit 1
    fi
}

# ── Banner ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${BLUE}"
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║                                                       ║"
echo "  ║            P O L Y M E R   G E N O M I C S           ║"
echo "  ║              Data Ingestion Pipeline                  ║"
echo "  ║                                                       ║"
echo "  ║  Build: ${BUILD}                                          ║"
echo "  ║                                                       ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Pre-flight checks ────────────────────────────────────────────
echo -e "${BOLD}Pre-flight checks:${NC}"

# Check Docker
if docker compose ps --format '{{.Service}}' 2>/dev/null | grep -q postgres; then
    echo -e "  ${GREEN}✓${NC}  PostgreSQL container running"
else
    echo -e "  ${RED}✗${NC}  PostgreSQL container not running"
    echo "     Run: docker compose up -d"
    exit 1
fi

# Check data files
if [[ -f "data/${BUILD}.fa" ]]; then
    SIZE=$(du -h "data/${BUILD}.fa" | cut -f1)
    echo -e "  ${GREEN}✓${NC}  ${BUILD}.fa present (${SIZE})"
else
    echo -e "  ${RED}✗${NC}  data/${BUILD}.fa not found"
    echo "     Download from: https://hgdownload.soe.ucsc.edu/goldenPath/${BUILD}/bigZips/${BUILD}.fa.gz"
    echo "     Then: gunzip data/${BUILD}.fa.gz"
    exit 1
fi

if [[ -f "data/${BUILD}.fa.fai" ]]; then
    echo -e "  ${GREEN}✓${NC}  ${BUILD}.fa.fai present"
else
    echo -e "  ${YELLOW}⚠${NC}  ${BUILD}.fa.fai not found — will be created by pyfaidx on first use"
fi

GENCODE_FILE="data/gencode.v44.annotation.gtf.gz"
if [[ -f "$GENCODE_FILE" ]]; then
    SIZE=$(du -h "$GENCODE_FILE" | cut -f1)
    echo -e "  ${GREEN}✓${NC}  GENCODE v44 GTF present (${SIZE})"
else
    echo -e "  ${YELLOW}⚠${NC}  GENCODE GTF not found — will be downloaded during ingestion"
fi

echo ""
echo -e "${BOLD}Starting ingestion pipeline...${NC}"

# ── Step 1: Seed chromosomes ─────────────────────────────────────
run_step 1 "Seed chromosome lengths" "< 5s" \
    "uv run python -m polymer_genomics.ingest.seed_chromosomes"

# ── Step 2: Ingest GENCODE v44 gene models ───────────────────────
run_step 2 "Ingest GENCODE v44 gene models (${BUILD})" "5-15 min" \
    "uv run python -m polymer_genomics.ingest.genes --build ${BUILD}"

# ── Step 3: Ingest CpG sites + islands ───────────────────────────
run_step 3 "Ingest CpG sites and islands (${BUILD})" "30-60 min" \
    "uv run python -m polymer_genomics.ingest.cpg --build ${BUILD}"

# ── Step 4: Ingest probe manifests ───────────────────────────────
run_step 4 "Ingest Illumina probe manifests (${BUILD})" "10-20 min" \
    "uv run python -m polymer_genomics.ingest.probes --build ${BUILD}"

# ── Step 5: Compute isochores ────────────────────────────────────
run_step 5 "Compute and ingest isochores (${BUILD})" "15-30 min" \
    "uv run python -m polymer_genomics.ingest.isochores --build ${BUILD}"

# ── Step 6: Verification ─────────────────────────────────────────
step_header 6 "Verification" "< 30s"

if ! $DRY_RUN; then
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

# ── Summary ──────────────────────────────────────────────────────
echo ""
echo -e "${DIVIDER}"
echo -e "${BOLD}${GREEN}"
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║                                                       ║"
echo "  ║            INGESTION COMPLETE                         ║"
echo "  ║                                                       ║"
echo "  ║  Next steps:                                          ║"
echo "  ║  1. Start the API:                                    ║"
echo "  ║     uv run uvicorn polymer_genomics.main:app          ║"
echo "  ║                                                       ║"
echo "  ║  2. Open the viewer:                                  ║"
echo "  ║     cd viewer && npm run dev                          ║"
echo "  ║                                                       ║"
echo "  ║  3. Configure MCP in Claude Code:                     ║"
echo "  ║     See mcp/claude-code-config.example.json           ║"
echo "  ║                                                       ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"
