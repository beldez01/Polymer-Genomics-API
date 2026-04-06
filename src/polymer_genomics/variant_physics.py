"""Variant biophysical perturbation computation.

Pure Python — no database access. Accepts ref and alt sequences centered
on a variant and computes delta biophysical properties using the existing
biophysics module.
"""

from __future__ import annotations

from polymer_genomics.biophysics import (
    compute_thermodynamics,
    compute_structural,
    compute_curvature,
    compute_groove_profile,
    detect_motifs,
)

DEFAULT_FLANK = 50


def compute_variant_deltas(
    ref_seq: str,
    alt_seq: str,
    variant_pos: int,
    salt_mm: float = 1000.0,
) -> dict:
    """Compute biophysical delta between ref and alt sequences."""
    ref_thermo = compute_thermodynamics(ref_seq, salt_mm=salt_mm)
    alt_thermo = compute_thermodynamics(alt_seq, salt_mm=salt_mm)

    ref_s = ref_thermo.get("summary", {})
    alt_s = alt_thermo.get("summary", {})

    delta_dg37 = (alt_s.get("total_delta_g_37", 0) or 0) - (ref_s.get("total_delta_g_37", 0) or 0)
    delta_dh = (alt_s.get("total_delta_h", 0) or 0) - (ref_s.get("total_delta_h", 0) or 0)
    delta_ds = (alt_s.get("total_delta_s", 0) or 0) - (ref_s.get("total_delta_s", 0) or 0)

    ref_mean_dg = ref_s.get("mean_delta_g_per_step", 0) or 0
    alt_mean_dg = alt_s.get("mean_delta_g_per_step", 0) or 0
    delta_tm = (alt_mean_dg - ref_mean_dg) * 3.0

    thermo_result = {
        "delta_dg37": round(delta_dg37, 4),
        "delta_dh": round(delta_dh, 4),
        "delta_ds": round(delta_ds, 4),
        "delta_tm": round(delta_tm, 4),
        "ref_total_dg37": round(ref_s.get("total_delta_g_37", 0) or 0, 4),
        "alt_total_dg37": round(alt_s.get("total_delta_g_37", 0) or 0, 4),
    }

    structural_result = _compute_structural_deltas(ref_seq, alt_seq)
    curvature_result = _compute_curvature_deltas(ref_seq, alt_seq)
    groove_result = _compute_groove_deltas(ref_seq, alt_seq)
    motif_result = _compute_motif_changes(ref_seq, alt_seq)
    cpg_result = _compute_cpg_impact(ref_seq, alt_seq, variant_pos)
    nucleosome_result = _compute_nucleosome_disruption(ref_seq, alt_seq)

    all_deltas = {
        "thermodynamics": thermo_result,
        "structural": structural_result,
        "curvature": curvature_result,
        "groove": groove_result,
        "motifs": motif_result,
        "cpg_impact": cpg_result,
        "nucleosome": nucleosome_result,
    }

    mechanism = _generate_mechanism_summary(all_deltas)
    all_deltas["mechanism"] = mechanism

    return all_deltas


def _compute_structural_deltas(ref_seq: str, alt_seq: str) -> dict:
    ref_struct = compute_structural(ref_seq)
    alt_struct = compute_structural(alt_seq)
    ref_s = ref_struct.get("summary", {})
    alt_s = alt_struct.get("summary", {})

    deltas = {}
    for key in ("mean_roll", "mean_tilt", "mean_twist", "mean_rise",
                "mean_slide", "mean_shift", "mean_deformability"):
        rv = ref_s.get(key, 0) or 0
        av = alt_s.get(key, 0) or 0
        deltas[f"delta_{key}"] = round(av - rv, 4)
    return deltas


def _compute_curvature_deltas(ref_seq: str, alt_seq: str) -> dict:
    ref_curv = compute_curvature(ref_seq)
    alt_curv = compute_curvature(alt_seq)
    ref_s = ref_curv.get("summary", {})
    alt_s = alt_curv.get("summary", {})

    return {
        "delta_mean_curvature": round(
            (alt_s.get("mean_curvature", 0) or 0) - (ref_s.get("mean_curvature", 0) or 0), 4),
        "delta_max_curvature": round(
            (alt_s.get("max_curvature", 0) or 0) - (ref_s.get("max_curvature", 0) or 0), 4),
    }


def _compute_groove_deltas(ref_seq: str, alt_seq: str) -> dict:
    ref_g = compute_groove_profile(ref_seq)
    alt_g = compute_groove_profile(alt_seq)
    ref_s = ref_g.get("summary", {})
    alt_s = alt_g.get("summary", {})

    deltas = {}
    for key in ("mean_minor_width", "mean_major_width",
                "mean_minor_depth", "mean_major_depth"):
        rv = ref_s.get(key, 0) or 0
        av = alt_s.get(key, 0) or 0
        deltas[f"delta_{key}"] = round(av - rv, 4)
    return deltas


def _compute_motif_changes(ref_seq: str, alt_seq: str) -> dict:
    ref_m = detect_motifs(ref_seq)
    alt_m = detect_motifs(alt_seq)

    changes = []
    for motif_type in ("g_quadruplex", "z_dna", "homopolymers", "inverted_repeats"):
        ref_count = len(ref_m.get(motif_type, []))
        alt_count = len(alt_m.get(motif_type, []))
        if ref_count != alt_count:
            if alt_count > ref_count:
                changes.append({"type": motif_type, "change": "created",
                                "ref_count": ref_count, "alt_count": alt_count})
            else:
                changes.append({"type": motif_type, "change": "destroyed",
                                "ref_count": ref_count, "alt_count": alt_count})

    return {"changes": changes, "n_changes": len(changes)}


