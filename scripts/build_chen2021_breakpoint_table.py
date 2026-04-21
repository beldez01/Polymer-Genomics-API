"""Build the unified Chen 2021 breakpoint table from per-tissue hotspot CSVs.

Input: data/cancer_breakpoints_chen2021/raw/hsp_all_<tissue>.csv — Chen 2021
publishes coordinates in **hg19** (verified via filter_bins.R in their repo
which calls get_chr_windows_hg19()). This script lifts to hg38 via pyliftover.

Each input row's `target='X1'` marks a breakpoint hotspot window at 100 kb
resolution with 30 train-test repeats.

Output: data/cancer_breakpoints_chen2021/breakpoints_hg38.tsv
    Columns: chrom, start, end, sv_type, recurrence_count, tumor_types, sample_id
    - chrom, start, end: hg38 coordinates after liftOver
    - sv_type: 'BKP' (Chen 2021 aggregates DEL/DUP/INV/TRA at window level)
    - recurrence_count: number of distinct tissues in which the window is positive
    - tumor_types: pipe-separated list of tissues
    - sample_id: 'Chen2021:hg19_<chr>:<hg19_start>'  (preserves source coordinate)

Note: liftOver may drop windows that fall in hg19→hg38 gaps. Reported per tissue.
"""

from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path("data/cancer_breakpoints_chen2021")
RAW_DIR = ROOT / "raw"
OUT = ROOT / "breakpoints_hg38.tsv"

TISSUES = ["blood", "bone", "brain", "breast", "liver",
           "ovary", "pancreatic", "prostate", "skin", "uterus"]


def parse_tissue(path: Path) -> set[tuple[str, int, int]]:
    """Return unique (chr, from, to) windows with target=X1 in this file (hg19)."""
    out: set[tuple[str, int, int]] = set()
    with open(path) as fh:
        reader = csv.reader(fh)
        header = next(reader)
        idx_chr = header.index("chr")
        idx_from = header.index("from")
        idx_to = header.index("to")
        idx_target = header.index("target")
        for row in reader:
            if row[idx_target] != "X1":
                continue
            chrom_raw = row[idx_chr].strip().strip('"')
            try:
                start = int(float(row[idx_from]))
                end = int(float(row[idx_to]))
            except ValueError:
                continue
            chrom = chrom_raw if chrom_raw.startswith("chr") else f"chr{chrom_raw}"
            out.add((chrom, start, end))
    return out


def lift_window(lo, chrom_hg19: str, start_hg19: int, end_hg19: int):
    """Lift one (chr, start, end) window from hg19 to hg38.

    Returns (hg38_chrom, hg38_start, hg38_end) or None if either end fails.
    Uses 0-based liftOver coordinates internally; converts back to 1-based closed.
    """
    a = lo.convert_coordinate(chrom_hg19, start_hg19 - 1)  # 1-based → 0-based
    b = lo.convert_coordinate(chrom_hg19, end_hg19 - 1)
    if not a or not b:
        return None
    chrom_a, pos_a, *_ = a[0]
    chrom_b, pos_b, *_ = b[0]
    if chrom_a != chrom_b:
        return None  # window crosses chromosomes after lift — drop
    if pos_b - pos_a > 200_000 or pos_b - pos_a < 50_000:
        return None  # 100 kb window stretched/compressed implausibly — drop
    return (chrom_a, min(pos_a, pos_b) + 1, max(pos_a, pos_b) + 1)


def main() -> None:
    if not RAW_DIR.exists():
        sys.exit(f"  raw dir missing: {RAW_DIR}")

    from pyliftover import LiftOver
    print("  Loading hg19→hg38 chain (~60 MB)…")
    lo = LiftOver("hg19", "hg38")

    tissue_windows: dict[str, set[tuple[str, int, int]]] = {}
    for tissue in TISSUES:
        path = RAW_DIR / f"hsp_all_{tissue}.csv"
        if not path.exists():
            print(f"  [SKIP] {tissue}: file missing")
            continue
        windows = parse_tissue(path)
        tissue_windows[tissue] = windows
        print(f"  {tissue:>10}: {len(windows):>6} unique breakpoint windows (hg19)")

    # Aggregate hg19 windows
    window_tissues_hg19: dict[tuple[str, int, int], list[str]] = defaultdict(list)
    for tissue, windows in tissue_windows.items():
        for w in windows:
            window_tissues_hg19[w].append(tissue)
    print(f"\n  Total unique hg19 windows across all tissues: {len(window_tissues_hg19):,}")

    # Lift to hg38
    print("\n  Lifting hg19 → hg38…")
    window_tissues: dict[tuple[str, int, int], dict] = {}
    n_lifted = 0
    n_dropped = 0
    for hg19_key, tissues in window_tissues_hg19.items():
        chrom_hg19, start_hg19, end_hg19 = hg19_key
        lifted = lift_window(lo, chrom_hg19, start_hg19, end_hg19)
        if lifted is None:
            n_dropped += 1
            continue
        n_lifted += 1
        window_tissues[lifted] = {"tissues": tissues, "hg19": hg19_key}
    print(f"  Lifted: {n_lifted:,} | Dropped (gap/cross-chr/length-anomaly): {n_dropped:,}")

    # Recurrence distribution
    rec_dist = defaultdict(int)
    for entry in window_tissues.values():
        rec_dist[len(entry["tissues"])] += 1
    print("  Recurrence (n_tissues -> n_windows):")
    for k in sorted(rec_dist):
        print(f"    {k} tissue{'s' if k > 1 else ''}: {rec_dist[k]:,}")

    # Write TSV — sort by chrom, start
    def chr_key(c: str) -> int:
        c = c.replace("chr", "")
        if c == "X": return 23
        if c == "Y": return 24
        if c.isdigit(): return int(c)
        return 99
    rows = sorted(window_tissues.items(), key=lambda kv: (chr_key(kv[0][0]), kv[0][1]))

    with open(OUT, "w") as fh:
        fh.write("chrom\tstart\tend\tsv_type\trecurrence_count\ttumor_types\tsample_id\n")
        for (chrom, start, end), entry in rows:
            hg19_chrom, hg19_start, _ = entry["hg19"]
            fh.write("\t".join([
                chrom, str(start), str(end), "BKP",
                str(len(entry["tissues"])),
                "|".join(sorted(entry["tissues"])),
                f"Chen2021:hg19_{hg19_chrom}:{hg19_start}",
            ]) + "\n")

    print(f"\n  Wrote {len(rows):,} hg38 rows to {OUT}")


if __name__ == "__main__":
    main()
