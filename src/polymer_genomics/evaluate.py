"""Sequence evaluation engine for the physics linter.

Takes an arbitrary DNA sequence (not a genomic coordinate) and returns a
structured biophysical assessment: thermodynamics, structural properties,
CpG island detection, and actionable flags.

Pure Python — no database access, no FASTA lookup.
"""

from __future__ import annotations

import math
import re
import statistics
from typing import Any

from polymer_genomics.biophysics import (
    compute_thermodynamics,
    compute_extinction,
    compute_form_propensity,
    compute_groove_profile,
)

# ── Constants ────────────────────────────────────────────────────────────

MAX_EVALUATE_LENGTH = 100_000  # 100 kb
MIN_EVALUATE_LENGTH = 10

# Tm: nearest-neighbor (two-state) vs empirical (long-DNA) cutoff
_NN_TM_CUTOFF = 60  # bp; Primer3/IDT use ~60 bp as the two-state limit

# SantaLucia 1998 Table 2: duplex initiation parameters
# Applied once per terminus for Tm calculation only (not stacking profiles)
_INIT_DH = {"GC": 0.1, "AT": 2.3}   # kcal/mol
_INIT_DS = {"GC": -2.8, "AT": 4.1}  # cal/(mol·K)
_R_CAL = 1.987  # gas constant, cal/(mol·K)

# CpG island detection: Gardiner-Garden & Frommer 1987 criteria
CGI_MIN_LENGTH = 200
CGI_MIN_GC = 0.50
CGI_MIN_OE = 0.60

# Windowed analysis
DEFAULT_WINDOW = 100  # bp
MIN_WINDOW = 20

# Flag thresholds
_FLAG_HIGH_GC = 0.70
_FLAG_LOW_GC = 0.30
_FLAG_LOW_STABILITY_DG = -0.80   # less negative = less stable
_FLAG_HIGH_STABILITY_DG = -1.80  # more negative = very stable
_FLAG_Z_FORM_THRESHOLD = 0.40
_FLAG_HOMOPOLYMER_MIN = 8
_FLAG_DINUC_REPEAT_MIN = 20  # bp total length
_FLAG_LONG_HOMOPOLYMER_MIN = 12
_FLAG_EXTREME_GC_HIGH = 0.80
_FLAG_EXTREME_GC_LOW = 0.15
_FLAG_DIRECT_REPEAT_K = 15
_FLAG_SILENCING_CGI_MIN = 3

_VALID_BASES = set("ACGT")
_VALID_BASES_WITH_N = set("ACGTN")


# ── Helpers ──────────────────────────────────────────────────────────────

def _gc_content(seq: str) -> float:
    """Fraction of G+C in sequence (ignoring Ns)."""
    gc = seq.count("G") + seq.count("C")
    total = len(seq) - seq.count("N")
    return gc / total if total > 0 else 0.0


def _cpg_count(seq: str) -> int:
    """Count CpG dinucleotides."""
    return sum(1 for i in range(len(seq) - 1) if seq[i] == "C" and seq[i + 1] == "G")


def _cpg_observed_expected(seq: str) -> float:
    """CpG observed/expected ratio."""
    n = len(seq)
    if n < 2:
        return 0.0
    c_count = seq.count("C")
    g_count = seq.count("G")
    cpg = _cpg_count(seq)
    n_dinuc = n - 1  # number of dinucleotide positions
    expected = (c_count * g_count) / n_dinuc if n_dinuc > 0 else 0
    return cpg / expected if expected > 0 else 0.0


