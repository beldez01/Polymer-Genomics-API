"""Sequence-derived biophysical property computation.

Pure Python — no database access. Accepts a DNA sequence string and returns
per-dinucleotide biophysical profiles using published lookup tables from the
ingest module. All constants are SantaLucia 1998, Tataurov 2008, Ho 1986,
El Hassan & Calladine 1996/1997.
"""

from __future__ import annotations

import math
import re

import numpy as np

from polymer_genomics.ingest.reference_constants import (
    _A_FORM_PROPENSITY,
    _GROOVE_GEOMETRY,
    _SANTALUCIA_1998_DNA_DNA,
    _TATAUROV_EXTINCTION,
    _Z_FORM_PROPENSITY,
)

# Build dinucleotide -> NN params lookup for DNA/DNA (the default for genomic DNA)
_NN_PARAMS: dict[str, dict[str, float]] = {}
for _dinuc, _dh, _ds, _dg in _SANTALUCIA_1998_DNA_DNA:
    _NN_PARAMS[_dinuc] = {"delta_h": _dh, "delta_s": _ds, "delta_g_37": _dg}


def compute_thermodynamics(
    seq: str,
    salt_mm: float = 1000.0,
) -> dict:
    """Compute nearest-neighbor thermodynamic profile for a DNA sequence.

    Parameters
    ----------
    seq : str
        Uppercase DNA sequence (ACGT only).
    salt_mm : float
        NaCl concentration in millimolar. Default 1000 (= 1 M, the standard
        SantaLucia condition). Physiological is ~150 mM.

    Returns
    -------
    dict with keys:
        per_step: list of dicts with dinucleotide, delta_h, delta_s, delta_g_37,
                  delta_g_salt (salt-corrected), cumulative_dg
        summary: total ΔH, ΔS, ΔG₃₇, ΔG_salt, mean ΔG per step, n_steps
    """
    if len(seq) < 2:
        return {"per_step": [], "summary": {"n_steps": 0}}

    steps = []
    cum_dg = 0.0
    total_dh = 0.0
    total_ds = 0.0
    total_dg37 = 0.0
    n_steps = 0

    # Salt correction: SantaLucia 1998 Eq. 3
    # ΔS(salt) = ΔS(1M) + 0.368 × (N-1) × ln[Na+]
    # where N = sequence length, [Na+] in M
    na_conc = salt_mm / 1000.0
    ln_na = math.log(na_conc) if na_conc > 0 else 0.0

    for i in range(len(seq) - 1):
        dinuc = seq[i:i + 2]
        params = _NN_PARAMS.get(dinuc)
        if params is None:
            # Skip non-standard bases (N, etc.)
            continue

        dh = params["delta_h"]
        ds = params["delta_s"]
        dg37 = params["delta_g_37"]

        # Per-step salt correction
        ds_salt = ds + 0.368 * ln_na
        dg_salt = dh - (273.15 + 37) * ds_salt / 1000.0

        cum_dg += dg_salt
        total_dh += dh
        total_ds += ds
        total_dg37 += dg37
        n_steps += 1

        steps.append({
            "dinucleotide": dinuc,
            "delta_h": round(dh, 2),
            "delta_s": round(ds, 2),
            "delta_g_37": round(dg37, 2),
            "delta_g_salt": round(dg_salt, 2),
            "cumulative_dg": round(cum_dg, 2),
        })

    total_ds_salt = total_ds + 0.368 * n_steps * ln_na
    total_dg_salt = total_dh - (273.15 + 37) * total_ds_salt / 1000.0

    return {
        "per_step": steps,
        "summary": {
            "n_steps": n_steps,
            "total_delta_h": round(total_dh, 2),
            "total_delta_s": round(total_ds, 2),
            "total_delta_g_37": round(total_dg37, 2),
            "total_delta_g_salt": round(total_dg_salt, 2),
            "mean_delta_g_per_step": round(total_dg_salt / n_steps, 3) if n_steps else 0,
            "salt_mm": salt_mm,
        },
    }


