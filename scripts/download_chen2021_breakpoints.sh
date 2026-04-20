#!/usr/bin/env bash
# Download Chen et al. 2021 (PLOS Comp Biol, PMC7951985) supplementary
# breakpoint tables into data/cancer_breakpoints_chen2021/.
#
# Citation:
#   Chen S. et al. "Comprehensive analysis of cancer breakpoints reveals
#   signatures of genetic and epigenetic contribution to cancer genome
#   rearrangements." PLOS Computational Biology 17(4):e1008749 (2021).
#
# Supplementary tables are hosted on the journal's article page:
#   https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008749
#
# The paper aggregates ~630K breakpoints from multiple published WGS cohorts.
# Supplementary Dataset S1 or S2 typically contains the unified breakpoint
# coordinates in hg19 or hg38 — verify build on download.
#
# Run from repository root.

set -euo pipefail

DATA_DIR="data/cancer_breakpoints_chen2021"
mkdir -p "${DATA_DIR}"

ARTICLE_URL="https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008749"
# PLOS supplementary file URLs follow the pattern:
#   https://journals.plos.org/ploscompbiol/article/file?id=...S1_Data.xlsx
# Exact IDs need manual verification from the article page.

TARGET="${DATA_DIR}/breakpoints_hg38.tsv"

if [ -f "${TARGET}" ]; then
    echo "  ${TARGET} already present."
else
    echo "  [MANUAL STEP] Download Chen 2021 supplementary breakpoint tables."
    echo ""
    echo "    Article page: ${ARTICLE_URL}"
    echo ""
    echo "  Expected: a TSV or CSV with at minimum these columns (case-insensitive):"
    echo "    - chrom (or chr / chromosome / seqnames)"
    echo "    - start (or pos / start_pos / breakpoint)"
    echo "    - end   (optional)"
    echo "    - sv_type (or type / svtype / class)"
    echo "    - recurrence (or n_samples / n_tumors)   [optional but preferred]"
    echo "    - tumor_types (or cancer_types / tissue) [optional]"
    echo "    - partner_chrom, partner_start, partner_end [for TRA/BND events]"
    echo ""
    echo "  Save as: ${TARGET}"
    echo ""
    echo "  If the source is hg19, lift to hg38 using the UCSC hg19→hg38 chain"
    echo "  file (https://hgdownload.soe.ucsc.edu/goldenPath/hg19/liftOver/) and"
    echo "  save the lifted output to ${TARGET}. Record the liftOver step in"
    echo "  provenance.yaml below."
fi

cat > "${DATA_DIR}/provenance.yaml" <<EOF
source: Chen et al. 2021 PLOS Comp Biol (PMC7951985)
citation: |
  Chen S. et al. "Comprehensive analysis of cancer breakpoints reveals signatures
  of genetic and epigenetic contribution to cancer genome rearrangements."
  PLOS Computational Biology 17(4):e1008749 (2021).
  DOI: 10.1371/journal.pcbi.1008749
article_url: ${ARTICLE_URL}
supplementary_expected:
  - S1_Dataset or S2_Dataset (breakpoint coordinate table)
build: hg38
liftover_applied: TBD  # true if source was hg19
target_file: ${TARGET}
status: $( [ -f "${TARGET}" ] && echo "present" || echo "pending_manual_download" )
license: public (CC-BY)
generated_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

echo ""
echo "  Wrote provenance to ${DATA_DIR}/provenance.yaml"
echo "  Next:"
echo "    1. Place breakpoint table at ${TARGET}"
echo "    2. psql -f scripts/migrations/007_recurrent_cancer_breakpoints.sql"
echo "    3. uv run python -m polymer_genomics.ingest.recurrent_cancer_breakpoints \\"
echo "           --source chen2021 --input ${TARGET} --dry-run"
