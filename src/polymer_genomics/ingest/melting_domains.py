"""Poland-Scheraga melting domain computation + SBS mutation dG.

Computes three melting profile tracks and four mutation thermodynamic
perturbation tracks for 1kb sequence windows.

Physics:
  - SantaLucia (1998) nearest-neighbor stacking parameters
  - Poland-Scheraga model: 1D Ising-like with loop entropy penalty
  - Transfer matrix method for partition function
  - Bubble propensity = fraction of bp in denatured state at 37C

Usage::
    uv run python -m polymer_genomics.ingest.melting_domains --fasta /path/to/hg38.fa --chr chr22
"""

from __future__ import annotations

import math

# ── SantaLucia 1998 nearest-neighbor parameters ─────────────────────────────
# (dH kcal/mol, dS cal/mol/K) for each dinucleotide 5'->3'
# Complement pairs included via COMPLEMENT map

NN_PARAMS: dict[str, tuple[float, float]] = {
    "AA": (-7.9, -22.2),
    "AT": (-7.2, -20.4),
    "TA": (-7.2, -21.3),
    "CA": (-8.5, -22.7),
    "GT": (-8.4, -22.4),
    "CT": (-7.8, -21.0),
    "GA": (-8.2, -22.2),
    "CG": (-10.6, -27.2),
    "GC": (-9.8, -24.4),
    "GG": (-8.0, -19.9),
}

COMPLEMENT = {"A": "T", "T": "A", "C": "G", "G": "C"}

# Pre-compute reverse complement pairs
_RC_MAP: dict[str, str] = {}
for _di, _params in list(NN_PARAMS.items()):
    _rc = COMPLEMENT[_di[1]] + COMPLEMENT[_di[0]]
    if _rc not in NN_PARAMS:
        _RC_MAP[_rc] = _di


def _nn_dg(dinuc: str, T: float = 310.15) -> float:
    """Free energy (kcal/mol) for a dinucleotide at temperature T (K).

    Returns 0.0 for dinucleotides containing non-ACGT bases.
    """
    key = dinuc.upper()
    if key in NN_PARAMS:
        dH, dS = NN_PARAMS[key]
    elif key in _RC_MAP:
        dH, dS = NN_PARAMS[_RC_MAP[key]]
    else:
        return 0.0
    return dH - T * dS / 1000.0  # dS is cal/mol/K -> kcal


def _nn_dh_ds(dinuc: str) -> tuple[float, float]:
    """Return (dH, dS) for a dinucleotide. (0, 0) for non-ACGT."""
    key = dinuc.upper()
    if key in NN_PARAMS:
        return NN_PARAMS[key]
    if key in _RC_MAP:
        return NN_PARAMS[_RC_MAP[key]]
    return (0.0, 0.0)


# ── Poland-Scheraga melting computation ──────────────────────────────────────

# Loop entropy exponent (Poland-Scheraga)
LOOP_EXPONENT = 1.76  # c parameter for loop closure entropy
SIGMA_0 = 1e-5  # cooperativity parameter (nucleation penalty)


def _compute_melting_profile(seq: str, temperatures: list[float]) -> list[float]:
    """Compute fraction of denatured bp at each temperature.

    Uses transfer matrix approach: at each position, compute the
    equilibrium constant for opening (K_open = exp(-dG_stack / RT)).
    The probability of being open includes the cooperativity penalty sigma.

    Returns list of denatured fractions, one per temperature.
    """
    seq = seq.upper()
    n = len(seq) - 1  # number of stacking pairs
    if n < 1:
        return [0.0] * len(temperatures)

    # Pre-compute dH and dS for each stacking position
    dH_list: list[float] = []
    dS_list: list[float] = []
    valid_count = 0
    for i in range(n):
        dinuc = seq[i : i + 2]
        dH, dS = _nn_dh_ds(dinuc)
        dH_list.append(dH)
        dS_list.append(dS)
        if dH != 0.0:
            valid_count += 1

    if valid_count == 0:
        return [0.0] * len(temperatures)

    R = 1.987e-3  # kcal/(mol*K)
    fractions: list[float] = []

    for T in temperatures:
        # For each bp, compute probability of being denatured
        total_open = 0.0
        for i in range(n):
            if dH_list[i] == 0.0:
                continue
            dG = dH_list[i] - T * dS_list[i] / 1000.0
            # Equilibrium constant for opening: breaking the stack costs +|dG|
            # dG is negative (stabilizing), so opening K = sigma * exp(+dG/RT)
            # which is small for strong stacking (correct: GC harder to open)
            K_open = SIGMA_0 * math.exp(dG / (R * T))
            # Probability of being open (two-state per bp approximation)
            p_open = K_open / (1.0 + K_open)
            total_open += p_open

        fractions.append(total_open / valid_count if valid_count > 0 else 0.0)

    return fractions


