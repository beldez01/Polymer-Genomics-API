"""Step 01: Assemble per-subject-allele rows from GEUVADIS TSV.

Reads the Aguiar/HLApers reanalysis quantification file and produces a filtered CSV
with columns: subject, locus, allele_3field, allele_2field, est_counts, tpm.

Output: pytorch_model/cache/geuvadis_rows.csv
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

# Add project root to path so we can import from pytorch_model
sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from internal.InSilico.exp26_hla_allele_diversity.pytorch_model import config


def two_field(allele: str) -> str:
    """Convert 'A*01:01:01' → 'A*01:01'."""
    locus, rest = allele.split("*")
    parts = rest.split(":")
    return f"{locus}*{':'.join(parts[:2])}"


def main() -> None:
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    output_path = config.CACHE_DIR / "geuvadis_rows.csv"
    kept = 0
    skipped = 0

    with open(config.GEUVADIS_TSV) as fin, open(output_path, "w", newline="") as fout:
        reader = csv.DictReader(fin, delimiter="\t")
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

        for row in reader:
            locus_full = row["locus"]  # e.g. HLA-A
            if not locus_full.startswith("HLA-"):
                skipped += 1
                continue
            locus = locus_full.replace("HLA-", "")
            if locus not in config.LOCI:
                skipped += 1
                continue

            allele_3f = row["allele"].replace("IMGT_", "")
            try:
                allele_2f = two_field(allele_3f)
            except ValueError:
                skipped += 1
                continue

            writer.writerow(
                {
                    "subject": row["subject"],
                    "locus": locus,
                    "allele_3field": allele_3f,
                    "allele_2field": allele_2f,
                    "est_counts": row["est_counts"],
                    "tpm": row["tpm"],
                }
            )
            kept += 1

    print(f"Wrote {kept} rows to {output_path}")
    print(f"Skipped {skipped} rows (non-classical loci or parse errors)")


if __name__ == "__main__":
    main()
