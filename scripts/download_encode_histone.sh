#!/bin/bash
# Download ENCODE histone ChIP-seq replicated peak files (GRCh38)
# Queries ENCODE API for each (mark, cell_type) to find replicated peak files

set -euo pipefail

OUTDIR="${1:-/Users/zbb2/Desktop/PolymerGenomicsAPI/data/encode/histone}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

ENCODE_BASE="https://www.encodeproject.org"

# Marks and cell types
MARKS_NARROW="H3K4me3 H3K27ac H3K4me1"
MARKS_BROAD="H3K27me3 H3K9me3 H3K36me3"
CELL_TYPES="GM12878 K562 H1"

download_mark() {
  local MARK="$1"
  local CELL="$2"
  local CELL_LABEL="$CELL"
  [ "$CELL" = "H1" ] && CELL_LABEL="H1-hESC"

  # Determine expected peak format
  local PEAK_FMT="narrowPeak"
  for bm in $MARKS_BROAD; do
    [ "$MARK" = "$bm" ] && PEAK_FMT="broadPeak"
  done

  local OUTFILE="${MARK}_${CELL_LABEL}.${PEAK_FMT}"

  # Skip if already exists
  if [ -f "$OUTFILE" ]; then
    local LINES=$(wc -l < "$OUTFILE" | tr -d ' ')
    echo "  SKIP: $OUTFILE ($LINES peaks)"
    return 0
  fi

  echo "  Searching: $MARK / $CELL_LABEL..."

  # Search for experiments
  local SEARCH_URL="${ENCODE_BASE}/search/?type=Experiment&assay_title=Histone+ChIP-seq&biosample_ontology.term_name=${CELL}&target.label=${MARK}&assembly=GRCh38&status=released&format=json&limit=5"

  local EXP_ACCS=$(curl -sL "$SEARCH_URL" -H "Accept: application/json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for exp in data.get('@graph', []):
    print(exp.get('accession', ''))
" 2>/dev/null)

  if [ -z "$EXP_ACCS" ] && [ "$CELL" = "H1" ]; then
    # Try H1-hESC
    SEARCH_URL="${ENCODE_BASE}/search/?type=Experiment&assay_title=Histone+ChIP-seq&biosample_ontology.term_name=H1-hESC&target.label=${MARK}&assembly=GRCh38&status=released&format=json&limit=5"
    EXP_ACCS=$(curl -sL "$SEARCH_URL" -H "Accept: application/json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for exp in data.get('@graph', []):
    print(exp.get('accession', ''))
" 2>/dev/null)
  fi

  if [ -z "$EXP_ACCS" ]; then
    echo "    WARNING: No experiments found for $MARK / $CELL_LABEL"
    return 1
  fi

  # Try each experiment
  for EXP_ACC in $EXP_ACCS; do
    echo "    Trying experiment $EXP_ACC..."

    # Find best peak file
    local FILE_INFO=$(curl -sL "${ENCODE_BASE}/experiments/${EXP_ACC}/?format=json" -H "Accept: application/json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
files = data.get('files', [])
best = None
best_score = -1
for f in files:
    if isinstance(f, str): continue
    if f.get('status') != 'released': continue
    if f.get('assembly') != 'GRCh38': continue
    ft = f.get('file_type', '')
    ot = f.get('output_type', '')
    if 'peak' not in ot.lower(): continue
    if 'bigBed' in ft: continue
    score = 0
    if 'replicated peaks' in ot: score = 3
    elif 'pseudoreplicated peaks' in ot: score = 2
    elif 'peaks' in ot: score = 1
    if score > best_score:
        best_score = score
        best = f
if best:
    print(f\"{best['accession']}|{best.get('file_type','')}|{best.get('output_type','')}\")
" 2>/dev/null)

    if [ -z "$FILE_INFO" ]; then
      continue
    fi

    local FILE_ACC=$(echo "$FILE_INFO" | cut -d'|' -f1)
    local FILE_TYPE=$(echo "$FILE_INFO" | cut -d'|' -f2)
    local OUTPUT_TYPE=$(echo "$FILE_INFO" | cut -d'|' -f3)

    # Determine actual extension
    local ACTUAL_EXT="$PEAK_FMT"
    if echo "$FILE_TYPE" | grep -q "narrowPeak"; then
      ACTUAL_EXT="narrowPeak"
    elif echo "$FILE_TYPE" | grep -q "broadPeak"; then
      ACTUAL_EXT="broadPeak"
    fi

    local ACTUAL_FILE="${MARK}_${CELL_LABEL}.${ACTUAL_EXT}"

    echo "    Found: $FILE_ACC ($OUTPUT_TYPE, $FILE_TYPE)"
    echo "    Downloading..."

    curl -sL "${ENCODE_BASE}/files/${FILE_ACC}/@@download/${FILE_ACC}.bed.gz" -o "${ACTUAL_FILE}.gz"

    # Decompress
    if file "${ACTUAL_FILE}.gz" | grep -q "gzip"; then
      gunzip -f "${ACTUAL_FILE}.gz"
    else
      mv "${ACTUAL_FILE}.gz" "$ACTUAL_FILE"
    fi

    if [ -f "$ACTUAL_FILE" ]; then
      local LINES=$(wc -l < "$ACTUAL_FILE" | tr -d ' ')
      echo "    -> $ACTUAL_FILE: $LINES peaks"
      return 0
    fi
  done

  echo "    ERROR: Could not download peaks for $MARK / $CELL_LABEL"
  return 1
}

echo "Downloading ENCODE histone peaks to $OUTDIR"
echo "============================================================"

TOTAL=0
SUCCESS=0

for CELL in $CELL_TYPES; do
  for MARK in $MARKS_NARROW $MARKS_BROAD; do
    TOTAL=$((TOTAL + 1))
    if download_mark "$MARK" "$CELL"; then
      SUCCESS=$((SUCCESS + 1))
    fi
  done
done

echo ""
echo "============================================================"
echo "Downloaded $SUCCESS/$TOTAL files"
echo ""
echo "Files in $OUTDIR:"
ls -la "$OUTDIR"
