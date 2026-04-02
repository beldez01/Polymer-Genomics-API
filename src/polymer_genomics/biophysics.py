"""Sequence-derived biophysical property computation.

Pure Python — no database access. Accepts a DNA sequence string and returns
per-dinucleotide biophysical profiles using published lookup tables from the
ingest module. All constants are SantaLucia 1998, Tataurov 2008, Ho 1986,
El Hassan & Calladine 1996/1997.
"""

from __future__ import annotations

import math

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


# Olson et al. 1998 structural parameters (degrees / Angstrom)
_OLSON_STRUCTURAL = {
    "AA": {"roll": -0.7, "tilt": -0.2, "twist": 35.6, "rise": 3.27, "slide": -0.06, "shift": 0.00},
    "AC": {"roll":  1.0, "tilt":  1.0, "twist": 34.0, "rise": 3.38, "slide":  0.22, "shift":  0.13},
    "AG": {"roll":  5.3, "tilt": -0.3, "twist": 34.4, "rise": 3.29, "slide":  0.30, "shift": -0.01},
    "AT": {"roll":  2.6, "tilt":  0.0, "twist": 31.5, "rise": 3.39, "slide": -0.22, "shift":  0.00},
    "CA": {"roll":  4.2, "tilt":  0.7, "twist": 34.5, "rise": 3.26, "slide":  0.34, "shift":  0.18},
    "CC": {"roll":  2.4, "tilt": -1.0, "twist": 32.9, "rise": 3.38, "slide":  0.47, "shift":  0.15},
    "CG": {"roll":  3.5, "tilt":  0.0, "twist": 29.8, "rise": 3.32, "slide":  0.19, "shift":  0.00},
    "CT": {"roll":  5.3, "tilt":  0.3, "twist": 34.4, "rise": 3.29, "slide":  0.30, "shift": -0.01},
    "GA": {"roll":  1.3, "tilt":  1.5, "twist": 36.9, "rise": 3.38, "slide":  0.09, "shift":  0.12},
    "GC": {"roll":  0.7, "tilt":  0.0, "twist": 40.0, "rise": 3.38, "slide":  0.57, "shift":  0.00},
    "GG": {"roll":  2.4, "tilt":  1.0, "twist": 32.9, "rise": 3.38, "slide":  0.47, "shift":  0.15},
    "GT": {"roll":  1.0, "tilt": -1.0, "twist": 34.0, "rise": 3.38, "slide":  0.22, "shift":  0.13},
    "TA": {"roll":  3.3, "tilt":  0.0, "twist": 36.0, "rise": 3.38, "slide":  0.20, "shift":  0.00},
    "TC": {"roll":  1.3, "tilt": -1.5, "twist": 36.9, "rise": 3.38, "slide":  0.09, "shift":  0.12},
    "TG": {"roll":  4.2, "tilt": -0.7, "twist": 34.5, "rise": 3.26, "slide":  0.34, "shift":  0.18},
    "TT": {"roll": -0.7, "tilt":  0.2, "twist": 35.6, "rise": 3.27, "slide": -0.06, "shift":  0.00},
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


def compute_all(
    seq: str,
    salt_mm: float = 1000.0,
) -> dict:
    """Compute all biophysical properties for a sequence.

    Convenience wrapper that calls all four compute functions and
    returns their results keyed by property name.
    """
    return {
        "thermodynamics": compute_thermodynamics(seq, salt_mm=salt_mm),
        "extinction": compute_extinction(seq),
        "form_propensity": compute_form_propensity(seq),
        "groove": compute_groove_profile(seq),
    }
