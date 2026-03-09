#!/usr/bin/env python3
"""Download ENCODE histone ChIP-seq replicated peak files (GRCh38).


Queries the ENCODE REST API to find the best available replicated peak files
for each (mark, cell_type) combination, then downloads them.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request
import urllib.parse
import gzip
import shutil
from pathlib import Path

OUTDIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/Users/zbb2/Desktop/PolymerGenomicsAPI/data/encode/histone")
OUTDIR.mkdir(parents=True, exist_ok=True)

MARKS_NARROW = ["H3K4me3", "H3K27ac", "H3K4me1"]
MARKS_BROAD = ["H3K27me3", "H3K9me3", "H3K36me3"]
CELL_TYPES = ["GM12878", "K562", "H1"]  # H1 = H1-hESC in ENCODE

ENCODE_BASE = "https://www.encodeproject.org"


def encode_search(mark: str, cell_type: str) -> list[dict]:
    """Search ENCODE for histone ChIP-seq experiments."""
    params = {
        "type": "Experiment",
        "assay_title": "Histone ChIP-seq",
        "biosample_ontology.term_name": cell_type,
        "target.label": mark,
        "assembly": "GRCh38",
        "status": "released",
        "format": "json",
        "limit": "5",
    }
    url = f"{ENCODE_BASE}/search/?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return data.get("@graph", [])


def get_experiment_files(exp_accession: str) -> list[dict]:
    """Get all files for an experiment."""
    url = f"{ENCODE_BASE}/experiments/{exp_accession}/?format=json"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return data.get("files", [])


def find_best_peak_file(files: list[dict], prefer_narrow: bool = True) -> dict | None:
    """Find the best replicated peak file from experiment files.

    Priority:
    1. replicated peaks (bed narrowPeak or bed broadPeak)
    2. pseudoreplicated peaks
    3. any peaks
    """
    candidates = []
    for f in files:
        if isinstance(f, str):
            continue
        if f.get("status") != "released":
            continue
        if f.get("assembly") != "GRCh38":
            continue

        ft = f.get("file_type", "")
        ot = f.get("output_type", "")

        if "peak" not in ot.lower():
            continue
        if "bigBed" in ft:
            continue

        # Score by preference
        score = 0
        if "replicated peaks" in ot:
            score = 3
        elif "pseudoreplicated peaks" in ot:
            score = 2
        elif "peaks" in ot:
            score = 1

        # Prefer narrowPeak for active marks, broadPeak for repressive
        if prefer_narrow and "narrowPeak" in ft:
            score += 0.5
        elif not prefer_narrow and "broadPeak" in ft:
            score += 0.5

        candidates.append((score, f))

    if not candidates:
        return None

    candidates.sort(key=lambda x: -x[0])
    return candidates[0][1]


def download_file(accession: str, outpath: Path) -> bool:
    """Download an ENCODE file by accession."""
    url = f"{ENCODE_BASE}/files/{accession}/@@download/{accession}.bed.gz"
    gz_path = outpath.with_suffix(outpath.suffix + ".gz")

    print(f"    Downloading {url}")
    try:
        urllib.request.urlretrieve(url, gz_path)
    except Exception as e:
        print(f"    ERROR: {e}")
        return False

    # Decompress
    try:
        with gzip.open(gz_path, 'rb') as f_in:
            with open(outpath, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        gz_path.unlink()
    except Exception:
        # Maybe not gzipped, just rename
        gz_path.rename(outpath)

    return outpath.exists()


def main():
    all_marks = MARKS_NARROW + MARKS_BROAD
    total = len(all_marks) * len(CELL_TYPES)
    downloaded = 0

    print(f"Downloading ENCODE histone peaks to {OUTDIR}")
    print(f"{'='*60}")

    for cell_type in CELL_TYPES:
        cell_label = "H1-hESC" if cell_type == "H1" else cell_type

        for mark in all_marks:
            prefer_narrow = mark in MARKS_NARROW
            peak_ext = "narrowPeak" if prefer_narrow else "broadPeak"
            outfile = OUTDIR / f"{mark}_{cell_label}.{peak_ext}"

            if outfile.exists():
                lines = sum(1 for _ in open(outfile))
                print(f"  SKIP: {outfile.name} ({lines:,} peaks)")
                downloaded += 1
                continue

            # Also check narrowPeak for broad marks (some experiments use narrowPeak for all)
            alt_ext = "narrowPeak" if peak_ext == "broadPeak" else "broadPeak"
            alt_file = OUTDIR / f"{mark}_{cell_label}.{alt_ext}"
            if alt_file.exists():
                lines = sum(1 for _ in open(alt_file))
                print(f"  SKIP: {alt_file.name} ({lines:,} peaks)")
                downloaded += 1
                continue

            print(f"\n  {mark} / {cell_label}:")

            # Find experiments
            experiments = encode_search(mark, cell_type)
            if not experiments:
                # Try with "H1-hESC" explicitly
                if cell_type == "H1":
                    experiments = encode_search(mark, "H1-hESC")
                if not experiments:
                    print(f"    WARNING: No experiments found")
                    continue

            # Try each experiment until we find a suitable file
            found = False
            for exp in experiments:
                exp_acc = exp.get("accession", "")
                print(f"    Trying experiment {exp_acc}...")

                files = get_experiment_files(exp_acc)
                best = find_best_peak_file(files, prefer_narrow=prefer_narrow)

                if best:
                    acc = best["accession"]
                    ft = best.get("file_type", "")
                    ot = best.get("output_type", "")

                    # Determine actual extension from file_type
                    if "narrowPeak" in ft:
                        actual_ext = "narrowPeak"
                    elif "broadPeak" in ft:
                        actual_ext = "broadPeak"
                    else:
                        actual_ext = peak_ext

                    actual_outfile = OUTDIR / f"{mark}_{cell_label}.{actual_ext}"
                    print(f"    Found: {acc} ({ot}, {ft})")

                    if download_file(acc, actual_outfile):
                        lines = sum(1 for _ in open(actual_outfile))
                        print(f"    -> {actual_outfile.name}: {lines:,} peaks")
                        downloaded += 1
                        found = True
                        break
                    else:
                        print(f"    Download failed, trying next experiment...")

            if not found:
                print(f"    ERROR: Could not find/download peaks for {mark} / {cell_label}")

    print(f"\n{'='*60}")
    print(f"Downloaded {downloaded}/{total} files")
    print(f"\nFiles in {OUTDIR}:")
    for f in sorted(OUTDIR.iterdir()):
        if f.name.startswith('.'):
            continue
        size_kb = f.stat().st_size / 1024
        print(f"  {f.name:40s} {size_kb:8.0f} KB")


if __name__ == "__main__":
    main()
