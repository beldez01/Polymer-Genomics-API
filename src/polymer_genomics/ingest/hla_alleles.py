"""IPD-IMGT/HLA allele sequence ingestion with biophysics computation.

Downloads genomic FASTA files from the IPD-IMGT/HLA GitHub repository,
parses allele sequences and feature boundaries (exons/introns/UTRs),
computes biophysical properties using the Polymer Genomics engine, and
bulk-loads into the hla schema.

The 6 transplant-relevant loci:
  HLA-A, HLA-B, HLA-C (class I)
  HLA-DRB1, HLA-DQB1, HLA-DPB1 (class II)

Reference: Bettens et al. 2022 (PLOS Genetics) — non-coding cis-eQTLs
explain 13-50% of HLA class I expression variance.

Usage::

    uv run python -m polymer_genomics.ingest.hla_alleles
    uv run python -m polymer_genomics.ingest.hla_alleles --locus HLA-A
    uv run python -m polymer_genomics.ingest.hla_alleles --locus HLA-A --skip-download
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import math
import re
import urllib.request
from pathlib import Path

import asyncpg

from polymer_genomics.biophysics import (
    compute_thermodynamics,
    compute_form_propensity,
    compute_groove_profile,
)
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ─────────────────────────────────────────────────────────────────

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "imgt_hla"

# 6 transplant-relevant loci
TRANSPLANT_LOCI: dict[str, int] = {
    "A": 1,
    "B": 1,
    "C": 1,
    "DRB1": 2,
    "DQB1": 2,
    "DPB1": 2,
}

# Gene structure: number of exons per class
CLASS_I_EXONS = 8    # exons 1-8, introns 1-7
CLASS_II_EXONS = 6   # exons 1-6, introns 1-5

IMGT_BASE_URL = "https://raw.githubusercontent.com/ANHIG/IMGTHLA/Latest"

BATCH_SIZE = 2_000

# Minimum sequence length for evaluate_sequence (from evaluate.py)
MIN_SEQ_LENGTH = 10


# ── Allele name parsing ──────────────────────────────────────────────────────


def parse_allele_name(raw_name: str) -> dict:
    """Parse an HLA allele name into its components.

    Examples:
        'A*01:01:01:01'  -> locus='HLA-A', group='01', protein='01', syn='01', nc='01'
        'A*02:01:01:02N' -> locus='HLA-A', ..., expression_suffix='N'
        'DRB1*01:01'     -> locus='HLA-DRB1', group='01', protein='01'
    """
    name = raw_name.strip()

    # Strip expression suffix
    expression_suffix = None
    if name and name[-1] in "NLSCAQ":
        expression_suffix = name[-1]
        name = name[:-1]

    # Split locus from fields
    if "*" not in name:
        raise ValueError(f"Invalid allele name (no '*'): {raw_name}")

    locus_part, fields_str = name.split("*", 1)
    fields = fields_str.split(":")

    # Normalize locus to HLA- prefix
    locus = locus_part if locus_part.startswith("HLA-") else f"HLA-{locus_part}"

    # Determine class
    locus_short = locus.replace("HLA-", "")
    hla_class = TRANSPLANT_LOCI.get(locus_short, 1 if locus_short in ("A", "B", "C", "E", "F", "G") else 2)

    return {
        "allele_name": raw_name.strip(),
        "locus": locus,
        "allele_group": fields[0] if len(fields) > 0 else "",
        "protein": fields[1] if len(fields) > 1 else "",
        "synonymous": fields[2] if len(fields) > 2 else None,
        "noncoding": fields[3] if len(fields) > 3 else None,
        "hla_class": hla_class,
        "expression_suffix": expression_suffix,
    }


# ── FASTA parsing ────────────────────────────────────────────────────────────


def parse_gen_fasta(fasta_path: Path) -> list[dict]:
    """Parse an IMGT/HLA genomic FASTA file.

    Header format: >HLA:HLA00001 A*01:01:01:01 3503 bp

    Returns list of dicts with keys: allele_name, accession, sequence, length.
    """
    alleles = []
    current_acc = None
    current_name = None
    current_seq_parts: list[str] = []

    def _flush():
        if current_name and current_seq_parts:
            seq = "".join(current_seq_parts).upper()
            alleles.append({
                "accession": current_acc,
                "allele_name": current_name,
                "sequence": seq,
                "length": len(seq),
            })

    with open(fasta_path) as f:
        for line in f:
            line = line.rstrip()
            if line.startswith(">"):
                _flush()
                current_seq_parts = []
                # Parse header: >HLA:HLA00001 A*01:01:01:01 3503 bp
                parts = line[1:].split()
                current_acc = parts[0] if parts else None
                current_name = parts[1] if len(parts) > 1 else None
            else:
                current_seq_parts.append(line.replace(" ", ""))
    _flush()

    return alleles


def parse_nuc_fasta(fasta_path: Path) -> dict[str, str]:
    """Parse IMGT/HLA CDS FASTA. Returns {allele_name: cds_sequence}."""
    result: dict[str, str] = {}
    current_name = None
    current_seq_parts: list[str] = []

    def _flush():
        if current_name and current_seq_parts:
            result[current_name] = "".join(current_seq_parts).upper()

    with open(fasta_path) as f:
        for line in f:
            line = line.rstrip()
            if line.startswith(">"):
                _flush()
                current_seq_parts = []
                parts = line[1:].split()
                current_name = parts[1] if len(parts) > 1 else None
            else:
                current_seq_parts.append(line.replace(" ", ""))
    _flush()

    return result


# ── Feature boundary extraction ──────────────────────────────────────────────


def extract_features_by_cds_alignment(
    genomic_seq: str,
    cds_seq: str | None,
    hla_class: int,
) -> list[dict]:
    """Extract exon/intron/UTR boundaries by aligning CDS to genomic sequence.

    The CDS (from _nuc.fasta) is the spliced mRNA coding sequence. By finding
    where each contiguous CDS chunk maps to the genomic sequence, we recover
    exact exon/intron boundaries.

    Returns a list of feature dicts with start_pos, end_pos (0-based half-open).
    """
    seq_len = len(genomic_seq)
    features = []

    # If no CDS available, return whole-sequence as single feature
    if not cds_seq or len(cds_seq) < 10:
        features.append({
            "feature_type": "genomic",
            "feature_number": 1,
            "feature_label": "full_genomic",
            "start_pos": 0,
            "end_pos": seq_len,
            "length_bp": seq_len,
        })
        return features

    # Walk through the CDS and find contiguous exon matches in the genomic seq
    exons: list[tuple[int, int]] = []  # (genomic_start, genomic_end)
    cds_offset = 0
    search_from = 0

    while cds_offset < len(cds_seq):
        remaining = cds_seq[cds_offset:]

        # Find the longest contiguous match starting from search_from
        # Start with a seed match (first 15bp of remaining CDS)
        seed_len = min(15, len(remaining))
        seed = remaining[:seed_len]
        match_pos = genomic_seq.find(seed, search_from)

        if match_pos < 0:
            # Try shorter seed
            seed_len = min(10, len(remaining))
            seed = remaining[:seed_len]
            match_pos = genomic_seq.find(seed, search_from)

        if match_pos < 0:
            # Can't find this chunk — bail
            break

        # Extend the match as far as it goes
        exon_start = match_pos
        match_len = seed_len
        while (match_pos + match_len < seq_len
               and cds_offset + match_len < len(cds_seq)
               and genomic_seq[match_pos + match_len] == cds_seq[cds_offset + match_len]):
            match_len += 1

        exon_end = match_pos + match_len
        exons.append((exon_start, exon_end))

        cds_offset += match_len
        search_from = exon_end

    if not exons:
        features.append({
            "feature_type": "genomic",
            "feature_number": 1,
            "feature_label": "full_genomic",
            "start_pos": 0,
            "end_pos": seq_len,
            "length_bp": seq_len,
        })
        return features

    # Build feature list: 5'UTR, then alternating exon/intron, then 3'UTR
    feat_num = 0

    # 5' UTR
    first_exon_start = exons[0][0]
    if first_exon_start > 0:
        feat_num += 1
        features.append({
            "feature_type": "5utr",
            "feature_number": feat_num,
            "feature_label": "5utr",
            "start_pos": 0,
            "end_pos": first_exon_start,
            "length_bp": first_exon_start,
        })

    for i, (ex_start, ex_end) in enumerate(exons):
        exon_idx = i + 1

        # Exon
        feat_num += 1
        features.append({
            "feature_type": "exon",
            "feature_number": feat_num,
            "feature_label": f"exon_{exon_idx}",
            "start_pos": ex_start,
            "end_pos": ex_end,
            "length_bp": ex_end - ex_start,
        })

        # Intron (gap between this exon and the next)
        if i < len(exons) - 1:
            next_start = exons[i + 1][0]
            if next_start > ex_end:
                feat_num += 1
                features.append({
                    "feature_type": "intron",
                    "feature_number": feat_num,
                    "feature_label": f"intron_{exon_idx}",
                    "start_pos": ex_end,
                    "end_pos": next_start,
                    "length_bp": next_start - ex_end,
                })

    # 3' UTR
    last_exon_end = exons[-1][1]
    if last_exon_end < seq_len:
        feat_num += 1
        features.append({
            "feature_type": "3utr",
            "feature_number": feat_num,
            "feature_label": "3utr",
            "start_pos": last_exon_end,
            "end_pos": seq_len,
            "length_bp": seq_len - last_exon_end,
        })

    return features


# ── Biophysics computation ───────────────────────────────────────────────────


def _gc_content(seq: str) -> float:
    gc = seq.count("G") + seq.count("C")
    total = len(seq) - seq.count("N")
    return gc / total if total > 0 else 0.0


def _cpg_count(seq: str) -> int:
    return sum(1 for i in range(len(seq) - 1) if seq[i] == "C" and seq[i + 1] == "G")


def _cpg_obs_exp(seq: str) -> float:
    n = len(seq)
    if n < 2:
        return 0.0
    c = seq.count("C")
    g = seq.count("G")
    cpg = _cpg_count(seq)
    exp = (c * g) / (n - 1) if (n - 1) > 0 else 0
    return cpg / exp if exp > 0 else 0.0


def _count_cpg_islands(seq: str) -> int:
    """Count CpG islands using Gardiner-Garden & Frommer criteria."""
    count = 0
    window = 200
    if len(seq) < window:
        return 0
    for i in range(0, len(seq) - window + 1, 50):
        chunk = seq[i:i + window]
        gc = _gc_content(chunk)
        oe = _cpg_obs_exp(chunk)
        if gc >= 0.50 and oe >= 0.60:
            count += 1
            # Skip forward to avoid double-counting
            break
    # Proper sliding window with merging
    islands = []
    in_island = False
    island_start = 0
    for i in range(0, len(seq) - window + 1, 10):
        chunk = seq[i:i + window]
        gc = _gc_content(chunk)
        oe = _cpg_obs_exp(chunk)
        if gc >= 0.50 and oe >= 0.60:
            if not in_island:
                island_start = i
                in_island = True
        else:
            if in_island:
                islands.append((island_start, i + window))
                in_island = False
    if in_island:
        islands.append((island_start, min(len(seq), island_start + window)))
    return len(islands)


def compute_biophysics_summary(seq: str) -> dict:
    """Compute biophysical summary for a DNA sequence.

    Returns a flat dict of biophysical metrics suitable for database storage.
    Works for any sequence length >= 2 bp.
    """
    if len(seq) < 2:
        return {}

    clean_seq = seq.replace("N", "")
    if len(clean_seq) < 2:
        return {}

    gc = _gc_content(seq)
    cpg = _cpg_count(seq)
    cpg_dens = cpg / len(seq) if len(seq) > 0 else 0.0
    cpg_oe = _cpg_obs_exp(seq)
    cpg_islands = _count_cpg_islands(seq)

    # Melting temperature estimate
    na_m = 1.0  # standard conditions
    length = len(seq)
    tm = 81.5 + 16.6 * math.log10(na_m) + 41.0 * gc - 600.0 / length if length > 0 else 0.0

    result = {
        "gc_content": round(gc, 4),
        "cpg_count": cpg,
        "cpg_density": round(cpg_dens, 5),
        "cpg_obs_exp": round(cpg_oe, 4),
        "cpg_island_count": cpg_islands,
        "melting_temp_est": round(tm, 1),
    }

    # Thermodynamics
    thermo = compute_thermodynamics(clean_seq)
    ts = thermo.get("summary", {})
    if ts.get("n_steps", 0) > 0:
        result["mean_stacking_dg37"] = round(ts["total_delta_g_37"] / ts["n_steps"], 4)

    # Form propensity
    form = compute_form_propensity(clean_seq)
    fs = form.get("summary", {})
    if fs.get("n_steps", 0) > 0:
        result["mean_a_form_prop"] = fs.get("mean_a_form_propensity")
        result["mean_z_form_prop"] = fs.get("mean_z_form_propensity")
        result["total_z_penalty"] = fs.get("total_z_penalty")

    # Groove geometry
    groove = compute_groove_profile(clean_seq)
    gs = groove.get("summary", {})
    if gs.get("n_steps", 0) > 0:
        result["mean_major_groove_w"] = gs.get("mean_major_groove_width")
        result["mean_minor_groove_w"] = gs.get("mean_minor_groove_width")

    return result


def compute_allele_biophysics(allele: dict) -> None:
    """Compute and attach biophysics to an allele dict (in-place)."""
    seq = allele.get("sequence", "")
    if not seq or len(seq) < 2:
        allele["biophysics"] = {}
        allele["nc_biophysics"] = {}
        return

    # Whole-allele biophysics
    allele["biophysics"] = compute_biophysics_summary(seq)

    # Extract features by aligning CDS to genomic sequence
    hla_class = allele.get("hla_class", 1)
    cds_seq = allele.get("cds_seq")
    features = extract_features_by_cds_alignment(seq, cds_seq, hla_class)
    allele["features"] = features

    # Per-feature biophysics
    for feat in features:
        subseq = seq[feat["start_pos"]:feat["end_pos"]]
        if len(subseq) >= 2:
            feat["biophysics"] = compute_biophysics_summary(subseq)
            feat["sequence_hash"] = hashlib.sha256(subseq.encode()).hexdigest()
        else:
            feat["biophysics"] = {}
            feat["sequence_hash"] = None

    # Non-coding aggregate: 5'UTR + all introns + 3'UTR
    nc_parts = []
    for feat in features:
        if feat["feature_type"] in ("5utr", "3utr", "intron"):
            nc_parts.append(seq[feat["start_pos"]:feat["end_pos"]])

    if nc_parts:
        nc_seq = "".join(nc_parts)
        allele["nc_biophysics"] = compute_biophysics_summary(nc_seq)
    else:
        allele["nc_biophysics"] = {}


# ── Flag counting (lightweight, no evaluate_sequence dependency) ──────────


def count_flags(seq: str) -> tuple[int, int]:
    """Count total flags and warnings for a sequence.

    Lightweight flag detection without the full evaluate_sequence call
    (which is slow for batch processing of 37K alleles).
    """
    total = 0
    warnings = 0

    gc = _gc_content(seq)
    if gc > 0.70:
        total += 1
        warnings += 1
    if gc < 0.30:
        total += 1
        warnings += 1

    # Homopolymer detection
    if re.search(r"(.)\1{7,}", seq):
        total += 1
        warnings += 1

    # CpG islands
    if _count_cpg_islands(seq) > 0:
        total += 1

    return total, warnings


# ── Download ─────────────────────────────────────────────────────────────────


def download_locus_files(locus_short: str, data_dir: Path) -> tuple[Path, Path | None]:
    """Download genomic and CDS FASTA files for a locus.

    Returns (gen_fasta_path, nuc_fasta_path).
    """
    data_dir.mkdir(parents=True, exist_ok=True)

    gen_url = f"{IMGT_BASE_URL}/fasta/{locus_short}_gen.fasta"
    gen_path = data_dir / f"{locus_short}_gen.fasta"

    nuc_url = f"{IMGT_BASE_URL}/fasta/{locus_short}_nuc.fasta"
    nuc_path = data_dir / f"{locus_short}_nuc.fasta"

    if not gen_path.exists():
        print(f"  Downloading {gen_url} ...")
        urllib.request.urlretrieve(gen_url, gen_path)
        print(f"    -> {gen_path} ({gen_path.stat().st_size / 1_048_576:.1f} MB)")
    else:
        print(f"  Using cached {gen_path.name} ({gen_path.stat().st_size / 1_048_576:.1f} MB)")

    if not nuc_path.exists():
        print(f"  Downloading {nuc_url} ...")
        try:
            urllib.request.urlretrieve(nuc_url, nuc_path)
            print(f"    -> {nuc_path} ({nuc_path.stat().st_size / 1_048_576:.1f} MB)")
        except Exception as e:
            print(f"    WARNING: Could not download CDS FASTA: {e}")
            nuc_path = None
    else:
        print(f"  Using cached {nuc_path.name} ({nuc_path.stat().st_size / 1_048_576:.1f} MB)")

    return gen_path, nuc_path


# ── IMGT version detection ───────────────────────────────────────────────────


def detect_imgt_version(data_dir: Path) -> str:
    """Detect IMGT/HLA version from downloaded files."""
    version_file = data_dir / "version.txt"
    if version_file.exists():
        return version_file.read_text().strip()

    # Try downloading the version info
    try:
        url = f"{IMGT_BASE_URL}/version.txt"
        urllib.request.urlretrieve(url, version_file)
        return version_file.read_text().strip()
    except Exception:
        pass

    return "3.56.0"  # fallback


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layers(conn: asyncpg.Connection, imgt_version: str) -> tuple[str, str]:
    """Register (or retrieve) the HLA layers."""
    layers = []

    for layer_key, evidence_class, name in [
        ("hla_allele_sequences", "R", "HLA Allele Sequences (IPD-IMGT/HLA)"),
        ("hla_allele_biophysics", "D", "HLA Allele Biophysics (computed)"),
    ]:
        version = imgt_version  # Use IMGT version directly (e.g. '3.56.0')

        # Check for existing layer with this key (any version)
        existing = await conn.fetchval(
            "SELECT id FROM registry.layers WHERE layer_key = $1 AND is_active = true ORDER BY version DESC LIMIT 1",
            layer_key,
        )
        if existing is None:
            # Also check exact version match
            existing = await conn.fetchval(
                "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
                layer_key, version,
            )
        if existing is not None:
            print(f"  Layer already registered: {layer_key} v{version} -> {existing}")
            layers.append(existing)
            continue

        # Deactivate existing default for this key before inserting
        await conn.execute(
            "UPDATE registry.layers SET is_default = false WHERE layer_key = $1 AND is_default = true",
            layer_key,
        )

        layer_id = await conn.fetchval(
            """
            INSERT INTO registry.layers
                (layer_key, version, name, layer_type, genome_build,
                 source, license_class, storage_type, is_active, is_default)
            VALUES
                ($1, $2, $3, 'hla'::layer_type, 'hg38'::genome_build,
                 $4, 'cc_by_4_0', 'postgres', true, true)
            RETURNING id
            """,
            layer_key, version, name,
            f"IPD-IMGT/HLA Database v{imgt_version} (CC BY 4.0)",
        )
        print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
        layers.append(layer_id)

    return layers[0], layers[1]


# ── Batch loading ────────────────────────────────────────────────────────────

ALLELE_COLUMNS = [
    "layer_id", "allele_name", "locus", "allele_group", "protein",
    "synonymous", "noncoding", "hla_class", "expression_suffix",
    "has_genomic", "sequence_length", "cds_length", "n_exons", "n_introns",
    "gc_content", "cpg_count", "cpg_density", "cpg_obs_exp", "cpg_island_count",
    "mean_stacking_dg37", "melting_temp_est",
    "mean_a_form_prop", "mean_z_form_prop", "total_z_penalty",
    "mean_major_groove_w", "mean_minor_groove_w",
    "nc_gc_content", "nc_cpg_count", "nc_cpg_density",
    "nc_mean_stacking_dg37", "nc_melting_temp_est",
    "nc_mean_a_form_prop", "nc_mean_z_form_prop", "nc_total_z_penalty",
    "nc_cpg_island_count",
    "flag_count_total", "flag_count_warnings",
    "imgt_version", "accession",
]

FEATURE_COLUMNS = [
    "layer_id", "allele_id",
    "feature_type", "feature_number", "feature_label",
    "start_pos", "end_pos", "length_bp", "sequence_hash",
    "gc_content", "cpg_count", "cpg_density", "cpg_obs_exp",
    "mean_stacking_dg37", "melting_temp_est",
    "mean_a_form_prop", "mean_z_form_prop", "total_z_penalty",
    "mean_major_groove_w", "mean_minor_groove_w",
    "cpg_island_count", "flag_count",
]


def _build_allele_row(allele: dict, layer_id: str, imgt_version: str) -> tuple:
    """Build a tuple matching ALLELE_COLUMNS for COPY."""
    parsed = allele["parsed"]
    bio = allele.get("biophysics", {})
    nc = allele.get("nc_biophysics", {})
    flags_total, flags_warn = count_flags(allele.get("sequence", ""))

    # Count features
    features = allele.get("features", [])
    n_exons = sum(1 for f in features if f["feature_type"] == "exon")
    n_introns = sum(1 for f in features if f["feature_type"] == "intron")

    return (
        layer_id,
        parsed["allele_name"],
        parsed["locus"],
        parsed["allele_group"],
        parsed["protein"],
        parsed["synonymous"],
        parsed["noncoding"],
        parsed["hla_class"],
        parsed["expression_suffix"],
        True,  # has_genomic (these come from _gen.fasta)
        allele.get("length"),
        allele.get("cds_length"),
        n_exons or None,
        n_introns or None,
        bio.get("gc_content"),
        bio.get("cpg_count"),
        bio.get("cpg_density"),
        bio.get("cpg_obs_exp"),
        bio.get("cpg_island_count"),
        bio.get("mean_stacking_dg37"),
        bio.get("melting_temp_est"),
        bio.get("mean_a_form_prop"),
        bio.get("mean_z_form_prop"),
        bio.get("total_z_penalty"),
        bio.get("mean_major_groove_w"),
        bio.get("mean_minor_groove_w"),
        nc.get("gc_content"),
        nc.get("cpg_count"),
        nc.get("cpg_density"),
        nc.get("mean_stacking_dg37"),
        nc.get("melting_temp_est"),
        nc.get("mean_a_form_prop"),
        nc.get("mean_z_form_prop"),
        nc.get("total_z_penalty"),
        nc.get("cpg_island_count"),
        flags_total,
        flags_warn,
        imgt_version,
        allele.get("accession"),
    )


# ── Main ingestion ───────────────────────────────────────────────────────────


async def ingest_locus(
    conn: asyncpg.Connection,
    locus_short: str,
    hla_class: int,
    seq_layer_id: str,
    bio_layer_id: str,
    imgt_version: str,
    data_dir: Path,
    skip_download: bool = False,
) -> int:
    """Ingest a single HLA locus."""
    print(f"\n  ── {locus_short} (class {'I' if hla_class == 1 else 'II'}) ──")

    # 0. Per-locus idempotency check
    locus_name = f"HLA-{locus_short}"
    existing = await conn.fetchval(
        "SELECT count(*) FROM hla.alleles WHERE layer_id = $1 AND locus = $2",
        bio_layer_id, locus_name,
    )
    if existing > 0:
        print(f"    Already loaded: {existing:,} alleles for {locus_name}. Skipping.")
        return 0

    # 1. Download
    if not skip_download:
        gen_path, nuc_path = download_locus_files(locus_short, data_dir)
    else:
        gen_path = data_dir / f"{locus_short}_gen.fasta"
        nuc_path = data_dir / f"{locus_short}_nuc.fasta"
        if not gen_path.exists():
            print(f"    ERROR: {gen_path} not found (--skip-download requires pre-downloaded files)")
            return 0

    # 2. Parse genomic FASTA
    print(f"  Parsing {gen_path.name} ...")
    gen_alleles = parse_gen_fasta(gen_path)
    print(f"    Found {len(gen_alleles):,} alleles with genomic sequences")

    # 3. Parse CDS FASTA (for cds_length)
    cds_lookup: dict[str, str] = {}
    if nuc_path and nuc_path.exists():
        cds_lookup = parse_nuc_fasta(nuc_path)
        print(f"    Found {len(cds_lookup):,} alleles with CDS sequences")

    # 4. Parse names and compute biophysics
    print(f"  Computing biophysics for {len(gen_alleles):,} alleles ...")
    processed = 0
    skipped = 0

    for allele in gen_alleles:
        try:
            allele["parsed"] = parse_allele_name(allele["allele_name"])
            allele["hla_class"] = hla_class

            # CDS length
            cds = cds_lookup.get(allele["allele_name"], "")
            allele["cds_length"] = len(cds) if cds else None
            allele["cds_seq"] = cds or None

            # Compute biophysics
            compute_allele_biophysics(allele)
            processed += 1
        except Exception as e:
            print(f"    WARNING: Skipping {allele.get('allele_name', '?')}: {e}")
            skipped += 1
            continue

        if processed % 500 == 0:
            print(f"    Computed {processed:,} / {len(gen_alleles):,} ...")

    print(f"    Computed: {processed:,}, Skipped: {skipped:,}")

    # 5. Batch load alleles
    print(f"  Loading alleles into hla.alleles ...")
    allele_rows = []
    for allele in gen_alleles:
        if "parsed" not in allele:
            continue
        allele_rows.append(_build_allele_row(allele, bio_layer_id, imgt_version))

    total_loaded = 0
    for i in range(0, len(allele_rows), BATCH_SIZE):
        batch = allele_rows[i:i + BATCH_SIZE]
        await conn.copy_records_to_table(
            "alleles",
            records=batch,
            columns=ALLELE_COLUMNS,
            schema_name="hla",
        )
        total_loaded += len(batch)
        print(f"    Loaded {total_loaded:,} / {len(allele_rows):,} alleles")

    # 6. Retrieve allele IDs for feature loading
    print(f"  Retrieving allele IDs ...")
    id_rows = await conn.fetch(
        "SELECT id, allele_name FROM hla.alleles WHERE layer_id = $1",
        bio_layer_id,
    )
    id_lookup = {r["allele_name"]: r["id"] for r in id_rows}

    # 7. Batch load features
    print(f"  Loading features into hla.allele_features ...")
    feature_rows = []
    for allele in gen_alleles:
        if "parsed" not in allele:
            continue
        allele_name = allele["parsed"]["allele_name"]
        allele_id = id_lookup.get(allele_name)
        if allele_id is None:
            continue

        for feat in allele.get("features", []):
            bio = feat.get("biophysics", {})
            feature_rows.append((
                bio_layer_id,
                allele_id,
                feat["feature_type"],
                feat["feature_number"],
                feat["feature_label"],
                feat["start_pos"],
                feat["end_pos"],
                feat["length_bp"],
                feat.get("sequence_hash"),
                bio.get("gc_content"),
                bio.get("cpg_count"),
                bio.get("cpg_density"),
                bio.get("cpg_obs_exp"),
                bio.get("mean_stacking_dg37"),
                bio.get("melting_temp_est"),
                bio.get("mean_a_form_prop"),
                bio.get("mean_z_form_prop"),
                bio.get("total_z_penalty"),
                bio.get("mean_major_groove_w"),
                bio.get("mean_minor_groove_w"),
                bio.get("cpg_island_count"),
                bio.get("flag_count", 0) if bio else 0,
            ))

    feat_loaded = 0
    for i in range(0, len(feature_rows), BATCH_SIZE):
        batch = feature_rows[i:i + BATCH_SIZE]
        await conn.copy_records_to_table(
            "allele_features",
            records=batch,
            columns=FEATURE_COLUMNS,
            schema_name="hla",
        )
        feat_loaded += len(batch)

    print(f"    Loaded {feat_loaded:,} features")

    # 8. Batch load sequences
    print(f"  Loading sequences into hla.allele_sequences ...")
    seq_rows = []
    for allele in gen_alleles:
        if "parsed" not in allele:
            continue
        allele_name = allele["parsed"]["allele_name"]
        allele_id = id_lookup.get(allele_name)
        if allele_id is None:
            continue
        seq_rows.append((
            allele_id,
            allele.get("sequence"),
            allele.get("cds_seq"),
        ))

    for i in range(0, len(seq_rows), BATCH_SIZE):
        batch = seq_rows[i:i + BATCH_SIZE]
        await conn.copy_records_to_table(
            "allele_sequences",
            records=batch,
            columns=["allele_id", "genomic_seq", "cds_seq"],
            schema_name="hla",
        )

    print(f"    Loaded {len(seq_rows):,} sequences")

    return total_loaded


async def main(
    loci: list[str] | None = None,
    skip_download: bool = False,
) -> None:
    """Connect and ingest HLA allele data."""
    if loci is None:
        loci = list(TRANSPLANT_LOCI.keys())

    # Validate locus names
    valid = set(TRANSPLANT_LOCI.keys())
    for loc in loci:
        short = loc.replace("HLA-", "")
        if short not in valid:
            print(f"ERROR: Unknown locus '{loc}'. Valid: {sorted(valid)}")
            return

    data_dir = DATA_DIR
    imgt_version = detect_imgt_version(data_dir)

    conn = await get_ingest_connection(admin=True)

    try:
        print(f"\n{'='*60}")
        print(f"IPD-IMGT/HLA Allele Ingestion (v{imgt_version})")
        print(f"Loci: {', '.join(loci)}")
        print(f"{'='*60}")

        # 1. Register layers
        seq_layer_id, bio_layer_id = await register_layers(conn, imgt_version)

        # 2. Ingest each locus (idempotency check is per-locus inside ingest_locus)
        total = 0
        async with ingest_transaction(conn):
            for loc in loci:
                short = loc.replace("HLA-", "")
                hla_class = TRANSPLANT_LOCI[short]
                n = await ingest_locus(
                    conn, short, hla_class,
                    seq_layer_id, bio_layer_id, imgt_version,
                    data_dir, skip_download=skip_download,
                )
                total += n

        print(f"\n{'='*60}")
        print(f"Total alleles loaded: {total:,}")
        print(f"{'='*60}")

    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest HLA allele sequences and biophysics from IPD-IMGT/HLA",
    )
    parser.add_argument(
        "--locus",
        choices=["HLA-A", "HLA-B", "HLA-C", "HLA-DRB1", "HLA-DQB1", "HLA-DPB1"],
        default=None,
        help="Single locus to ingest (default: all 6 transplant loci)",
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip downloading files (use pre-cached data)",
    )
    args = parser.parse_args()

    loci = [args.locus] if args.locus else None
    asyncio.run(main(loci, skip_download=args.skip_download))


if __name__ == "__main__":
    cli()