def compute_extinction(seq: str) -> dict:
    """Compute nearest-neighbor extinction coefficient profile at 260 nm.

    Uses the Tataurov 2008 method: ε_oligo = Σ ε_dinuc - Σ ε_internal_mono
    where internal mononucleotide corrections are applied.

    Parameters
    ----------
    seq : str
        Uppercase DNA sequence.

    Returns
    -------
    dict with per_step and summary (total ε₂₆₀ for the oligonucleotide).
    """
    # Mononucleotide extinction coefficients at 260 nm (L/mol·cm)
    _MONO_EXT = {"A": 15400, "C": 7400, "G": 11500, "T": 8700}

    if len(seq) < 2:
        return {"per_step": [], "summary": {"n_steps": 0}}

    steps = []
    sum_dinuc = 0.0
    sum_internal_mono = 0.0

    for i in range(len(seq) - 1):
        dinuc = seq[i:i + 2]
        ext = _TATAUROV_EXTINCTION.get(dinuc)
        if ext is None:
            continue
        sum_dinuc += ext
        steps.append({"dinucleotide": dinuc, "extinction_260": ext})

    # Subtract internal mononucleotide contributions (positions 1 to N-2)
    for i in range(1, len(seq) - 1):
        mono_ext = _MONO_EXT.get(seq[i], 0)
        sum_internal_mono += mono_ext

    total_ext = sum_dinuc - sum_internal_mono

    return {
        "per_step": steps,
        "summary": {
            "n_steps": len(steps),
            "total_extinction_260": round(total_ext, 0),
            "sum_dinucleotide_ext": round(sum_dinuc, 0),
            "sum_internal_mono_ext": round(sum_internal_mono, 0),
        },
    }


def compute_form_propensity(seq: str) -> dict:
    """Compute A-form and Z-form propensity profiles.

    A-form: El Hassan & Calladine 1996 — fraction of crystal structures
    with A-like geometry per dinucleotide step.

    Z-form: Ho 1986 / Ellison 1985, using the Z-Hunt AS-AS free-energy
    table. Lower = more Z-favorable. CG steps = 0.66 (most Z-favorable).

    Returns
    -------
    dict with per_step profiles and summary statistics.
    """
    if len(seq) < 2:
        return {"per_step": [], "summary": {"n_steps": 0}}

    steps = []
    z_scores = []
    a_scores = []

    for i in range(len(seq) - 1):
        dinuc = seq[i:i + 2]
        a_prop = _A_FORM_PROPENSITY.get(dinuc)
        z_prop = _Z_FORM_PROPENSITY.get(dinuc)
        if a_prop is None and z_prop is None:
            continue
        step = {"dinucleotide": dinuc}
        if a_prop is not None:
            step["a_form_propensity"] = a_prop
            a_scores.append(a_prop)
        if z_prop is not None:
            step["z_form_propensity"] = z_prop
            z_scores.append(z_prop)
        steps.append(step)

    summary: dict = {"n_steps": len(steps)}
    if a_scores:
        summary["mean_a_form_propensity"] = round(sum(a_scores) / len(a_scores), 3)
    if z_scores:
        summary["mean_z_form_propensity"] = round(sum(z_scores) / len(z_scores), 3)
        summary["total_z_penalty"] = round(sum(z_scores), 2)

    return {"per_step": steps, "summary": summary}


def compute_groove_profile(seq: str) -> dict:
    """Compute major/minor groove geometry profile.

    Uses El Hassan & Calladine 1997 average groove dimensions from
    high-resolution B-DNA crystal structures.

    Returns
    -------
    dict with per_step groove dimensions and summary means.
    """
    if len(seq) < 2:
        return {"per_step": [], "summary": {"n_steps": 0}}

    steps = []
    maj_w, maj_d, min_w, min_d = [], [], [], []

    for i in range(len(seq) - 1):
        dinuc = seq[i:i + 2]
        geom = _GROOVE_GEOMETRY.get(dinuc)
        if geom is None:
            continue
        step = {
            "dinucleotide": dinuc,
            "major_groove_width": geom[0],
            "major_groove_depth": geom[1],
            "minor_groove_width": geom[2],
            "minor_groove_depth": geom[3],
        }
        steps.append(step)
        maj_w.append(geom[0])
        maj_d.append(geom[1])
        min_w.append(geom[2])
        min_d.append(geom[3])

    n = len(steps)
    summary: dict = {"n_steps": n}
    if n:
        summary["mean_major_groove_width"] = round(sum(maj_w) / n, 2)
        summary["mean_major_groove_depth"] = round(sum(maj_d) / n, 2)
        summary["mean_minor_groove_width"] = round(sum(min_w) / n, 2)
        summary["mean_minor_groove_depth"] = round(sum(min_d) / n, 2)

    return {"per_step": steps, "summary": summary}