def _detect_cpg_islands(seq: str) -> list[dict]:
    """Detect CpG islands using optimized sliding window + merge approach.

    Gardiner-Garden & Frommer 1987 criteria:
    - Length ≥ 200 bp
    - GC content ≥ 50%
    - CpG observed/expected ≥ 0.60

    Uses running sums (O(n)) instead of per-window recount (O(n*w)).
    """
    islands: list[dict] = []
    n = len(seq)
    w = CGI_MIN_LENGTH
    if n < w:
        return islands

    # Pre-compute per-position binary arrays for running sums
    is_c = [1 if seq[i] == "C" else 0 for i in range(n)]
    is_g = [1 if seq[i] == "G" else 0 for i in range(n)]
    is_cpg = [1 if i < n - 1 and seq[i] == "C" and seq[i + 1] == "G" else 0 for i in range(n)]

    # Initial window [0, w)
    c_sum = sum(is_c[:w])
    g_sum = sum(is_g[:w])
    gc_sum = c_sum + g_sum
    cpg_sum = sum(is_cpg[:w - 1])  # CpG dinucs within window (w-1 positions)

    qualifying = bytearray(n)  # faster than list[bool]

    def _check_and_mark(i: int) -> None:
        gc_frac = gc_sum / w
        if gc_frac < CGI_MIN_GC:
            return
        expected = (c_sum * g_sum) / w
        if expected <= 0:
            return
        oe = cpg_sum / expected
        if oe >= CGI_MIN_OE:
            for j in range(i, i + w):
                qualifying[j] = 1

    _check_and_mark(0)

    # Slide window by 1 bp
    for i in range(1, n - w + 1):
        # Remove left edge (position i-1), add right edge (position i+w-1)
        old_left = i - 1
        new_right = i + w - 1

        gc_sum += (is_c[new_right] + is_g[new_right]) - (is_c[old_left] + is_g[old_left])
        c_sum += is_c[new_right] - is_c[old_left]
        g_sum += is_g[new_right] - is_g[old_left]

        # CpG: remove dinuc at old_left (pos old_left, old_left+1)
        # add dinuc at new_right-1 (pos new_right-1, new_right)
        cpg_sum -= is_cpg[old_left]
        if new_right - 1 >= 0:
            cpg_sum += is_cpg[new_right - 1]

        _check_and_mark(i)

    # Merge contiguous qualifying positions into islands
    in_island = False
    start = 0
    for i in range(n):
        if qualifying[i] and not in_island:
            start = i
            in_island = True
        elif not qualifying[i] and in_island:
            length = i - start
            if length >= w:
                island_seq = seq[start:i]
                islands.append({
                    "start": start + 1,  # 1-based
                    "end": i,            # 1-based closed
                    "length_bp": length,
                    "gc": round(_gc_content(island_seq), 3),
                    "obs_exp_cpg": round(_cpg_observed_expected(island_seq), 3),
                    "cpg_count": _cpg_count(island_seq),
                })
            in_island = False

    # Handle island extending to end of sequence
    if in_island:
        length = n - start
        if length >= w:
            island_seq = seq[start:]
            islands.append({
                "start": start + 1,
                "end": n,
                "length_bp": length,
                "gc": round(_gc_content(island_seq), 3),
                "obs_exp_cpg": round(_cpg_observed_expected(island_seq), 3),
                "cpg_count": _cpg_count(island_seq),
            })

    return islands


def _windowed_profile(values: list[float], window: int) -> list[float]:
    """Compute non-overlapping window means from a per-step value list."""
    if not values or window < 1:
        return []
    result = []
    for i in range(0, len(values), window):
        chunk = values[i:i + window]
        result.append(round(statistics.mean(chunk), 4))
    return result


def _detect_homopolymers(seq: str, min_length: int = _FLAG_HOMOPOLYMER_MIN) -> list[dict]:
    """Find homopolymer runs of length ≥ min_length."""
    runs = []
    if len(seq) < min_length:
        return runs
    pattern = re.compile(r"([ACGT])\1{" + str(min_length - 1) + r",}")
    for m in pattern.finditer(seq):
        runs.append({
            "start": m.start() + 1,  # 1-based
            "end": m.end(),
            "base": m.group(1),
            "length": m.end() - m.start(),
        })
    return runs


