#!/usr/bin/env bash
# Download UCSC genomicSuperDups track for hg38 into data/segdups/.
#
# Source: UCSC Genome Browser (public, free use)
# Bailey et al. 2001/2002 segmental duplication catalog.
#
# Run from repository root.

set -euo pipefail

DATA_DIR="data/segdups"
FILE="genomicSuperDups_hg38.txt.gz"
URL="https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/genomicSuperDups.txt.gz"

mkdir -p "${DATA_DIR}"

if [ -f "${DATA_DIR}/${FILE}" ]; then
    echo "  ${DATA_DIR}/${FILE} already exists, skipping download."
else
    echo "  Downloading ${URL} → ${DATA_DIR}/${FILE}"
    curl -sSL --fail -o "${DATA_DIR}/${FILE}" "${URL}"
fi

# Quick sanity check (gunzip -c works on both macOS + Linux; zcat on macOS expects .Z)
N_ROWS=$(gunzip -c "${DATA_DIR}/${FILE}" | wc -l)
echo "  ${DATA_DIR}/${FILE} contains ${N_ROWS} rows."

# Write provenance
cat > "${DATA_DIR}/provenance.yaml" <<EOF
source: UCSC Genome Browser
table: genomicSuperDups
url: ${URL}
build: hg38
license: public
citation:
  - Bailey, J. A. et al. "Recent segmental duplications in the human genome." Science 297, 1003-1007 (2002).
downloaded_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
sha256: $(shasum -a 256 "${DATA_DIR}/${FILE}" | awk '{print $1}')
EOF

echo "  Wrote provenance to ${DATA_DIR}/provenance.yaml"
echo "  Next: apply scripts/migrations/006_segmental_duplications.sql + run"
echo "        uv run python -m polymer_genomics.ingest.segmental_duplications --dry-run"