# Olson WK et al. 2001 J Mol Biol 313:229-257
# "A Standard Reference Frame for the Description of Nucleic Acid Base-pair
# Geometry." Table 2: Mean base-pair step parameters from protein–DNA crystal
# structures (degrees / Angstrom).
#
# NOTE (2026-04-06): Prior values were a chimeric LLM-generated composite
# (twist from Kabsch/Trifonov 1982, other params partially from Olson 1998
# PNAS with sign errors). Replaced with standard reference frame values.
# These values should be verified against the physical paper — Table 2,
# column "Protein–DNA", rows for each of the 10 unique dinucleotide steps.
_OLSON_STRUCTURAL = {
    "AA": {"roll":  0.7, "tilt": -1.0, "twist": 35.6, "rise": 3.33, "slide": -0.08, "shift": 0.00},
    "AC": {"roll":  4.8, "tilt":  0.1, "twist": 34.4, "rise": 3.38, "slide": -0.06, "shift": 0.43},
    "AG": {"roll":  2.5, "tilt": -0.1, "twist": 27.7, "rise": 3.38, "slide":  0.27, "shift":-0.04},
    "AT": {"roll": -2.4, "tilt":  0.0, "twist": 31.5, "rise": 3.34, "slide": -0.55, "shift": 0.00},
    "CA": {"roll":  6.5, "tilt":  0.5, "twist": 34.5, "rise": 3.35, "slide":  0.49, "shift": 0.46},
    "CC": {"roll":  1.6, "tilt": -0.1, "twist": 33.7, "rise": 3.38, "slide":  0.17, "shift": 0.10},
    "CG": {"roll":  3.5, "tilt":  0.0, "twist": 29.8, "rise": 3.42, "slide":  0.26, "shift": 0.00},
    "CT": {"roll":  2.5, "tilt":  0.1, "twist": 27.7, "rise": 3.38, "slide":  0.27, "shift": 0.04},
    "GA": {"roll":  0.7, "tilt":  0.7, "twist": 36.9, "rise": 3.38, "slide": -0.01, "shift":-0.03},
    "GC": {"roll": -6.2, "tilt":  0.0, "twist": 40.0, "rise": 3.36, "slide": -0.46, "shift": 0.00},
    "GG": {"roll":  1.6, "tilt":  0.1, "twist": 33.7, "rise": 3.38, "slide":  0.17, "shift":-0.10},
    "GT": {"roll":  4.8, "tilt": -0.1, "twist": 34.4, "rise": 3.38, "slide": -0.06, "shift":-0.43},
    "TA": {"roll":  1.4, "tilt":  0.0, "twist": 36.0, "rise": 3.37, "slide":  0.19, "shift": 0.00},
    "TC": {"roll":  0.7, "tilt": -0.7, "twist": 36.9, "rise": 3.38, "slide": -0.01, "shift": 0.03},
    "TG": {"roll":  6.5, "tilt": -0.5, "twist": 34.5, "rise": 3.35, "slide":  0.49, "shift":-0.46},
    "TT": {"roll":  0.7, "tilt":  1.0, "twist": 35.6, "rise": 3.33, "slide": -0.08, "shift": 0.00},
}

# Heddi et al. 2010 TRX flexibility scale (% BII conformer population)
_TRX_DEFORMABILITY = {
    "AA":  5, "AC":  4, "AG":  9, "AT":  0,
    "CA": 42, "CC": 42, "CG": 43, "CT":  9,
    "GA": 22, "GC": 25, "GG": 42, "GT":  4,
    "TA": 14, "TC": 22, "TG": 42, "TT":  5,
}


