#!/usr/bin/env bash
# ── Run RepeatMasker on reference genome to produce license-clean repeat annotations ──
#
# This script runs RepeatMasker (open source) with the Dfam library (CC0)
# on the public-domain reference genome to produce repeat annotations that
# are free of UCSC's non-commercial license restriction.
#
# Prerequisites:
#   1. RepeatMasker installed (https://www.repeatmasker.org)
#   2. Dfam library configured (https://www.dfam.org — CC0 licensed)
#   3. Reference FASTA available
#
# Output:
#   data/repeatmasker_hg38.out  — RepeatMasker .out file
#   data/repeatmasker_hg38.tsv  — Parsed TSV compatible with repeats.py ingestion
#
# Usage:
#   bash scripts/run_repeatmasker.sh                    # default hg38
#   bash scripts/run_repeatmasker.sh /path/to/hg37.fa hg37
#
# License: The output of running open-source RepeatMasker software on a
# public-domain genome with the CC0 Dfam library is your own computation.
# No UCSC license applies.

set -euo pipefail

FASTA="${1:-${FASTA_HG38:-data/hg38.fa}}"
BUILD="${2:-hg38}"
OUTDIR="data/repeatmasker_${BUILD}"
THREADS="${REPEATMASKER_THREADS:-4}"

if ! command -v RepeatMasker &>/dev/null; then
    echo "ERROR: RepeatMasker not found in PATH."
    echo "Install from https://www.repeatmasker.org"
    echo "  brew install repeatmasker   (macOS)"
    echo "  conda install -c bioconda repeatmasker"
    exit 1
fi

if [ ! -f "$FASTA" ]; then
    echo "ERROR: Reference FASTA not found at $FASTA"
    echo "Set FASTA_HG38 environment variable or pass as first argument."
    exit 1
fi

echo "============================================================"
echo "Running RepeatMasker on ${BUILD}"
echo "  FASTA:   ${FASTA}"
echo "  Output:  ${OUTDIR}"
echo "  Threads: ${THREADS}"
echo "============================================================"

mkdir -p "$OUTDIR"

# Run RepeatMasker.
# -species human: use human repeat library
# -pa: parallel threads
# -xsmall: softmask instead of N-mask (preserves sequence)
# -gff: also produce GFF output
# -dir: output directory
RepeatMasker \
    -species human \
    -pa "$THREADS" \
    -xsmall \
    -gff \
    -dir "$OUTDIR" \
    "$FASTA"

echo ""
echo "RepeatMasker complete. Output in ${OUTDIR}/"

# Find the .out file (RepeatMasker names it after the input FASTA).
OUTFILE=$(find "$OUTDIR" -name "*.out" -not -name "*.cat.out" | head -1)

if [ -z "$OUTFILE" ]; then
    echo "ERROR: No .out file found in ${OUTDIR}"
    exit 1
fi

echo "Parsing ${OUTFILE} into TSV format..."

# Parse RepeatMasker .out into a TSV compatible with repeats.py.
# RepeatMasker .out format (whitespace-separated, 3 header lines):
#   SW_score  perc_div  perc_del  perc_ins  query_name  query_begin  query_end  ...
#   ... query_left  strand  repeat_name  repeat_class/family  ...
python3 -c "
import sys

outfile = '${OUTFILE}'
tsvfile = 'data/repeatmasker_${BUILD}.tsv'

rows = 0
with open(outfile) as fin, open(tsvfile, 'w') as fout:
    fout.write('chr\tstart\tend\tstrand\trepeat_name\trepeat_class\trepeat_family\tsw_score\tdivergence_pct\tdeletion_pct\tinsertion_pct\n')
    for i, line in enumerate(fin):
        # Skip header lines (first 3 lines of .out file).
        if i < 3:
            continue
        line = line.strip()
        if not line:
            continue
        fields = line.split()
        if len(fields) < 15:
            continue
        try:
            sw_score = int(fields[0])
            div_pct = float(fields[1])
            del_pct = float(fields[2])
            ins_pct = float(fields[3])
            chrom = fields[4]
            start = int(fields[5]) - 1  # Convert to 0-based
            end = int(fields[6])
            strand = '-' if fields[8] == 'C' else '+'
            repeat_name = fields[9]
            # Class/family is in field 10, format: 'Class/Family' or just 'Class'
            class_family = fields[10]
            if '/' in class_family:
                repeat_class, repeat_family = class_family.split('/', 1)
            else:
                repeat_class = class_family
                repeat_family = class_family
        except (ValueError, IndexError):
            continue

        fout.write(f'{chrom}\t{start}\t{end}\t{strand}\t{repeat_name}\t{repeat_class}\t{repeat_family}\t{sw_score}\t{div_pct}\t{del_pct}\t{ins_pct}\n')
        rows += 1

print(f'  Parsed {rows:,} repeat elements -> {tsvfile}')
"

echo ""
echo "Done. To ingest into the database:"
echo "  REPEATMASKER_TSV=data/repeatmasker_${BUILD}.tsv uv run python -m polymer_genomics.ingest.repeats --build ${BUILD}"