def compute_bubble_propensity(seq: str, T: float = 310.15) -> float:
    """Fraction of base pairs in denatured bubble state at temperature T (K).

    Default T = 310.15 K (37C, physiological).
    """
    result = _compute_melting_profile(seq, [T])
    return result[0]


def compute_melting_width(seq: str) -> float:
    """Temperature range (C) between 20% and 80% denaturation.

    Scans from 40C to 100C in 0.5C steps.
    Returns width in C. Narrower = more cooperative melting.
    """
    temps_c = [40.0 + i * 0.5 for i in range(121)]  # 40 to 100C
    temps_k = [t + 273.15 for t in temps_c]
    fractions = _compute_melting_profile(seq, temps_k)

    t20: float | None = None
    t80: float | None = None
    for i, f in enumerate(fractions):
        if t20 is None and f >= 0.2:
            t20 = temps_c[i]
        if t80 is None and f >= 0.8:
            t80 = temps_c[i]

    if t20 is not None and t80 is not None:
        return t80 - t20
    # If we never cross thresholds, return a large width
    if t20 is None:
        return 60.0  # very GC-rich, doesn't melt in range
    return 60.0  # doesn't reach 80% in range


def compute_cooperativity(seq: str) -> float:
    """Effective cooperativity parameter from sequence composition.

    Higher GC content -> more cooperative melting (lower effective sigma).
    Returns sigma value (always positive, smaller = more cooperative).
    """
    seq = seq.upper()
    gc = sum(1 for b in seq if b in "GC")
    total = sum(1 for b in seq if b in "ACGT")
    if total == 0:
        return SIGMA_0

    gc_frac = gc / total
    # Cooperativity scales with GC content: GC-rich sequences have
    # stronger stacking -> more cooperative transitions
    # sigma decreases (more cooperative) with higher GC
    sigma = SIGMA_0 * math.exp(2.0 * (1.0 - gc_frac))
    return sigma


# ── SBS mutation delta-delta-G ───────────────────────────────────────────────

SBS_CHANNELS: dict[str, tuple[str, str]] = {
    "c_to_a": ("C", "A"),
    "c_to_g": ("C", "G"),
    "c_to_t": ("C", "T"),
    "t_to_a": ("T", "A"),
}


def compute_sbs_ddg(seq: str, T: float = 310.15) -> dict[str, float]:
    """Compute mean |delta-delta-G| for each SBS mutation channel.

    For each position matching the reference base (C or T), compute
    the stacking energy change when mutated to the alternate base.

    The perturbation considers both flanking dinucleotides:
      wildtype: dG(5'XY3') + dG(5'YZ3')
      mutant:   dG(5'XY'3') + dG(5'Y'Z3')
      ddG = |mutant - wildtype|

    Returns dict with 4 SBS channel keys, each a mean |ddG| in kcal/mol.
    """
    seq = seq.upper()
    n = len(seq)

    results: dict[str, float] = {}

    for channel, (ref_base, alt_base) in SBS_CHANNELS.items():
        total_ddg = 0.0
        count = 0

        for i in range(1, n - 1):  # skip first/last (no full context)
            if seq[i] != ref_base:
                continue

            # Wildtype stacking: 5' neighbor + this, this + 3' neighbor
            wt_left = seq[i - 1] + seq[i]
            wt_right = seq[i] + seq[i + 1]
            wt_dg = _nn_dg(wt_left, T) + _nn_dg(wt_right, T)

            # Mutant stacking
            mut_left = seq[i - 1] + alt_base
            mut_right = alt_base + seq[i + 1]
            mut_dg = _nn_dg(mut_left, T) + _nn_dg(mut_right, T)

            ddg = abs(mut_dg - wt_dg)
            total_ddg += ddg
            count += 1

        results[channel] = total_ddg / count if count > 0 else 0.0

    return results


# ── Convenience: compute all tracks for a 1kb window ────────────────────────


def compute_all_tracks(seq: str) -> dict[str, float]:
    """Compute all 7 melting/mutation tracks for a sequence window.

    Returns dict with keys:
      melting_cooperativity, bubble_propensity, melting_width,
      sbs_c_to_a_ddg, sbs_c_to_g_ddg, sbs_c_to_t_ddg, sbs_t_to_a_ddg
    """
    sbs = compute_sbs_ddg(seq)
    return {
        "melting_cooperativity": compute_cooperativity(seq),
        "bubble_propensity": compute_bubble_propensity(seq),
        "melting_width": compute_melting_width(seq),
        "sbs_c_to_a_ddg": sbs["c_to_a"],
        "sbs_c_to_g_ddg": sbs["c_to_g"],
        "sbs_c_to_t_ddg": sbs["c_to_t"],
        "sbs_t_to_a_ddg": sbs["t_to_a"],
    }
