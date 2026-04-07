#!/usr/bin/env python3
"""Recompute 1kb biophysics BigWig tracks from corrected parameters.

Reads hg38 FASTA, computes all biophysical properties per 1kb window using
the corrected Olson 2001 structural parameters and trajectory-integrated
curvature formula, and writes BigWig files for ingestion.

Replaces tracks that were computed with chimeric LLM-generated structural
parameters (identified 2026-04-06 validation audit).

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python scripts/recompute_biophysics_tracks.py

Output: scripts/recomputed_tracks/*.bw (7 files)
"""

from __future__ import annotations

import math
import os
import sys
import time
from pathlib import Path

import numpy as np
import pyBigWig
from pyfaidx import Fasta

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from polymer_genomics.biophysics import (
    _NN_PARAMS,
    _OLSON_STRUCTURAL,
    _TRX_DEFORMABILITY,
)
from polymer_genomics.ingest.reference_constants import _GROOVE_GEOMETRY

FASTA_PATH = PROJECT_ROOT / "data" / "hg38.fa"
OUTPUT_DIR = PROJECT_ROOT / "scripts" / "recomputed_tracks"
WINDOW = 1000

# Chromosomes to process (autosomes + X)
CHROMS = [f"chr{i}" for i in range(1, 23)] + ["chrX"]

DEG2RAD = math.pi / 180.0


