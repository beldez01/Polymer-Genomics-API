"""Subset the Altemose 17-motif catalog to the top-N motifs by alpha.

For the Exp 23 orphan filter, scanning all 17 motifs is overkill — the top 3
(by alpha) cover ~33% of total PRDM9 binding weight, enough to identify
PRDM9-explained sites conservatively.

Reads: data/prdm9_catalog/myers_2008/prdm9_13mer_pwm.json
Writes: data/prdm9_catalog/myers_2008/prdm9_13mer_pwm_top3.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=3, help="Top-N motifs to keep")
    parser.add_argument("--input", type=Path,
                        default=Path("data/prdm9_catalog/myers_2008/prdm9_13mer_pwm.json"))
    parser.add_argument("--output", type=Path,
                        default=Path("data/prdm9_catalog/myers_2008/prdm9_13mer_pwm_top3.json"))
    args = parser.parse_args()

    pwms = json.loads(args.input.read_text())
    # Filter out motifs longer than 35 bp — M01 (74) and M09 (50) are compute outliers
    # that dominate scan time without proportional signal contribution
    short = {k: v for k, v in pwms.items() if v.get("length", 0) <= 35}
    sorted_motifs = sorted(short.items(), key=lambda kv: -kv[1].get("alpha", 0))
    top = dict(sorted_motifs[: args.n])
    total_alpha = sum(m.get("alpha", 0) for m in pwms.values())
    kept_alpha = sum(m.get("alpha", 0) for m in top.values())

    print(f"  Kept top {args.n}/{len(pwms)} motifs:")
    for name, m in top.items():
        print(f"    {name}: length={m['length']:>2}, alpha={m.get('alpha', 0):.4f}")
    print(f"  Alpha coverage: {kept_alpha:.4f} / {total_alpha:.4f} "
          f"= {kept_alpha / total_alpha * 100:.1f}%")

    args.output.write_text(json.dumps(top, indent=2))
    print(f"  Wrote {args.output}")


if __name__ == "__main__":
    main()
