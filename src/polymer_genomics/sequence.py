"""Reference sequence access via indexed FASTA files."""

from __future__ import annotations

from pathlib import Path

from pyfaidx import Fasta

from polymer_genomics.config import settings

_fasta_cache: dict[str, Fasta] = {}


def get_fasta(build: str) -> Fasta:
    """Get or create a pyfaidx Fasta handle (cached per build)."""
    if build not in _fasta_cache:
        fasta_path = Path(settings.fasta_dir) / f"{build}.fa"
        if not fasta_path.exists():
            raise FileNotFoundError(f"Reference FASTA not found: {fasta_path}")
        _fasta_cache[build] = Fasta(str(fasta_path), read_ahead=10000)
    return _fasta_cache[build]


def get_sequence(build: str, chr_name: str, start: int, end: int) -> str:
    """Fetch a DNA subsequence (0-based half-open coordinates).

    Parameters
    ----------
    build : str
        Genome build ("hg38" or "hg37").
    chr_name : str
        Chromosome name (e.g., "chr16").
    start : int
        0-based start position (inclusive).
    end : int
        0-based end position (exclusive).

    Returns
    -------
    str
        Uppercase DNA sequence.
    """
    fasta = get_fasta(build)
    return str(fasta[chr_name][start:end]).upper()
