"""Non-B DNA structure predictions ingestion.

Computes non-B DNA motif densities from genome sequence at 1kb resolution:
- G-quadruplex (G4Hunter regex)
- Z-DNA (alternating purine-pyrimidine runs)
- Cruciform / hairpin (inverted repeats)
- R-loop potential (GC skew × G clustering)
- Triplex / H-DNA (homopurine·homopyrimidine mirror repeats)

All predictions are deterministic from sequence (D-class, no model fitting).

Usage::

    uv run python -m polymer_genomics.ingest.nonb_dna --fasta /path/to/hg38.fa
"""

from __future__ import annotations

import argparse
import asyncio
import os
import re

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID


# ═══════════════════════════════════════════════════════════════════════════════
# Non-B DNA detection functions (pure Python, no external dependencies)
# ═══════════════════════════════════════════════════════════════════════════════

# G-quadruplex: G3+N1-7G3+N1-7G3+N1-7G3+ (also complement C-rich strand)
_G4_PATTERN = re.compile(r"G{3,}\w{1,7}G{3,}\w{1,7}G{3,}\w{1,7}G{3,}", re.IGNORECASE)
_G4_COMP = re.compile(r"C{3,}\w{1,7}C{3,}\w{1,7}C{3,}\w{1,7}C{3,}", re.IGNORECASE)

# Z-DNA: alternating purine-pyrimidine ≥12bp
_ZDNA_PATTERN = re.compile(r"(?:[AG][CT]){6,}|(?:[CT][AG]){6,}", re.IGNORECASE)

# Triplex: homopurine run ≥15bp (mirror repeat capable)
_TRIPLEX_PU = re.compile(r"[AG]{15,}", re.IGNORECASE)
_TRIPLEX_PY = re.compile(r"[CT]{15,}", re.IGNORECASE)


def count_g4(seq: str) -> int:
    """Count G-quadruplex forming motifs (both strands)."""
    return len(_G4_PATTERN.findall(seq)) + len(_G4_COMP.findall(seq))


def count_zdna(seq: str) -> int:
    """Count Z-DNA forming motifs."""
    return len(_ZDNA_PATTERN.findall(seq))


def count_cruciform(seq: str, min_stem: int = 6, max_loop: int = 8) -> int:
    """Count inverted repeat / hairpin structures.

    Scans for palindromic sequences: stem ≥ min_stem bp with loop ≤ max_loop bp.
    """
    seq_upper = seq.upper()
    complement = str.maketrans("ACGT", "TGCA")
    count = 0

    for i in range(len(seq_upper) - 2 * min_stem - 1):
        stem = seq_upper[i:i + min_stem]
        rev_comp = stem[::-1].translate(complement)
        # Search for reverse complement within loop distance
        search_start = i + min_stem
        search_end = min(search_start + max_loop + min_stem, len(seq_upper))
        region = seq_upper[search_start:search_end]
        if rev_comp in region:
            count += 1

    return count


