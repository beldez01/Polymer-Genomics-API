#!/usr/bin/env python3
"""Tier 3G: MPRA Construct Performance — validate physics linter flags.

The physics linter (evaluate_design) emits flags like LOW_STABILITY,
Z_FORM_PRONE, HOMOPOLYMER, CPG_ISLAND. This test checks whether flagged
sequences have lower expression in MPRA experiments.

Data source: MPRAbase (https://mprabase.ucsf.edu)
  - Ahituv lab, UCSF
  - 130 experiments, 17.7M sequences, 35 cell types
  - Activity = log2(RNA/DNA ratio)
  - GitHub: https://github.com/Ahituv-lab/mprabase

STATUS: NEEDS_DATA — download required before running.

Acquisition steps:
  1. Visit https://mprabase.ucsf.edu
  2. Filter for human (hg38), MPRA technique, K562 or HEK293 cell type
  3. Download sequences + activity scores for 2-3 large experiments
  4. Place files in validation/data/mpra/
  5. Update DATA_FILES below and run

Alternative: Use the Kosuri et al. 2013 E. coli data (simpler, smaller)
  - PMID: 23474465, GEO: GSE39054
  - 13,000 synthetic promoters with expression in E. coli

Alternative: Use Townshend et al. 2020 (Science 370:6520)
  - 100K sequences, expression in yeast
  - GEO: GSE163882

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python validation/tier3/tier3g_mpra_validation.py
"""

from __future__ import annotations

import csv
import json
import math
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT))

from validation.common import print_test, write_results

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration — update these after downloading MPRA data
# ═══════════════════════════════════════════════════════════════════════════════

DATA_DIR = PROJECT_ROOT / "validation" / "data" / "mpra"

# Expected format: TSV/CSV with columns: sequence, expression (log2 RNA/DNA)
# Update these paths after downloading from MPRAbase
DATA_FILES: list[dict] = [
    # {"path": DATA_DIR / "experiment1.tsv", "name": "K562 MPRA", "seq_col": "sequence", "expr_col": "mean_log2_ratio"},
]

results = {"tier": "3G", "name": "MPRA Linter Validation", "tests": [], "status": "NEEDS_DATA"}


def main():
    if not DATA_FILES:
        print("═══ TIER 3G: MPRA LINTER VALIDATION ═══")
        print()
        print("  STATUS: NEEDS_DATA")
        print()
        print("  This test requires MPRA expression data to validate the physics linter.")
        print("  Download data from MPRAbase (https://mprabase.ucsf.edu) and update")
        print("  DATA_FILES in this script.")
        print()
        print("  Recommended experiments:")
        print("    - Any large human MPRA (K562, HEK293) with >5000 sequences")
        print("    - Sequences should span diverse GC content and motif composition")
        print()
        print("  Once data is available, this script will:")
        print("    1. Run each MPRA sequence through the physics linter (evaluate_design)")
        print("    2. Record which flags are triggered (LOW_STABILITY, Z_FORM_PRONE, etc.)")
        print("    3. Compare expression of flagged vs unflagged sequences")
        print("    4. Report: do flagged sequences actually have lower expression?")
        print()
        write_results("tier3g", results)
        return

    # ─── Run validation when data is available ───
    from polymer_genomics.evaluate import evaluate_sequence

    for experiment in DATA_FILES:
        exp_path = Path(experiment["path"])
        exp_name = experiment["name"]
        seq_col = experiment["seq_col"]
        expr_col = experiment["expr_col"]

        print(f"\n═══ {exp_name} ═══")

        if not exp_path.exists():
            print(f"  File not found: {exp_path}")
            continue

        # Load sequences and expression
        sequences = []
        with open(exp_path) as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                seq = row.get(seq_col, "").strip().upper()
                expr_str = row.get(expr_col, "")
                if not seq or not expr_str:
                    continue
                try:
                    expr = float(expr_str)
                except ValueError:
                    continue
                if len(seq) >= 50 and all(c in "ACGTN" for c in seq):
                    sequences.append({"seq": seq, "expr": expr})

        print(f"  Loaded {len(sequences)} sequences")
        if len(sequences) < 100:
            print("  Too few sequences, skipping")
            continue

        # Evaluate each sequence through the linter
        flag_counts: dict[str, list[float]] = {}
        unflagged_expr: list[float] = []

        for i, entry in enumerate(sequences[:10000]):  # Cap at 10K for speed
            result = evaluate_sequence(entry["seq"])
            flags = result.get("flags", [])
            flag_codes = {f["code"] for f in flags if f.get("type") == "warning"}

            if flag_codes:
                for code in flag_codes:
                    flag_counts.setdefault(code, []).append(entry["expr"])
            else:
                unflagged_expr.append(entry["expr"])

            if (i + 1) % 1000 == 0:
                print(f"  Evaluated {i + 1} sequences...")

        # Compare flagged vs unflagged expression
        mean_unflagged = np.mean(unflagged_expr) if unflagged_expr else 0.0
        print(f"\n  Unflagged mean expression: {mean_unflagged:.3f} (n={len(unflagged_expr)})")
        print(f"\n  {'Flag':<25} {'n':>6} {'Mean Expr':>10} {'Δ vs unflagged':>15} {'Lower?':>8}")
        print(f"  {'─'*25} {'─'*6} {'─'*10} {'─'*15} {'─'*8}")

        for code, exprs in sorted(flag_counts.items()):
            mean_flagged = np.mean(exprs)
            delta = mean_flagged - mean_unflagged
            lower = delta < 0
            print(f"  {code:<25} {len(exprs):>6} {mean_flagged:>10.3f} {delta:>+15.3f} {'YES' if lower else 'no':>8}")

            results["tests"].append({
                "name": f"{exp_name}: {code}",
                "n_flagged": len(exprs),
                "mean_flagged": round(mean_flagged, 4),
                "mean_unflagged": round(mean_unflagged, 4),
                "delta": round(delta, 4),
                "flag_predicts_lower": lower,
            })

    results["status"] = "COMPLETE"
    write_results("tier3g", results)


if __name__ == "__main__":
    main()
