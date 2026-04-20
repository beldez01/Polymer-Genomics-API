#!/usr/bin/env bash
# Download PRDM9 motif catalog sources into data/prdm9_catalog/.
#
# Two sources:
#   1. Altemose et al. 2017 (eLife 6:e28383) — ChIP-seq peaks, hg38 coordinates
#      NOTE: hosted as supplementary materials on eLife. May require manual
#      download if automated fetch fails. See README fallback below.
#   2. Myers 2008/2010 13-mer motif (A/B/C alleles) — PWM distributed with
#      Altemose supplementary materials.
#
# The PWM scan against hg38 is a separate offline step (scripts/scan_prdm9_pwm.py,
# TO BE WRITTEN) producing data/prdm9_catalog/myers_2008/prdm9_pwm_hits_hg38.bed.gz.
#
# Run from repository root.

set -euo pipefail

BASE_DIR="data/prdm9_catalog"
ALTEMOSE_DIR="${BASE_DIR}/altemose_2017"
MYERS_DIR="${BASE_DIR}/myers_2008"

mkdir -p "${ALTEMOSE_DIR}" "${MYERS_DIR}"

# ── Altemose 2017 peaks ──────────────────────────────────────────────────────
# TODO: Primary source is eLife supplementary file or the associated GEO accession.
# Placeholder URL shown below; update to canonical source after verification.
#
# Candidate URLs:
#   - eLife 6:e28383 supplementary materials page
#   - GEO: GSE99407 (hg19, needs liftOver to hg38)
#   - Author GitHub: github.com/altemose/PRDM9-map (if available)

ALTEMOSE_TARGET="${ALTEMOSE_DIR}/prdm9_chipseq_peaks_hg38.bed"

if [ -f "${ALTEMOSE_TARGET}" ]; then
    echo "  ${ALTEMOSE_TARGET} already present."
else
    echo "  [MANUAL STEP] Download Altemose 2017 PRDM9 ChIP-seq peaks and place at:"
    echo "    ${ALTEMOSE_TARGET}"
    echo "  Then re-run this script to generate provenance."
    echo ""
    echo "  Expected BED6 format: chrom, start, end, name, score, strand"
    echo "  If source is hg19, use liftOver with UCSC hg19→hg38 chain before saving."
fi

# ── Myers 2008/2010 PWM ──────────────────────────────────────────────────────
MYERS_PWM="${MYERS_DIR}/prdm9_13mer_pwm.json"

if [ -f "${MYERS_PWM}" ]; then
    echo "  ${MYERS_PWM} already present."
else
    echo "  [MANUAL STEP] Obtain Myers 2008/2010 PRDM9 13-mer PWM (alleles A, B, C) and save to:"
    echo "    ${MYERS_PWM}"
    echo ""
    echo "  Expected JSON format:"
    echo '    {"A": {"matrix": [[...], [...], ...], "length": 13}, "B": {...}, "C": {...}}'
    echo ""
    echo "  Canonical A-allele motif (Myers 2008): CCNCCNTNNCCNC"
fi

# ── Provenance stub ──────────────────────────────────────────────────────────
cat > "${BASE_DIR}/provenance.yaml" <<EOF
sources:
  altemose_2017:
    citation: Altemose N. et al. eLife 6:e28383 (2017)
    url_canonical: https://elifesciences.org/articles/28383
    file: altemose_2017/prdm9_chipseq_peaks_hg38.bed
    status: $( [ -f "${ALTEMOSE_TARGET}" ] && echo "present" || echo "pending_manual_download" )
  myers_2008:
    citations:
      - Myers S. et al. Science 327:876-879 (2010)
      - Myers S. et al. Science 322:876-879 (2008)
    file: myers_2008/prdm9_13mer_pwm.json
    status: $( [ -f "${MYERS_PWM}" ] && echo "present" || echo "pending_manual_download" )
    alleles: [A, B, C]
    pwm_scan_output: myers_2008/prdm9_pwm_hits_hg38.bed.gz
    pwm_scan_status: pending  # run scripts/scan_prdm9_pwm.py
build: hg38
generated_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

echo ""
echo "  Wrote provenance stub to ${BASE_DIR}/provenance.yaml"
echo "  Next steps:"
echo "    1. Fulfill any [MANUAL STEP] above"
echo "    2. uv run python scripts/scan_prdm9_pwm.py \\"
echo "           --pwm ${MYERS_PWM} \\"
echo "           --fasta data/reference/hg38.fa \\"
echo "           --out ${MYERS_DIR}/prdm9_pwm_hits_hg38.bed.gz \\"
echo "           --threshold 8.0"
echo "    3. Apply scripts/migrations/004_prdm9_motifs.sql"
echo "    4. uv run python -m polymer_genomics.ingest.prdm9_motifs --dry-run"