def compute_rloop_score(seq: str, window: int = 50) -> float:
    """Compute R-loop forming potential from GC skew and G clustering.

    R-loops form preferentially on the non-template strand when:
    1. GC skew is positive (G > C on coding strand)
    2. G bases are clustered (not uniformly distributed)

    Returns score in [0, 1] range.
    """
    seq_upper = seq.upper()
    if len(seq_upper) < window:
        g = seq_upper.count("G")
        c = seq_upper.count("C")
        gc_total = g + c
        if gc_total == 0:
            return 0.0
        skew = (g - c) / gc_total
        g_density = g / max(len(seq_upper), 1)
        return max(0.0, skew * g_density)

    # Sliding window for local GC skew
    skew_sum = 0.0
    n_windows = 0
    for start in range(0, len(seq_upper) - window + 1, window // 2):
        w = seq_upper[start:start + window]
        g = w.count("G")
        c = w.count("C")
        gc_total = g + c
        if gc_total > 0:
            skew_sum += abs((g - c) / gc_total) * (g / window)
            n_windows += 1

    return skew_sum / max(n_windows, 1)


def count_triplex(seq: str) -> int:
    """Count triplex (H-DNA) forming motifs — homopurine·homopyrimidine runs ≥15bp."""
    return len(_TRIPLEX_PU.findall(seq)) + len(_TRIPLEX_PY.findall(seq))


def analyze_window(seq: str) -> dict:
    """Compute all non-B DNA metrics for a single window.

    Args:
        seq: DNA sequence string (typically 1kb).

    Returns:
        Dict with density values per kb.
    """
    kb = len(seq) / 1000.0
    if kb == 0:
        return {"g4": 0, "zdna": 0, "cruciform": 0, "rloop": 0, "triplex": 0, "total": 0}

    g4 = count_g4(seq) / kb
    zdna = count_zdna(seq) / kb
    cruciform = count_cruciform(seq) / kb
    rloop = compute_rloop_score(seq)
    triplex = count_triplex(seq) / kb
    total = g4 + zdna + cruciform + rloop + triplex

    return {
        "g4": round(g4, 4),
        "zdna": round(zdna, 4),
        "cruciform": round(cruciform, 4),
        "rloop": round(rloop, 4),
        "triplex": round(triplex, 4),
        "total": round(total, 4),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# FASTA reading
# ═══════════════════════════════════════════════════════════════════════════════

def iter_fasta_windows(fasta_path: str, window_size: int = 1000):
    """Yield (chr_name, start, end, seq) tuples from a FASTA file.

    Reads chromosome by chromosome, yields non-overlapping windows.
    Skips windows that are >50% N.
    """
    chr_name = None
    seq_parts: list[str] = []

    def flush_chr(name, parts):
        full_seq = "".join(parts).upper()
        for start in range(0, len(full_seq), window_size):
            end = min(start + window_size, len(full_seq))
            window_seq = full_seq[start:end]
            if len(window_seq) < window_size // 2:
                continue
            n_count = window_seq.count("N")
            if n_count > len(window_seq) * 0.5:
                continue
            yield name, start, end, window_seq

    with open(fasta_path) as f:
        for line in f:
            line = line.rstrip()
            if line.startswith(">"):
                if chr_name and seq_parts:
                    yield from flush_chr(chr_name, seq_parts)
                chr_name = line[1:].split()[0]
                seq_parts = []
            else:
                seq_parts.append(line)

    if chr_name and seq_parts:
        yield from flush_chr(chr_name, seq_parts)


async def main() -> None:
    """Compute non-B DNA predictions and populate fragility.nonb_dna."""
    parser = argparse.ArgumentParser(description="Non-B DNA structure predictions")
    parser.add_argument("--fasta", required=True, help="Path to hg38 reference FASTA")
    parser.add_argument("--window", type=int, default=1000, help="Window size (default: 1000)")
    parser.add_argument("--batch-size", type=int, default=5000, help="DB insert batch size")
    args = parser.parse_args()

    conn = await asyncpg.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        database=os.environ.get("POSTGRES_DB", "polymer_genomics"),
        user=os.environ.get("POSTGRES_USER", "ingest_writer"),
        password=os.environ.get("POSTGRES_USER_PASSWORD", "ingest_writer_dev"),
    )

    try:
        count = await conn.fetchval("SELECT count(*) FROM fragility.nonb_dna")
        if count > 0:
            print(f"  nonb_dna already has {count} rows, skipping.")
            return

        # Resolve or create layer
        layer_id = await conn.fetchval(
            "SELECT id FROM registry.layers WHERE layer_key = 'nonb_dna'"
        )
        if layer_id is None:
            layer_id = await conn.fetchval(
                """INSERT INTO registry.layers
                   (layer_key, version, name, layer_type, genome_build,
                    source, license_class, storage_type, row_count,
                    is_active, is_default, evidence_class, tier,
                    equilibrium_regime, statefulness, validation_status,
                    interpretability, is_composite)
                   VALUES ('nonb_dna', '1.0', 'Non-B DNA Structure Predictions',
                           'biophysics', 'hg38', 'Sequence-deterministic algorithms',
                           'public_domain', 'postgres', 0, true, true,
                           'D', 'intrinsic', 'equilibrium', 'reference_static',
                           'externally_benchmarked', 'mechanistic', false)
                   ON CONFLICT (layer_key, version) DO UPDATE SET name = EXCLUDED.name
                   RETURNING id""",
            )

        print(f"Processing {args.fasta} with window={args.window}bp...")
        total = 0
        batch: list[tuple] = []

        for chr_name, start, end, seq in iter_fasta_windows(args.fasta, args.window):
            chr_id = CHR_NAME_TO_ID.get(chr_name)
            if chr_id is None:
                continue

            metrics = analyze_window(seq)
            batch.append((
                layer_id, chr_id, start, end,
                metrics["g4"], metrics["zdna"], metrics["cruciform"],
                metrics["rloop"], metrics["triplex"], metrics["total"],
            ))

            if len(batch) >= args.batch_size:
                await conn.executemany(
                    """INSERT INTO fragility.nonb_dna
                       (layer_id, build, chr_id, start_pos, end_pos,
                        g4_density, z_dna_density, cruciform_density,
                        r_loop_score, triplex_density, total_nonb_density)
                       VALUES ($1, 'hg38', $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
                    batch,
                )
                total += len(batch)
                batch = []
                if total % 100000 == 0:
                    print(f"  {total:,} windows processed...")

        if batch:
            await conn.executemany(
                """INSERT INTO fragility.nonb_dna
                   (layer_id, build, chr_id, start_pos, end_pos,
                    g4_density, z_dna_density, cruciform_density,
                    r_loop_score, triplex_density, total_nonb_density)
                   VALUES ($1, 'hg38', $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
                batch,
            )
            total += len(batch)

        # Update counts
        await conn.execute(
            "UPDATE reference.catalog SET row_count = $1 WHERE table_name = 'nonb_dna'",
            total,
        )
        await conn.execute(
            "UPDATE registry.layers SET row_count = $1 WHERE layer_key = 'nonb_dna'",
            total,
        )

        print(f"  Inserted {total:,} non-B DNA windows.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