def compute_window(seq: str) -> dict | None:
    """Compute all biophysical properties for a 1kb window."""
    seq = seq.upper()
    n = len(seq)
    if n < 100:
        return None

    # Count valid bases
    valid = sum(1 for c in seq if c in "ACGT")
    if valid < n * 0.5:
        return None  # too many N's

    # GC content
    gc = sum(1 for c in seq if c in "GC") / valid if valid > 0 else 0.0

    # Per-step accumulators
    dg_sum = 0.0
    dh_sum = 0.0
    ds_sum = 0.0
    roll_vals = []
    tilt_vals = []
    twist_vals = []
    groove_vals = []  # minor groove width
    deform_vals = []
    n_steps = 0

    for i in range(n - 1):
        dinuc = seq[i:i + 2]

        nn = _NN_PARAMS.get(dinuc)
        if nn:
            dg_sum += nn["delta_g_37"]
            dh_sum += nn["delta_h"]
            ds_sum += nn["delta_s"]
            n_steps += 1

        struct = _OLSON_STRUCTURAL.get(dinuc)
        if struct:
            roll_vals.append(struct["roll"])
            tilt_vals.append(struct["tilt"])
            twist_vals.append(struct["twist"])

        groove = _GROOVE_GEOMETRY.get(dinuc)
        if groove:
            groove_vals.append(groove[2])  # minor groove width

        trx = _TRX_DEFORMABILITY.get(dinuc)
        if trx is not None:
            deform_vals.append(float(trx))

    if n_steps == 0:
        return None

    mean_dg = dg_sum / n_steps
    mean_dh = dh_sum / n_steps
    mean_ds = ds_sum / n_steps

    # Melting temperature (simplified SantaLucia: Tm ≈ ΔH / (ΔS + R × ln(Ct/4)) - 273.15)
    # For genome-wide 1kb windows, use the per-step approach:
    # Tm estimate from mean ΔH and ΔS (at 1M NaCl, Ct cancels for relative ranking)
    if mean_ds != 0:
        tm = (mean_dh * 1000.0) / mean_ds - 273.15  # rough per-step Tm
    else:
        tm = 0.0

    # Curvature: trajectory-integrated wedge model
    if len(roll_vals) > 1:
        roll_arr = np.array(roll_vals) * DEG2RAD
        tilt_arr = np.array(tilt_vals) * DEG2RAD
        twist_arr = np.array(twist_vals) * DEG2RAD
        cum_twist = np.cumsum(twist_arr)

        dx = roll_arr * np.cos(cum_twist) - tilt_arr * np.sin(cum_twist)
        dy = roll_arr * np.sin(cum_twist) + tilt_arr * np.cos(cum_twist)

        # Global curvature over the full window
        total_dx = np.sum(dx)
        total_dy = np.sum(dy)
        curvature = math.sqrt(total_dx ** 2 + total_dy ** 2) / len(roll_arr) / DEG2RAD
    else:
        curvature = 0.0

    # Minor groove width
    mean_groove = sum(groove_vals) / len(groove_vals) if groove_vals else 5.5

    # Dipole density (charge asymmetry proxy from AT/GC content gradient)
    # Simple model: AT-rich regions have larger minor groove → higher dipole
    dipole = (1.0 - gc) * 3.4  # proportional to AT fraction × helix rise

    # Periodicity: 10.5bp AA/TT signal via FFT
    aa_signal = np.zeros(n - 1)
    for i in range(n - 1):
        dinuc = seq[i:i + 2]
        if dinuc in ("AA", "TT", "AT", "TA"):
            aa_signal[i] = 1.0

    period_power = 0.0
    if len(aa_signal) >= 32:
        fft = np.fft.rfft(aa_signal - aa_signal.mean())
        freqs = np.fft.rfftfreq(len(aa_signal))
        target_freq = 1.0 / 10.5
        idx = np.argmin(np.abs(freqs - target_freq))
        power = np.abs(fft) ** 2
        total_power = power.sum()
        period_power = float(power[idx] / total_power) if total_power > 0 else 0.0

    return {
        "gc_content": round(gc, 6),
        "stacking_dg37": round(mean_dg, 4),
        "melting_temp": round(tm, 2),
        "curvature": round(curvature, 6),
        "groove_width": round(mean_groove, 3),
        "dipole_density": round(dipole, 4),
        "periodicity_power": round(period_power, 6),
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Loading FASTA from {FASTA_PATH}...")
    fa = Fasta(str(FASTA_PATH))

    # Get chromosome sizes
    chrom_sizes = []
    for chrom in CHROMS:
        if chrom in fa:
            chrom_sizes.append((chrom, len(fa[chrom])))

    print(f"Processing {len(chrom_sizes)} chromosomes, {WINDOW}bp windows")

    # Track names and data
    track_names = ["gc_content", "stacking_dg37", "melting_temp", "curvature",
                   "groove_width", "dipole_density", "periodicity_power"]

    # Open BigWig writers
    bw_writers = {}
    for track in track_names:
        path = OUTPUT_DIR / f"{track}.bw"
        bw = pyBigWig.open(str(path), "w")
        bw.addHeader([(c, s) for c, s in chrom_sizes])
        bw_writers[track] = bw

    total_windows = 0
    total_skipped = 0
    t0 = time.time()

    for chrom, chrom_len in chrom_sizes:
        print(f"\n  {chrom} ({chrom_len:,} bp)...", end="", flush=True)

        # Collect all windows for this chromosome
        starts, ends = [], []
        values_per_track = {t: [] for t in track_names}
        chrom_windows = 0

        for start in range(0, chrom_len - WINDOW + 1, WINDOW):
            end = start + WINDOW
            seq = str(fa[chrom][start:end])

            props = compute_window(seq)
            if props is None:
                total_skipped += 1
                continue

            starts.append(start)
            ends.append(end)
            for track in track_names:
                values_per_track[track].append(float(props[track]))

            chrom_windows += 1

        # Write all windows for this chromosome in one batch
        for track in track_names:
            if starts:
                bw_writers[track].addEntries(
                    [chrom] * len(starts),
                    starts,
                    ends=ends,
                    values=values_per_track[track],
                )

        total_windows += chrom_windows
        elapsed = time.time() - t0
        rate = total_windows / elapsed if elapsed > 0 else 0
        print(f" {chrom_windows:,} windows ({rate:.0f} win/s)", flush=True)

    # Close all writers
    for bw in bw_writers.values():
        bw.close()

    elapsed = time.time() - t0
    print(f"\n{'═' * 60}")
    print(f"DONE: {total_windows:,} windows computed, {total_skipped:,} skipped")
    print(f"Time: {elapsed:.1f}s ({total_windows / elapsed:.0f} windows/s)")
    print(f"Output: {OUTPUT_DIR}/")
    for track in track_names:
        path = OUTPUT_DIR / f"{track}.bw"
        size_mb = path.stat().st_size / 1e6
        print(f"  {track}.bw ({size_mb:.1f} MB)")
    print(f"{'═' * 60}")
    print(f"\nNext: ingest with:")
    print(f"  uv run python -m polymer_genomics.ingest.biophysics_tracks \\")
    print(f"    --data-dir {OUTPUT_DIR} --build hg38")


if __name__ == "__main__":
    main()
