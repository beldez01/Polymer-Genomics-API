#!/usr/bin/env bash
# Push melting data chunks to Fly.io Postgres
# Usage: ./scripts/push_melting_to_fly.sh [start_chunk]
set -euo pipefail

START=${1:-0}
TOTAL=59

echo "Pushing melting chunks $START..$((TOTAL-1)) to Fly.io Postgres"

for i in $(seq $START $((TOTAL-1))); do
    CHUNK=$(printf "/tmp/melting_chunk_%03d.sql" $i)
    if [[ ! -f "$CHUNK" ]]; then
        echo "  chunk $i: MISSING, skipping"
        continue
    fi
    echo -n "  chunk $i ($CHUNK)... "
    START_T=$(date +%s)

    if cat "$CHUNK" | fly postgres connect -a polymer-db -d polymer_genomics_api 2>/dev/null; then
        END_T=$(date +%s)
        echo "done ($((END_T - START_T))s)"
    else
        echo "FAILED"
        echo "Resume with: ./scripts/push_melting_to_fly.sh $i"
        exit 1
    fi
done

echo "All chunks pushed!"