def compute_structural(sequence: str) -> dict:
    """Compute Olson 1998 structural parameters + TRX deformability per step."""
    seq = sequence.upper()
    if len(seq) < 2:
        return {"per_step": [], "summary": {"n_steps": 0}}

    per_step = []
    for i in range(len(seq) - 1):
        dinuc = seq[i:i+2]
        struct = _OLSON_STRUCTURAL.get(dinuc)
        trx = _TRX_DEFORMABILITY.get(dinuc)
        if struct is None or trx is None:
            continue
        per_step.append({
            "dinucleotide": dinuc,
            "roll": struct["roll"],
            "tilt": struct["tilt"],
            "twist": struct["twist"],
            "rise": struct["rise"],
            "slide": struct["slide"],
            "shift": struct["shift"],
            "deformability": trx,
        })

    n = len(per_step)
    summary = {"n_steps": n}
    if n > 0:
        for key in ("roll", "tilt", "twist", "rise", "slide", "shift", "deformability"):
            vals = [s[key] for s in per_step]
            summary[f"mean_{key}"] = round(sum(vals) / n, 3)
    return {"per_step": per_step, "summary": summary}


def compute_contextual(sequence: str, window: int = 10) -> dict:
    """Compute contextual biophysical features using sliding windows.

    Features per step:
    - delta_g_37: raw step stacking energy (kcal/mol)
    - local_stability: windowed mean ΔG (kcal/mol/step)
    - context_deviation: step ΔG minus local mean (positive = weaker than context)
    - bubble_propensity: sigmoid-scaled probability of local denaturation (0-1)
    - deformability: raw TRX value (0-43)
    - local_flexibility: windowed mean TRX deformability
    """
    seq = sequence.upper()
    n = len(seq) - 1
    if n < 1:
        return {"per_step": [], "summary": {"n_steps": 0}}

    # Build per-step arrays
    dg_values = np.full(n, np.nan)
    trx_values = np.full(n, np.nan)

    for i in range(n):
        dinuc = seq[i:i+2]
        params = _NN_PARAMS.get(dinuc)
        if params:
            dg_values[i] = params["delta_g_37"]
        trx = _TRX_DEFORMABILITY.get(dinuc)
        if trx is not None:
            trx_values[i] = float(trx)

    # Centered rolling mean with edge handling
    def _windowed_mean(arr: np.ndarray, w: int) -> np.ndarray:
        result = np.full(len(arr), np.nan)
        valid = ~np.isnan(arr)
        cs = np.where(valid, arr, 0.0).cumsum()
        cs = np.insert(cs, 0, 0.0)
        cv = valid.astype(float).cumsum()
        cv = np.insert(cv, 0, 0.0)
        half = w // 2
        for i in range(len(arr)):
            lo = max(0, i - half)
            hi = min(len(arr), i + half + 1)
            count = cv[hi] - cv[lo]
            if count > 0:
                result[i] = (cs[hi] - cs[lo]) / count
        return result

    local_dg = _windowed_mean(dg_values, window)
    local_trx = _windowed_mean(trx_values, window)

    # Context deviation: step ΔG minus local mean
    # Positive = weaker than context (vulnerability), negative = stronger (anchor)
    context_dev = dg_values - local_dg

    # Bubble propensity: sigmoid of how much local ΔG exceeds stability threshold.
    # ASSUMPTION (evidence class H — unjustified, 2026-04-06):
    #   Center = -1.2 kcal/mol/step and gain = 4.0 are NOT from any published
    #   calibration. They were chosen as heuristic values. The center approximates
    #   the genome-wide mean ΔG, and the gain controls steepness. These have NOT
    #   been validated against experimental denaturation data (e.g., permanganate-seq).
    #   Until calibrated, treat this as a relative ranking, not a probability.
    bubble_prop = 1.0 / (1.0 + np.exp(-4.0 * (local_dg + 1.2)))

    # Build per-step output
    per_step = []
    for i in range(n):
        dinuc = seq[i:i+2]
        entry: dict = {"position": i, "dinucleotide": dinuc}
        if not np.isnan(dg_values[i]):
            entry["delta_g_37"] = round(float(dg_values[i]), 3)
            entry["local_stability"] = round(float(local_dg[i]), 3)
            entry["context_deviation"] = round(float(context_dev[i]), 3)
            entry["bubble_propensity"] = round(float(bubble_prop[i]), 4)
        if not np.isnan(trx_values[i]):
            entry["deformability"] = int(trx_values[i])
            entry["local_flexibility"] = round(float(local_trx[i]), 2)
        per_step.append(entry)

    summary = {
        "n_steps": n,
        "window": window,
        "mean_bubble_propensity": round(float(np.nanmean(bubble_prop)), 4),
        "max_bubble_propensity": round(float(np.nanmax(bubble_prop)), 4),
        "mean_flexibility": round(float(np.nanmean(local_trx)), 2),
    }

    return {"per_step": per_step, "summary": summary}


