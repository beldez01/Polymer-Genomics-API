"""Scan hg38 reference for Myers 2008/2010 PRDM9 13-mer motif matches.

Produces a gzipped BED-like file with one row per thresholded hit:
    chrom    start    end    allele    log_odds    strand

Consumed by `polymer_genomics.ingest.prdm9_motifs::_load_myers_pwm_hits`.

Usage::

    uv run python scripts/scan_prdm9_pwm.py \\
        --pwm data/prdm9_catalog/myers_2008/prdm9_13mer_pwm.json \\
        --fasta data/reference/hg38.fa \\
        --out data/prdm9_catalog/myers_2008/prdm9_pwm_hits_hg38.bed.gz \\
        --threshold 8.0

Input PWM JSON schema::

    {
      "A": {"matrix": [[...], [...], [...], [...]], "length": 13},
      "B": {...},
      "C": {...}
    }

`matrix` is 4×L with row order A, C, G, T. Values may be:
  - **log-odds** (the standard PWM), or
  - **position probabilities** (each column sums to ~1.0)

Auto-detected: if any column sums to 0.95–1.05, treated as PPM and converted to
log-odds using uniform background (0.25 per base). A pseudocount of 0.01 is added
to zero probabilities before the log to avoid -inf.

Performance: pyfaidx for FASTA streaming, numpy vectorized scan. Full human
genome scan for one allele takes ~2 min on a modern laptop.
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
from pathlib import Path

import numpy as np
from pyfaidx import Fasta

# A, C, G, T → 0, 1, 2, 3; anything else (N, etc.) → 4 (sentinel)
_BASE_TO_IDX = np.full(256, 4, dtype=np.uint8)
_BASE_TO_IDX[ord("A")] = 0
_BASE_TO_IDX[ord("a")] = 0
_BASE_TO_IDX[ord("C")] = 1
_BASE_TO_IDX[ord("c")] = 1
_BASE_TO_IDX[ord("G")] = 2
_BASE_TO_IDX[ord("g")] = 2
_BASE_TO_IDX[ord("T")] = 3
_BASE_TO_IDX[ord("t")] = 3

# Complement for reverse-strand scan: A↔T, C↔G
_COMPLEMENT_IDX = np.array([3, 2, 1, 0], dtype=np.uint8)

_BACKGROUND = np.array([0.25, 0.25, 0.25, 0.25])
_PSEUDOCOUNT = 0.01


def load_pwm(path: Path) -> dict[str, np.ndarray]:
    """Load PWM JSON → dict of allele → (4, L) log-odds matrix."""
    with open(path) as fh:
        raw = json.load(fh)

    pwms: dict[str, np.ndarray] = {}
    for allele, payload in raw.items():
        matrix = np.asarray(payload["matrix"], dtype=np.float64)
        expected_length = payload.get("length", matrix.shape[1])
        if matrix.shape[0] != 4 or matrix.shape[1] != expected_length:
            raise ValueError(
                f"Allele {allele}: matrix shape {matrix.shape} does not match "
                f"4 × {expected_length}"
            )

        # Auto-detect PPM vs PWM
        column_sums = matrix.sum(axis=0)
        if np.all(np.abs(column_sums - 1.0) < 0.05):
            # Probability matrix → convert to log-odds w.r.t. uniform background
            matrix = np.where(matrix < _PSEUDOCOUNT, _PSEUDOCOUNT, matrix)
            matrix = np.log2(matrix / _BACKGROUND[:, None])
            print(f"  Allele {allele}: PPM detected, converted to log-odds")
        else:
            print(f"  Allele {allele}: log-odds PWM detected (column sums {column_sums[:3]}...)")

        pwms[allele] = matrix
    return pwms


def reverse_complement_pwm(pwm: np.ndarray) -> np.ndarray:
    """Reverse-complement a 4×L PWM.

    For reverse-strand scanning: flip columns (3'→5') and swap A↔T, C↔G rows.
    """
    return pwm[::-1, ::-1]


def scan_chromosome(
    seq: str,
    pwms: dict[str, np.ndarray],
    threshold: float,
) -> list[tuple[int, int, str, float, str]]:
    """Scan one chromosome sequence for PWM hits above threshold.

    Returns list of (start_0based, end_0based, allele, log_odds, strand).
    """
    # One-hot → index array, 4 = invalid
    seq_bytes = np.frombuffer(seq.encode("ascii"), dtype=np.uint8)
    seq_idx = _BASE_TO_IDX[seq_bytes]  # length N
    n = seq_idx.shape[0]

    hits: list[tuple[int, int, str, float, str]] = []

    for allele, pwm_fwd in pwms.items():
        motif_len = pwm_fwd.shape[1]
        if n < motif_len:
            continue
        pwm_rev = reverse_complement_pwm(pwm_fwd)

        # Build an array of (motif_len, N - motif_len + 1) where
        # position [l, i] = index of base at seq_idx[i + l]
        # Then PWM lookup: score[i] = sum over l of pwm[seq_idx[i+l], l]
        n_windows = n - motif_len + 1

        # Mask for windows containing any invalid base (idx == 4)
        # A window is invalid if max over l of (seq_idx[i+l] == 4) is True.
        # Compute via cumulative sum of invalid flags.
        invalid_flag = (seq_idx == 4).astype(np.uint32)
        cum = np.concatenate([[0], np.cumsum(invalid_flag)])
        invalid_count = cum[motif_len:] - cum[: n - motif_len + 1]
        valid_mask = invalid_count == 0

        # For valid windows: compute score by lookup
        # Clamp seq_idx to 0-3 for safe indexing of pwm (invalid windows masked out later)
        safe_idx = np.minimum(seq_idx, 3)

        for pwm, strand in ((pwm_fwd, "+"), (pwm_rev, "-")):
            # Vectorized score: sum across motif positions
            # score[i] = pwm[safe_idx[i], 0] + pwm[safe_idx[i+1], 1] + ... + pwm[safe_idx[i+L-1], L-1]
            scores = np.zeros(n_windows, dtype=np.float64)
            for l in range(motif_len):
                scores += pwm[safe_idx[l : l + n_windows], l]

            # Apply validity mask + threshold
            scores[~valid_mask] = -np.inf
            hit_positions = np.where(scores >= threshold)[0]
            for pos in hit_positions:
                hits.append((
                    int(pos),
                    int(pos + motif_len),
                    allele,
                    float(scores[pos]),
                    strand,
                ))
    return hits


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--pwm", required=True, type=Path, help="PWM JSON input")
    parser.add_argument("--fasta", required=True, type=Path, help="hg38 reference FASTA")
    parser.add_argument("--out", required=True, type=Path, help="Output gzipped BED")
    parser.add_argument("--threshold", type=float, default=8.0,
                        help="Log-odds threshold (default 8.0 per Altemose 2017)")
    parser.add_argument("--chroms", nargs="*", default=None,
                        help="Restrict to these chromosomes (e.g. chr1 chr2); default all 1-22 + X + Y")
    args = parser.parse_args()

    pwms = load_pwm(args.pwm)
    print(f"  Loaded {len(pwms)} allele PWMs: {list(pwms.keys())}")
    for allele, mat in pwms.items():
        print(f"    {allele}: shape {mat.shape}, max {mat.max():.2f}, min {mat.min():.2f}")

    fasta = Fasta(str(args.fasta), as_raw=True, sequence_always_upper=True)

    if args.chroms:
        chrom_list = args.chroms
    else:
        chrom_list = [f"chr{i}" for i in range(1, 23)] + ["chrX", "chrY"]

    args.out.parent.mkdir(parents=True, exist_ok=True)

    total_hits = 0
    t0 = time.time()
    with gzip.open(args.out, "wt") as fh:
        fh.write("#chrom\tstart\tend\tallele\tlog_odds\tstrand\n")
        for chrom in chrom_list:
            if chrom not in fasta:
                print(f"  [WARN] {chrom} not in FASTA, skipping", file=sys.stderr)
                continue

            t_chr = time.time()
            seq = str(fasta[chrom])
            hits = scan_chromosome(seq, pwms, args.threshold)
            hits.sort(key=lambda h: (h[0], h[2]))

            for start, end, allele, log_odds, strand in hits:
                fh.write(f"{chrom}\t{start}\t{end}\t{allele}\t{log_odds:.3f}\t{strand}\n")

            total_hits += len(hits)
            print(f"  {chrom}: {len(hits)} hits "
                  f"({time.time() - t_chr:.1f}s, {len(seq) / 1e6:.0f} Mb)", flush=True)

    elapsed = time.time() - t0
    print(f"\n  Wrote {total_hits} hits to {args.out} in {elapsed:.1f}s")

    # Provenance sidecar
    provenance = args.out.with_suffix(".provenance.json")
    with open(provenance, "w") as fh:
        json.dump({
            "pwm_source": str(args.pwm),
            "fasta_source": str(args.fasta),
            "threshold_log_odds": args.threshold,
            "alleles_scanned": list(pwms.keys()),
            "chroms_scanned": chrom_list,
            "total_hits": total_hits,
            "elapsed_seconds": elapsed,
        }, fh, indent=2)
    print(f"  Wrote provenance to {provenance}")


if __name__ == "__main__":
    main()