def _detect_dinuc_repeats(seq: str, min_length: int = _FLAG_DINUC_REPEAT_MIN) -> list[dict]:
    """Find dinucleotide tandem repeats of total length ≥ min_length."""
    runs = []
    if len(seq) < min_length:
        return runs
    pattern = re.compile(r"(([ACGT]{2})\2{" + str(min_length // 2 - 1) + r",})")
    for m in pattern.finditer(seq):
        if m.end() - m.start() >= min_length:
            runs.append({
                "start": m.start() + 1,
                "end": m.end(),
                "motif": m.group(2),
                "length": m.end() - m.start(),
                "repeats": (m.end() - m.start()) // 2,
            })
    return runs


def _generate_flags(
    seq: str,
    gc: float,
    cpg_islands: list[dict],
    thermo_summary: dict,
    form_summary: dict,
    windowed_dg: list[float],
    windowed_gc: list[float],
    window_size: int,
) -> list[dict]:
    """Generate actionable flags from biophysical analysis."""
    flags: list[dict] = []

    # CpG island flags
    for island in cpg_islands:
        flags.append({
            "type": "warning",
            "code": "CPG_ISLAND",
            "region": f"{island['start']}-{island['end']}",
            "message": (
                f"CpG island detected ({island['length_bp']} bp, GC={island['gc']:.0%}, "
                f"O/E={island['obs_exp_cpg']:.2f}) — susceptible to methylation-mediated "
                f"silencing in mammalian cells"
            ),
        })

    # Windowed GC flags
    for i, wgc in enumerate(windowed_gc):
        start = i * window_size + 1
        end = min((i + 1) * window_size, len(seq))
        if wgc > _FLAG_HIGH_GC:
            flags.append({
                "type": "info",
                "code": "HIGH_GC",
                "region": f"{start}-{end}",
                "message": f"High GC content ({wgc:.0%}) — strong secondary structure potential",
            })
        elif wgc < _FLAG_LOW_GC:
            flags.append({
                "type": "info",
                "code": "LOW_GC",
                "region": f"{start}-{end}",
                "message": f"Low GC content ({wgc:.0%}) — reduced thermodynamic stability",
            })

    # Windowed stability flags
    for i, wdg in enumerate(windowed_dg):
        start = i * window_size + 1
        end = min((i + 1) * window_size, len(seq))
        if wdg > _FLAG_LOW_STABILITY_DG:
            flags.append({
                "type": "info",
                "code": "LOW_STABILITY",
                "region": f"{start}-{end}",
                "message": (
                    f"Low stacking stability (mean ΔG₃₇ = {wdg:.2f} kcal/mol) — "
                    f"may facilitate strand separation or regulatory access"
                ),
            })
        elif wdg < _FLAG_HIGH_STABILITY_DG:
            flags.append({
                "type": "info",
                "code": "HIGH_STABILITY",
                "region": f"{start}-{end}",
                "message": (
                    f"High stacking stability (mean ΔG₃₇ = {wdg:.2f} kcal/mol) — "
                    f"resistant to strand separation"
                ),
            })

    # Z-form propensity
    if form_summary.get("mean_z_form_propensity", 999) < _FLAG_Z_FORM_THRESHOLD:
        flags.append({
            "type": "warning",
            "code": "Z_FORM_PRONE",
            "region": "global",
            "message": (
                f"Low Z-form penalty (mean = {form_summary['mean_z_form_propensity']:.2f} kcal/mol) — "
                f"sequence may adopt Z-DNA under torsional stress"
            ),
        })

    # Homopolymer runs
    for run in _detect_homopolymers(seq):
        flags.append({
            "type": "warning",
            "code": "HOMOPOLYMER",
            "region": f"{run['start']}-{run['end']}",
            "message": (
                f"Homopolymer run: {run['base']}×{run['length']} — "
                f"synthesis difficulty, polymerase slippage risk"
            ),
        })

    # Dinucleotide repeats
    for run in _detect_dinuc_repeats(seq):
        flags.append({
            "type": "warning",
            "code": "DINUC_REPEAT",
            "region": f"{run['start']}-{run['end']}",
            "message": (
                f"Dinucleotide repeat: ({run['motif']})×{run['repeats']} ({run['length']} bp) — "
                f"replication instability, microsatellite expansion risk"
            ),
        })

    # Long homopolymer runs (≥12 bp — more severe than standard ≥8 bp)
    for run in _detect_homopolymers(seq, min_length=_FLAG_LONG_HOMOPOLYMER_MIN):
        flags.append({
            "type": "warning",
            "code": "LONG_HOMOPOLYMER",
            "region": f"{run['start']}-{run['end']}",
            "message": (
                f"Long homopolymer run: {run['base']}×{run['length']} — "
                f"severe synthesis difficulty, high polymerase slippage risk"
            ),
        })

    # Extreme GC windows (GC > 80% or < 15%)
    for i, wgc in enumerate(windowed_gc):
        start = i * window_size + 1
        end = min((i + 1) * window_size, len(seq))
        if wgc > _FLAG_EXTREME_GC_HIGH:
            flags.append({
                "type": "warning",
                "code": "EXTREME_GC_WINDOW",
                "region": f"{start}-{end}",
                "message": (
                    f"Extreme high GC ({wgc:.0%}) — synthesis failure risk, "
                    f"strong secondary structure"
                ),
            })
        elif wgc < _FLAG_EXTREME_GC_LOW:
            flags.append({
                "type": "warning",
                "code": "EXTREME_GC_WINDOW",
                "region": f"{start}-{end}",
                "message": (
                    f"Extreme low GC ({wgc:.0%}) — thermodynamically unstable, "
                    f"poor primer binding"
                ),
            })

    # Silencing risk (≥3 CpG islands)
    if len(cpg_islands) >= _FLAG_SILENCING_CGI_MIN:
        flags.append({
            "type": "warning",
            "code": "SILENCING_RISK",
            "region": "global",
            "message": (
                f"Sequence contains {len(cpg_islands)} CpG islands — elevated risk of "
                f"methylation-mediated silencing in mammalian cells"
            ),
        })

    # Direct repeat detection (≥15 bp)
    seq_upper = seq.upper()
    k = _FLAG_DIRECT_REPEAT_K
    seen_kmers: dict[str, int] = {}
    if len(seq_upper) >= k:
        for i in range(len(seq_upper) - k + 1):
            kmer = seq_upper[i:i + k]
            if "N" in kmer:
                continue
            if kmer in seen_kmers:
                if seen_kmers[kmer] != -1:  # first occurrence not yet reported
                    flags.append({
                        "type": "warning",
                        "code": "DIRECT_REPEAT",
                        "region": f"{seen_kmers[kmer]+1}-{seen_kmers[kmer]+k}",
                        "message": (
                            f"Direct repeat (≥{k}bp) found at positions "
                            f"{seen_kmers[kmer]+1} and {i+1}"
                        ),
                    })
                    seen_kmers[kmer] = -1  # mark as reported
            else:
                seen_kmers[kmer] = i

    # Inverted repeat detection (≥15 bp)
    _complement = str.maketrans("ACGT", "TGCA")
    inv_reported: set[str] = set()
    if len(seq_upper) >= k:
        forward_kmers: dict[str, int] = {}
        for i in range(len(seq_upper) - k + 1):
            kmer = seq_upper[i:i + k]
            if "N" in kmer:
                continue
            rc = kmer.translate(_complement)[::-1]
            if rc in forward_kmers and rc not in inv_reported:
                flags.append({
                    "type": "warning",
                    "code": "INVERTED_REPEAT",
                    "region": f"{forward_kmers[rc]+1}-{forward_kmers[rc]+k}",
                    "message": (
                        f"Inverted repeat (≥{k}bp) — potential hairpin between "
                        f"positions {forward_kmers[rc]+1} and {i+1}"
                    ),
                })
                inv_reported.add(rc)
            forward_kmers[kmer] = i

    return flags


# ── Tm Calculation ───────────────────────────────────────────────────────


def _nn_melting_temp(
    seq: str,
    total_dh: float,
    total_ds: float,
    n_steps: int,
    salt_mm: float,
    oligo_nm: float,
) -> float:
    """SantaLucia 1998 nearest-neighbor Tm for oligonucleotides (two-state).

    Adds initiation corrections to the NN sums from compute_thermodynamics(),
    applies salt correction to ΔS, and computes two-state Tm.

    Parameters
    ----------
    seq : str
        Clean DNA sequence (no Ns).
    total_dh, total_ds : float
        Raw NN sums from compute_thermodynamics() (at 1 M NaCl).
        Units: kcal/mol (ΔH) and cal/(mol·K) (ΔS).
    n_steps : int
        Number of valid dinucleotide steps.
    salt_mm : float
        Monovalent cation concentration in mM.
    oligo_nm : float
        Total strand concentration in nM.
    """
    dh = total_dh  # kcal/mol
    ds = total_ds  # cal/(mol·K)

    # Initiation corrections (SantaLucia 1998 Table 2)
    for base in (seq[0], seq[-1]):
        if base in ("G", "C"):
            dh += _INIT_DH["GC"]
            ds += _INIT_DS["GC"]
        else:
            dh += _INIT_DH["AT"]
            ds += _INIT_DS["AT"]

    # Salt correction: ΔS(salt) = ΔS(1M) + 0.368·(N-1)·ln[Na+]
    na_m = salt_mm / 1000.0
    ds_salt = ds + 0.368 * n_steps * math.log(na_m)

    # Strand concentration: nM → M
    ct = oligo_nm * 1e-9

    # Two-state Tm: ΔH / (ΔS + R·ln(Ct/4)) − 273.15
    # Convert ΔH to cal/mol for consistent units with ΔS
    dh_cal = dh * 1000.0
    denom = ds_salt + _R_CAL * math.log(ct / 4.0)
    if denom >= 0:
        # Degenerate case: entropy term non-negative → no cooperative melting
        return 0.0
    return dh_cal / denom - 273.15


def _empirical_melting_temp(gc: float, length: int, salt_mm: float) -> float:
    """Marmur-Doty/Schildkraut empirical Tm for long DNA (>60 bp).

    Tm = 81.5 + 16.6·log10[Na+] + 41·GC − 600/N
    """
    na_m = salt_mm / 1000.0
    return 81.5 + 16.6 * math.log10(na_m) + 41.0 * gc - 600.0 / length


# ── Main Evaluation ──────────────────────────────────────────────────────


def evaluate_sequence(
    seq: str,
    name: str = "unnamed",
    analysis: str = "full",
    salt_mm: float = 1000.0,
    oligo_nm: float = 250.0,
    window_size: int = DEFAULT_WINDOW,
) -> dict:
    """Evaluate biophysical properties of an arbitrary DNA sequence.

    Parameters
    ----------
    seq : str
        DNA sequence (ACGT; Ns tolerated but skipped in computation).
    name : str
        Label for the sequence.
    analysis : str
        "full", "thermodynamic", or "structural".
    salt_mm : float
        NaCl concentration in mM for thermodynamic calculations.
    oligo_nm : float
        Total strand concentration in nM for nearest-neighbor Tm (≤60 bp).
        Default 250 nM (standard PCR primer conditions). Ignored for long DNA.
    window_size : int
        Window size in bp for windowed profiles.

    Returns
    -------
    dict
        Structured biophysical assessment with summary, profiles, and flags.
    """
    seq = seq.upper().replace(" ", "").replace("\n", "").replace("\r", "")

    # Validate
    length = len(seq)
    if length < MIN_EVALUATE_LENGTH:
        raise ValueError(f"Sequence too short ({length} bp). Minimum: {MIN_EVALUATE_LENGTH} bp.")
    if length > MAX_EVALUATE_LENGTH:
        raise ValueError(
            f"Sequence too long ({length:,} bp). Maximum: {MAX_EVALUATE_LENGTH:,} bp."
        )
    invalid = set(seq) - _VALID_BASES_WITH_N
    if invalid:
        raise ValueError(f"Invalid characters in sequence: {invalid}. Only ACGT and N allowed.")

    # Strip Ns for computation (keep positions)
    clean_seq = seq.replace("N", "")
    n_fraction = 1.0 - (len(clean_seq) / length) if length > 0 else 0.0

    # ── Compute properties ──────────────────────────────────────────

    do_thermo = analysis in ("full", "thermodynamic")
    do_structural = analysis in ("full", "structural")

    thermo_result = compute_thermodynamics(clean_seq, salt_mm=salt_mm) if do_thermo else None
    extinction_result = compute_extinction(clean_seq) if do_thermo else None
    form_result = compute_form_propensity(clean_seq) if do_structural else None
    groove_result = compute_groove_profile(clean_seq) if do_structural else None

    # ── GC and CpG analysis ─────────────────────────────────────────

    gc = _gc_content(seq)
    cpg_total = _cpg_count(seq)
    cpg_density = cpg_total / length if length > 0 else 0.0
    cpg_islands = _detect_cpg_islands(seq)

    # ── Windowed profiles ───────────────────────────────────────────

    # GC per window (computed on original seq including Ns)
    gc_per_window: list[float] = []
    for i in range(0, length, window_size):
        chunk = seq[i:i + window_size]
        gc_per_window.append(round(_gc_content(chunk), 4))

    # Stacking ΔG per window
    dg_per_window: list[float] = []
    if thermo_result and thermo_result["per_step"]:
        dg_values = [s["delta_g_37"] for s in thermo_result["per_step"]]
        dg_per_window = _windowed_profile(dg_values, window_size)

    # ── Tm estimate ──────────────────────────────────────────────────
    # ≤60 bp: SantaLucia 1998 nearest-neighbor (two-state, ±1-2°C)
    # >60 bp: Marmur-Doty/Schildkraut empirical (long-DNA, ±5°C)
    clean_len = len(clean_seq)
    use_nn = (
        clean_len <= _NN_TM_CUTOFF
        and clean_len >= 2
        and thermo_result is not None
        and thermo_result["summary"].get("n_steps", 0) > 0
    )

    if use_nn:
        ts = thermo_result["summary"]
        tm_global = _nn_melting_temp(
            clean_seq,
            total_dh=ts["total_delta_h"],
            total_ds=ts["total_delta_s"],
            n_steps=ts["n_steps"],
            salt_mm=salt_mm,
            oligo_nm=oligo_nm,
        )
        tm_method = "nearest_neighbor"
    elif length > 0:
        tm_global = _empirical_melting_temp(gc, length, salt_mm)
        tm_method = "empirical"
    else:
        tm_global = 0.0
        tm_method = "empirical"

    # ── Build response ──────────────────────────────────────────────

    result: dict[str, Any] = {
        "name": name,
        "length_bp": length,
        "n_fraction": round(n_fraction, 4),
    }

    # Summary
    summary: dict[str, Any] = {
        "gc_content": round(gc, 4),
        "cpg_count": cpg_total,
        "cpg_density": round(cpg_density, 5),
        "cpg_island_count": len(cpg_islands),
        "melting_temp_estimate_C": round(tm_global, 1),
        "tm_method": tm_method,
    }

    if thermo_result and thermo_result["summary"].get("n_steps", 0) > 0:
        ts = thermo_result["summary"]
        summary["mean_stacking_dG_salt_kcal"] = ts["mean_delta_g_per_step"]
        summary["total_stacking_dG37_kcal"] = ts["total_delta_g_37"]
        summary["mean_stacking_dG37_kcal"] = round(
            ts["total_delta_g_37"] / ts["n_steps"], 3
        ) if ts["n_steps"] > 0 else 0

    if form_result and form_result["summary"].get("n_steps", 0) > 0:
        fs = form_result["summary"]
        if "mean_a_form_propensity" in fs:
            summary["mean_a_form_propensity"] = fs["mean_a_form_propensity"]
        if "mean_z_form_propensity" in fs:
            summary["mean_z_form_propensity"] = fs["mean_z_form_propensity"]

    result["summary"] = summary
    result["cpg_islands"] = cpg_islands

    # Thermodynamics section
    if do_thermo and thermo_result:
        ts = thermo_result["summary"]
        dg_values = [s["delta_g_37"] for s in thermo_result["per_step"]]
        result["thermodynamics"] = {
            "stacking_dG37": {
                "mean": ts.get("mean_delta_g_per_step", 0),
                "total": ts.get("total_delta_g_37", 0),
                "sd": round(statistics.stdev(dg_values), 4) if len(dg_values) > 1 else 0,
                "min": round(min(dg_values), 2) if dg_values else 0,
                "max": round(max(dg_values), 2) if dg_values else 0,
            },
            "melting_temp_estimate_C": round(tm_global, 1),
            "tm_method": tm_method,
            "salt_mm": salt_mm,
            "oligo_nm": oligo_nm if tm_method == "nearest_neighbor" else None,
            "profile_windows": {
                "window_size_bp": window_size,
                "gc": gc_per_window,
                "stacking_dG37": dg_per_window,
            },
        }

    if do_thermo and extinction_result:
        es = extinction_result["summary"]
        result["extinction"] = {
            "total_e260_M_cm": es.get("total_extinction_260", 0),
            "per_base_mean": round(
                es.get("total_extinction_260", 0) / length, 1
            ) if length > 0 else 0,
        }

    # Structural section
    if do_structural and form_result:
        fs = form_result["summary"]
        result["structural"] = {
            "a_form_propensity_mean": fs.get("mean_a_form_propensity", 0),
            "z_form_propensity_mean": fs.get("mean_z_form_propensity", 0),
            "z_form_total_penalty_kcal": fs.get("total_z_penalty", 0),
        }

    if do_structural and groove_result:
        gs = groove_result["summary"]
        if "structural" not in result:
            result["structural"] = {}
        result["structural"]["groove_geometry"] = {
            "major_width_mean_A": gs.get("mean_major_groove_width", 0),
            "major_depth_mean_A": gs.get("mean_major_groove_depth", 0),
            "minor_width_mean_A": gs.get("mean_minor_groove_width", 0),
            "minor_depth_mean_A": gs.get("mean_minor_groove_depth", 0),
        }

    # ── Flags ───────────────────────────────────────────────────────

    result["flags"] = _generate_flags(
        seq=seq,
        gc=gc,
        cpg_islands=cpg_islands,
        thermo_summary=thermo_result["summary"] if thermo_result else {},
        form_summary=form_result["summary"] if form_result else {},
        windowed_dg=dg_per_window,
        windowed_gc=gc_per_window,
        window_size=window_size,
    )

    result["flag_counts"] = {
        "total": len(result["flags"]),
        "warnings": sum(1 for f in result["flags"] if f["type"] == "warning"),
        "info": sum(1 for f in result["flags"] if f["type"] == "info"),
    }

    return result