def compute_curvature(sequence: str, window: int = 21) -> dict:
    """Compute local DNA curvature via trajectory integration (wedge model).

    Uses the Trifonov/Bolshoy wedge model: at each dinucleotide step, the
    roll and tilt define a local deflection whose *direction* rotates with
    cumulative twist along the helix. Curvature over a window is the magnitude
    of the vector sum of these deflections, divided by window length.

    This correctly handles phased bending: A-tracts every ~10bp produce large
    coherent curvature because their small, consistent deflections add in
    phase. Random sequences produce small curvature (random walk cancellation).

    Window default = 21bp (two helical turns, standard for curvature analysis).

    References:
        Trifonov & Sussman 1980 PNAS 77:3816
        Bolshoy et al. 1991 PNAS 88:2312
        Olson et al. 2001 J Mol Biol 313:229
    """
    seq = sequence.upper()
    n = len(seq) - 1
    if n < 1:
        return {"per_step": [], "summary": {"n_steps": 0}}

    DEG2RAD = math.pi / 180.0

    roll_vals = np.zeros(n)
    tilt_vals = np.zeros(n)
    twist_vals = np.zeros(n)
    valid = np.zeros(n, dtype=bool)

    for i in range(n):
        dinuc = seq[i:i + 2]
        s = _OLSON_STRUCTURAL.get(dinuc)
        if s:
            roll_vals[i] = s["roll"]
            tilt_vals[i] = s["tilt"]
            twist_vals[i] = s["twist"]
            valid[i] = True

    # Cumulative twist angle (radians) — defines the direction of each step's
    # bend contribution in the global frame
    cum_twist = np.cumsum(twist_vals) * DEG2RAD

    # Each step contributes a deflection vector in the plane perpendicular
    # to the helix axis. The direction rotates with cumulative twist.
    # deflection_x = roll * cos(cum_twist) - tilt * sin(cum_twist)
    # deflection_y = roll * sin(cum_twist) + tilt * cos(cum_twist)
    roll_rad = roll_vals * DEG2RAD
    tilt_rad = tilt_vals * DEG2RAD
    dx = roll_rad * np.cos(cum_twist) - tilt_rad * np.sin(cum_twist)
    dy = roll_rad * np.sin(cum_twist) + tilt_rad * np.cos(cum_twist)

    # Windowed curvature = |vector sum of deflections| / window_length
    cs_dx = np.insert(np.cumsum(dx), 0, 0.0)
    cs_dy = np.insert(np.cumsum(dy), 0, 0.0)

    curvatures = np.zeros(n)
    half = window // 2
    for i in range(n):
        lo = max(0, i - half)
        hi = min(n, i + half + 1)
        w = hi - lo
        if w > 0:
            sum_dx = cs_dx[hi] - cs_dx[lo]
            sum_dy = cs_dy[hi] - cs_dy[lo]
            curvatures[i] = math.sqrt(sum_dx ** 2 + sum_dy ** 2) / w

    # Convert back to degrees/step for interpretability
    curvatures_deg = curvatures / DEG2RAD

    per_step = []
    for i in range(n):
        dinuc = seq[i:i + 2]
        entry: dict = {
            "position": i,
            "dinucleotide": dinuc,
            "curvature": round(float(curvatures_deg[i]), 3),
        }
        if valid[i]:
            entry["roll"] = round(float(roll_vals[i]), 2)
            entry["tilt"] = round(float(tilt_vals[i]), 2)
        per_step.append(entry)

    summary = {
        "n_steps": n,
        "window": window,
        "mean_curvature": round(float(np.mean(curvatures_deg)), 3),
        "max_curvature": round(float(np.max(curvatures_deg)), 3),
    }
    return {"per_step": per_step, "summary": summary}


_COMPLEMENT = str.maketrans("ACGT", "TGCA")


