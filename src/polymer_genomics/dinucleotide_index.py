"""Genome-wide dinucleotide index: uint8 arrays (0-15) for instant biophysics lookup."""

import numpy as np

DINUC_ORDER = [
    "AA", "AC", "AG", "AT", "CA", "CC", "CG", "CT",
    "GA", "GC", "GG", "GT", "TA", "TC", "TG", "TT",
]

_BASE_LUT = np.full(256, 255, dtype=np.uint8)
_BASE_LUT[ord("A")] = 0
_BASE_LUT[ord("C")] = 1
_BASE_LUT[ord("G")] = 2
_BASE_LUT[ord("T")] = 3


def sequence_to_dinuc_index(sequence: str) -> np.ndarray:
    """Convert DNA sequence to dinucleotide index array.

    Returns uint8 array of length len(seq)-1.
    Values 0-15 for valid dinucleotides (b1*4 + b2).
    Value 255 for N-containing dinucleotides.
    """
    seq_bytes = np.frombuffer(sequence.upper().encode("ascii"), dtype=np.uint8)
    base_idx = _BASE_LUT[seq_bytes]
    b1 = base_idx[:-1]
    b2 = base_idx[1:]
    valid = (b1 < 255) & (b2 < 255)
    result = np.full(len(b1), 255, dtype=np.uint8)
    result[valid] = (b1[valid].astype(np.uint16) * 4 + b2[valid].astype(np.uint16)).astype(np.uint8)
    return result


def dinuc_index_to_values(idx: np.ndarray, lut: np.ndarray) -> np.ndarray:
    """Convert dinucleotide index array to property values using a 16-element lookup.
    Invalid positions (255) get NaN.
    """
    extended = np.full(256, np.nan)
    extended[:16] = lut
    return extended[idx]


def generate_chromosome_index(fasta_path: str, chr_name: str) -> np.ndarray:
    """Generate dinucleotide index for a full chromosome from FASTA."""
    from pyfaidx import Fasta
    fa = Fasta(fasta_path, read_ahead=10000, rebuild=False)
    seq = str(fa[chr_name][:]).upper()
    fa.close()
    return sequence_to_dinuc_index(seq)
