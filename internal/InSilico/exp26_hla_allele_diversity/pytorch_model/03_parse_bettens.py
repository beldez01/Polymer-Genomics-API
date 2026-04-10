"""Step 03: Parse Bettens semicolon-delimited TSV into same row format as GEUVADIS.

Output: pytorch_model/cache/bettens_rows.csv
Columns: subject, locus, allele_3field, allele_2field, est_counts, tpm

Note: Bettens alleles are already 2-field, so allele_3field == allele_2field.
est_counts is not provided, set to empty string.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from internal.InSilico.exp26_hla_allele_diversity.pytorch_model import config


def main() -> None:
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    output_path = config.CACHE_DIR / "bettens_rows.csv"
    kept = 0
    skipped = 0

    with open(config.BETTENS_TSV) as fin, open(output_path, "w", newline="") as fout:
        writer = csv.DictWriter(
            fout,
            fieldnames=[
                "subject",
                "locus",
                "allele_3field",
                "allele_2field",
                "est_counts",
                "tpm",
            ],
        )
        writer.writeheader()

        header_seen = False
        for line in fin:
            line = line.strip()
            if not line:
                continue
            parts = line.split(";")
            if not header_seen:
                header_seen = True
                # Verify header format
                if parts != ["subject", "locus", "allele", "tpm"]:
                    print(f"WARNING: unexpected header: {parts}")
                continue

            if len(parts) < 4:
                skipped += 1
                continue

            subject, locus_full, allele, tpm = parts[0], parts[1], parts[2], parts[3]
            locus = locus_full.replace("HLA-", "")
            if locus not in config.LOCI:
                skipped += 1
                continue

            writer.writerow(
                {
                    "subject": subject,
                    "locus": locus,
                    "allele_3field": allele,
                    "allele_2field": allele,
                    "est_counts": "",
                    "tpm": tpm,
                }
            )
            kept += 1

    print(f"Wrote {kept} rows to {output_path}")
    print(f"Skipped {skipped} rows")


if __name__ == "__main__":
    main()