def detect_motifs(sequence: str) -> dict:
    """Detect structural motifs in a DNA sequence.

    Returns dict with lists of motif annotations:
    - g_quadruplex: G3+N1-7 patterns (potential G4 structures)
    - z_dna_prone: alternating purine-pyrimidine runs ≥8bp with low Z penalty
    - homopolymer_runs: poly-A, poly-T, poly-G, poly-C runs ≥5bp
    - inverted_repeats: potential hairpin stems (≥6bp palindromic sequences)
    """
    seq = sequence.upper()
    n = len(seq)

    # G-quadruplex: G3+N{1,7}G3+N{1,7}G3+N{1,7}G3+
    g4_pattern = re.compile(r"(G{3,})\w{1,7}(G{3,})\w{1,7}(G{3,})\w{1,7}(G{3,})")
    g4_hits = []
    for m in g4_pattern.finditer(seq):
        g4_hits.append({
            "start": m.start(),
            "end": m.end(),
            "sequence": m.group(),
            "g_run_lengths": [len(g) for g in m.groups()],
        })

    # Z-DNA: alternating purine-pyrimidine ≥8bp
    z_dna = []
    pur_pyr = "".join("R" if b in "AG" else "Y" if b in "CT" else "N" for b in seq)
    for m in re.finditer(r"(?:RY){4,}|(?:YR){4,}", pur_pyr):
        region = seq[m.start():m.end()]
        penalties = [_Z_FORM_PROPENSITY.get(region[i:i+2], 5.0) for i in range(len(region)-1)]
        mean_penalty = sum(penalties) / len(penalties) if penalties else 5.0
        if mean_penalty < 2.5:
            z_dna.append({
                "start": m.start(),
                "end": m.end(),
                "length": m.end() - m.start(),
                "mean_z_penalty": round(mean_penalty, 2),
            })

    # Homopolymer runs ≥5bp
    homo_runs = []
    for base, label in [("A", "poly_A"), ("T", "poly_T"), ("G", "poly_G"), ("C", "poly_C")]:
        for m in re.finditer(f"{base}{{5,}}", seq):
            homo_runs.append({
                "type": label,
                "start": m.start(),
                "end": m.end(),
                "length": m.end() - m.start(),
            })
    homo_runs.sort(key=lambda x: x["start"])

    # Inverted repeats (potential hairpins): palindromic sequences ≥6bp
    inv_repeats = []
    min_stem = 6
    max_loop = 12
    for stem_len in range(min_stem, min(20, n // 2) + 1):
        for i in range(n - 2 * stem_len - 1):
            stem5 = seq[i:i + stem_len]
            if "N" in stem5:
                continue
            rc = stem5.translate(_COMPLEMENT)[::-1]
            search_start = i + stem_len
            search_end = min(i + stem_len + max_loop + stem_len, n)
            search_region = seq[search_start:search_end]
            pos = search_region.find(rc)
            if pos != -1:
                loop_len = pos
                if loop_len >= 3:
                    inv_repeats.append({
                        "start": i,
                        "end": search_start + pos + stem_len,
                        "stem_length": stem_len,
                        "loop_length": loop_len,
                        "stem_5prime": stem5,
                    })

    # Deduplicate overlapping inverted repeats — keep longest
    inv_repeats.sort(key=lambda x: -(x["stem_length"]))
    kept = []
    used = set()
    for ir in inv_repeats:
        positions = set(range(ir["start"], ir["end"]))
        if not positions & used:
            kept.append(ir)
            used |= positions
    inv_repeats = sorted(kept, key=lambda x: x["start"])

    return {
        "g_quadruplex": g4_hits,
        "z_dna_prone": z_dna,
        "homopolymer_runs": homo_runs,
        "inverted_repeats": inv_repeats,
    }


def compute_all(
    seq: str,
    salt_mm: float = 1000.0,
) -> dict:
    """Compute all biophysical properties for a sequence.

    Convenience wrapper that calls all compute functions and
    returns their results keyed by property name.
    """
    return {
        "thermodynamics": compute_thermodynamics(seq, salt_mm=salt_mm),
        "extinction": compute_extinction(seq),
        "form_propensity": compute_form_propensity(seq),
        "groove": compute_groove_profile(seq),
        "structural": compute_structural(seq),
        "contextual": compute_contextual(seq),
        "curvature": compute_curvature(seq),
        "motifs": detect_motifs(seq),
    }