def _compute_cpg_impact(ref_seq: str, alt_seq: str, variant_pos: int) -> dict:
    def _count_cpg_at_pos(seq: str, pos: int) -> int:
        count = 0
        if pos > 0 and seq[pos - 1:pos + 1] == "CG":
            count += 1
        if pos < len(seq) - 1 and seq[pos:pos + 2] == "CG":
            count += 1
        return count

    ref_cpg = _count_cpg_at_pos(ref_seq, variant_pos)
    alt_cpg = _count_cpg_at_pos(alt_seq, variant_pos)

    if alt_cpg > ref_cpg:
        impact = "cpg_created"
    elif alt_cpg < ref_cpg:
        impact = "cpg_destroyed"
    else:
        impact = "no_change"

    ref_total = ref_seq.count("CG")
    alt_total = alt_seq.count("CG")

    return {
        "impact": impact,
        "ref_cpg_at_variant": ref_cpg,
        "alt_cpg_at_variant": alt_cpg,
        "ref_cpg_in_window": ref_total,
        "alt_cpg_in_window": alt_total,
        "delta_cpg_count": alt_total - ref_total,
    }


def _compute_nucleosome_disruption(ref_seq: str, alt_seq: str) -> dict:
    """Estimate nucleosome disruption from variant.

    Uses AA/TT periodicity alignment as a proxy for nucleosome positioning
    preference (Segal & Widom 2009).
    """
    import numpy as np

    def _periodicity_score(seq: str) -> float:
        if len(seq) < 21:
            return 0.0
        aa_tt_positions = []
        for i in range(len(seq) - 1):
            dinuc = seq[i:i + 2]
            if dinuc in ("AA", "TT", "AT", "TA"):
                aa_tt_positions.append(i)
        if len(aa_tt_positions) < 2:
            return 0.0
        signal = np.zeros(len(seq) - 1)
        for p in aa_tt_positions:
            signal[p] = 1.0
        if len(signal) < 22:
            return 0.0
        corr_10 = float(np.corrcoef(signal[:-10], signal[10:])[0, 1]) if len(signal) > 10 else 0.0
        corr_11 = float(np.corrcoef(signal[:-11], signal[11:])[0, 1]) if len(signal) > 11 else 0.0
        # Handle NaN from constant signals
        if np.isnan(corr_10):
            corr_10 = 0.0
        if np.isnan(corr_11):
            corr_11 = 0.0
        return (corr_10 + corr_11) / 2

    ref_period = _periodicity_score(ref_seq)
    alt_period = _periodicity_score(alt_seq)
    delta = alt_period - ref_period

    return {
        "disruption_score": round(abs(delta), 4),
        "delta_periodicity": round(delta, 4),
        "ref_periodicity": round(ref_period, 4),
        "alt_periodicity": round(alt_period, 4),
        "interpretation": (
            "nucleosome_destabilized" if delta < -0.05
            else "nucleosome_stabilized" if delta > 0.05
            else "minimal_disruption"
        ),
    }


def _generate_mechanism_summary(deltas: dict) -> list[str]:
    """Generate human-readable mechanism statements from computed deltas."""
    mechanisms = []
    thermo = deltas.get("thermodynamics", {})
    ddg = thermo.get("delta_dg37", 0)
    if abs(ddg) > 0.5:
        direction = "destabilizes" if ddg > 0 else "stabilizes"
        mechanisms.append(f"Variant {direction} local duplex by {abs(ddg):.2f} kcal/mol (DDG37)")

    dtm = thermo.get("delta_tm", 0)
    if abs(dtm) > 1.0:
        direction = "raises" if dtm > 0 else "lowers"
        mechanisms.append(f"Predicted Tm shift: {direction} by {abs(dtm):.1f}C")

    cpg = deltas.get("cpg_impact", {})
    impact = cpg.get("impact", "no_change")
    if impact == "cpg_created":
        mechanisms.append("Creates a new CpG site -- potential new methylation target")
    elif impact == "cpg_destroyed":
        mechanisms.append("Destroys a CpG site -- loss of methylation target")

    motifs = deltas.get("motifs", {})
    for change in motifs.get("changes", []):
        motif_name = change["type"].replace("_", " ")
        if change["change"] == "created":
            mechanisms.append(f"Creates {motif_name} motif ({change['ref_count']}->{change['alt_count']})")
        else:
            mechanisms.append(f"Destroys {motif_name} motif ({change['ref_count']}->{change['alt_count']})")

    nuc = deltas.get("nucleosome", {})
    nuc_interp = nuc.get("interpretation", "minimal_disruption")
    if nuc_interp == "nucleosome_destabilized":
        mechanisms.append(f"Disrupts nucleosome positioning (delta_periodicity={nuc.get('delta_periodicity', 0):.3f})")
    elif nuc_interp == "nucleosome_stabilized":
        mechanisms.append(f"Stabilizes nucleosome positioning (delta_periodicity={nuc.get('delta_periodicity', 0):.3f})")

    struct = deltas.get("structural", {})
    d_twist = struct.get("delta_mean_twist", 0)
    if abs(d_twist) > 0.5:
        mechanisms.append(f"Alters helical twist by {d_twist:+.2f} deg/step")

    if not mechanisms:
        mechanisms.append("Minimal biophysical perturbation detected")

    return mechanisms


def apply_variant(ref_seq: str, pos: int, ref_allele: str, alt_allele: str) -> str:
    """Apply a variant to a reference sequence and return the alt sequence."""
    actual = ref_seq[pos:pos + len(ref_allele)]
    if actual.upper() != ref_allele.upper():
        raise ValueError(
            f"Reference mismatch at pos {pos}: expected '{ref_allele}', "
            f"found '{actual}'"
        )
    return ref_seq[:pos] + alt_allele + ref_seq[pos + len(ref_allele):]
