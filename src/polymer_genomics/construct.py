"""Construct Physics Evaluator — Module 5 of the Design Tools suite.

Evaluates multi-part DNA constructs (promoter + insert + terminator + backbone)
by reusing the single-sequence evaluate_sequence engine for per-part and
junction analysis, then layering construct-level assembly flags on top.

Pure Python — no database access, no FASTA lookup.
"""

from __future__ import annotations

import re
from typing import Any

from polymer_genomics.evaluate import evaluate_sequence, _gc_content

# ── Constants ────────────────────────────────────────────────────────────

JUNCTION_FLANK_BP = 25  # bp on each side of a junction

# Common 6-cutter restriction enzymes used in cloning
RESTRICTION_SITES: dict[str, str] = {
    "EcoRI": "GAATTC",
    "BamHI": "GGATCC",
    "HindIII": "AAGCTT",
    "XbaI": "TCTAGA",
    "SalI": "GTCGAC",
    "NotI": "GCGGCCGC",
}

# Assembly flag thresholds
_HOMOPOLYMER_JUNCTION_MIN = 7  # >6bp at junctions
_DIRECT_REPEAT_MIN = 13  # >12bp between parts
_GC_WINDOW_SIZE = 100
_GC_EXTREME_LOW = 0.25
_GC_EXTREME_HIGH = 0.75

VALID_ROLES = frozenset({
    "generic", "promoter", "cds", "utr5", "utr3",
    "terminator", "backbone", "linker", "spacer",
})

MAX_PARTS = 20
MAX_TOTAL_LENGTH = 500_000  # 500 kb total construct


# ── Helpers ──────────────────────────────────────────────────────────────

def _find_restriction_sites(seq: str) -> list[dict[str, Any]]:
    """Find occurrences of common restriction enzyme recognition sites."""
    seq_upper = seq.upper()
    hits: list[dict[str, Any]] = []
    for enzyme, site in RESTRICTION_SITES.items():
        start = 0
        while True:
            idx = seq_upper.find(site, start)
            if idx == -1:
                break
            hits.append({
                "enzyme": enzyme,
                "site": site,
                "position": idx + 1,  # 1-based
                "end": idx + len(site),
            })
            start = idx + 1
    return hits


def _find_homopolymers(seq: str, min_length: int = _HOMOPOLYMER_JUNCTION_MIN) -> list[dict[str, Any]]:
    """Find homopolymer runs of length > min_length."""
    runs: list[dict[str, Any]] = []
    if len(seq) < min_length:
        return runs
    pattern = re.compile(r"([ACGT])\1{" + str(min_length - 1) + r",}")
    for m in pattern.finditer(seq.upper()):
        runs.append({
            "base": m.group(1),
            "length": m.end() - m.start(),
            "start": m.start() + 1,  # 1-based
            "end": m.end(),
        })
    return runs


def _find_direct_repeats_between(seq_a: str, seq_b: str, k: int = _DIRECT_REPEAT_MIN) -> list[dict[str, Any]]:
    """Find shared k-mers between two sequences (direct repeats across parts)."""
    repeats: list[dict[str, Any]] = []
    if len(seq_a) < k or len(seq_b) < k:
        return repeats
    a_upper = seq_a.upper()
    b_upper = seq_b.upper()

    # Build k-mer index from seq_a
    a_kmers: dict[str, int] = {}
    for i in range(len(a_upper) - k + 1):
        kmer = a_upper[i:i + k]
        if "N" not in kmer and kmer not in a_kmers:
            a_kmers[kmer] = i

    # Scan seq_b for matches
    reported: set[str] = set()
    for j in range(len(b_upper) - k + 1):
        kmer = b_upper[j:j + k]
        if "N" in kmer:
            continue
        if kmer in a_kmers and kmer not in reported:
            repeats.append({
                "sequence": kmer,
                "length": k,
                "position_a": a_kmers[kmer] + 1,  # 1-based
                "position_b": j + 1,
            })
            reported.add(kmer)

    return repeats


def _find_extreme_gc_windows(seq: str, window: int = _GC_WINDOW_SIZE) -> list[dict[str, Any]]:
    """Find windows with GC < 25% or > 75%."""
    flagged: list[dict[str, Any]] = []
    if len(seq) < window:
        gc = _gc_content(seq.upper())
        if gc < _GC_EXTREME_LOW or gc > _GC_EXTREME_HIGH:
            flagged.append({
                "start": 1,
                "end": len(seq),
                "gc": round(gc, 3),
                "issue": "low" if gc < _GC_EXTREME_LOW else "high",
            })
        return flagged

    for i in range(0, len(seq), window):
        chunk = seq[i:i + window].upper()
        gc = _gc_content(chunk)
        if gc < _GC_EXTREME_LOW or gc > _GC_EXTREME_HIGH:
            flagged.append({
                "start": i + 1,
                "end": min(i + window, len(seq)),
                "gc": round(gc, 3),
                "issue": "low" if gc < _GC_EXTREME_LOW else "high",
            })
    return flagged


# ── Main Evaluation ──────────────────────────────────────────────────────

def evaluate_construct(
    parts: list[dict[str, Any]],
    name: str = "construct",
    circular: bool = False,
    salt_mm: float = 150.0,
    analysis: str = "full",
) -> dict[str, Any]:
    """Evaluate a multi-part DNA construct.

    Parameters
    ----------
    parts : list of dict
        Each dict has keys: name (str), sequence (str), role (str).
    name : str
        Label for the construct.
    circular : bool
        True for plasmid (evaluate closing junction), False for linear.
    salt_mm : float
        NaCl concentration in mM for thermodynamic calculations.
    analysis : str
        "full", "thermodynamic", or "structural".

    Returns
    -------
    dict
        Keys: summary, parts, junctions, assembly_flags.
    """
    # ── Validate inputs ──────────────────────────────────────────────
    if not parts:
        raise ValueError("Construct must have at least one part.")
    if len(parts) > MAX_PARTS:
        raise ValueError(f"Too many parts ({len(parts)}). Maximum: {MAX_PARTS}.")

    for i, p in enumerate(parts):
        if "sequence" not in p or not p["sequence"]:
            raise ValueError(f"Part {i} ('{p.get('name', 'unnamed')}') has no sequence.")
        if "name" not in p:
            p["name"] = f"part_{i}"
        if "role" not in p:
            p["role"] = "generic"
        if p["role"] not in VALID_ROLES:
            raise ValueError(
                f"Invalid role '{p['role']}' for part '{p['name']}'. "
                f"Valid roles: {sorted(VALID_ROLES)}"
            )
        p["sequence"] = p["sequence"].upper().replace(" ", "").replace("\n", "").replace("\r", "")

    total_length = sum(len(p["sequence"]) for p in parts)
    if total_length > MAX_TOTAL_LENGTH:
        raise ValueError(
            f"Total construct length ({total_length:,} bp) exceeds maximum "
            f"({MAX_TOTAL_LENGTH:,} bp)."
        )

    # ── 1. Evaluate each part independently ──────────────────────────
    part_results: list[dict[str, Any]] = []
    for p in parts:
        try:
            result = evaluate_sequence(
                seq=p["sequence"],
                name=p["name"],
                analysis=analysis,
                salt_mm=salt_mm,
            )
            result["role"] = p["role"]
        except ValueError as e:
            result = {
                "name": p["name"],
                "role": p["role"],
                "error": str(e),
                "length_bp": len(p["sequence"]),
            }
        part_results.append(result)

    # ── 2. Evaluate junctions ────────────────────────────────────────
    junction_results: list[dict[str, Any]] = []

    def _evaluate_junction(left_part: dict, right_part: dict) -> dict[str, Any]:
        left_seq = left_part["sequence"]
        right_seq = right_part["sequence"]
        left_flank = left_seq[-JUNCTION_FLANK_BP:] if len(left_seq) >= JUNCTION_FLANK_BP else left_seq
        right_flank = right_seq[:JUNCTION_FLANK_BP] if len(right_seq) >= JUNCTION_FLANK_BP else right_seq
        junction_seq = left_flank + right_flank
        junction_name = f"{left_part['name']}|{right_part['name']}"

        try:
            junction_eval = evaluate_sequence(
                seq=junction_seq,
                name=junction_name,
                analysis=analysis,
                salt_mm=salt_mm,
            )
        except ValueError as e:
            junction_eval = {
                "name": junction_name,
                "error": str(e),
                "length_bp": len(junction_seq),
            }

        junction_eval["left_part"] = left_part["name"]
        junction_eval["right_part"] = right_part["name"]
        junction_eval["junction_sequence"] = junction_seq
        return junction_eval

    for i in range(len(parts) - 1):
        junction_results.append(_evaluate_junction(parts[i], parts[i + 1]))

    # Closing junction for circular constructs
    if circular and len(parts) > 1:
        junction_results.append(_evaluate_junction(parts[-1], parts[0]))

    # ── 3. Full construct sequence ───────────────────────────────────
    full_seq = "".join(p["sequence"] for p in parts)

    # ── 4. Assembly flags ────────────────────────────────────────────
    assembly_flags: list[dict[str, Any]] = []

    # 4a. Restriction sites in each part
    for p in parts:
        sites = _find_restriction_sites(p["sequence"])
        for site in sites:
            assembly_flags.append({
                "type": "warning",
                "code": "INTERNAL_RESTRICTION_SITE",
                "part": p["name"],
                "enzyme": site["enzyme"],
                "site": site["site"],
                "position": site["position"],
                "message": (
                    f"Internal {site['enzyme']} site ({site['site']}) in "
                    f"'{p['name']}' at position {site['position']} — "
                    f"may interfere with cloning"
                ),
            })

    # 4b. Homopolymer runs at junctions (>6bp)
    for junc in junction_results:
        jseq = junc.get("junction_sequence", "")
        if not jseq:
            continue
        runs = _find_homopolymers(jseq, min_length=_HOMOPOLYMER_JUNCTION_MIN)
        for run in runs:
            assembly_flags.append({
                "type": "warning",
                "code": "JUNCTION_HOMOPOLYMER",
                "junction": junc["name"],
                "base": run["base"],
                "length": run["length"],
                "message": (
                    f"Homopolymer {run['base']}x{run['length']} at junction "
                    f"'{junc['name']}' — synthesis difficulty, polymerase slippage risk"
                ),
            })

    # 4c. Direct repeats >12bp between any two parts (recombination risk)
    for i in range(len(parts)):
        for j in range(i + 1, len(parts)):
            repeats = _find_direct_repeats_between(
                parts[i]["sequence"], parts[j]["sequence"], k=_DIRECT_REPEAT_MIN,
            )
            for rep in repeats:
                assembly_flags.append({
                    "type": "warning",
                    "code": "CROSS_PART_REPEAT",
                    "parts": [parts[i]["name"], parts[j]["name"]],
                    "repeat_length": rep["length"],
                    "message": (
                        f"Direct repeat ({rep['length']} bp) between "
                        f"'{parts[i]['name']}' (pos {rep['position_a']}) and "
                        f"'{parts[j]['name']}' (pos {rep['position_b']}) — "
                        f"recombination risk"
                    ),
                })

    # 4d. Extreme GC windows (<25% or >75%) in any 100bp window
    cumulative_offset = 0
    for p in parts:
        extreme_windows = _find_extreme_gc_windows(p["sequence"])
        for w in extreme_windows:
            assembly_flags.append({
                "type": "warning",
                "code": "EXTREME_GC_WINDOW",
                "part": p["name"],
                "gc": w["gc"],
                "construct_start": cumulative_offset + w["start"],
                "construct_end": cumulative_offset + w["end"],
                "message": (
                    f"{'Low' if w['issue'] == 'low' else 'High'} GC ({w['gc']:.0%}) "
                    f"in '{p['name']}' at positions {w['start']}-{w['end']} — "
                    f"synthesis difficulty"
                ),
            })
        cumulative_offset += len(p["sequence"])

    # 4e. CpG islands spanning junctions (check if junction evaluation found any)
    for junc in junction_results:
        cpg_islands = junc.get("cpg_islands", [])
        if cpg_islands:
            for island in cpg_islands:
                assembly_flags.append({
                    "type": "info",
                    "code": "JUNCTION_CPG_ISLAND",
                    "junction": junc["name"],
                    "message": (
                        f"CpG island spans junction '{junc['name']}' "
                        f"({island['length_bp']} bp, GC={island['gc']:.0%}) — "
                        f"potential silencing at part boundary"
                    ),
                })

    # ── 5. Summary ───────────────────────────────────────────────────
    gc = _gc_content(full_seq) if full_seq else 0.0

    # Count total warnings/info from all per-part evaluations
    total_part_warnings = sum(
        r.get("flag_counts", {}).get("warnings", 0) for r in part_results
    )
    total_part_info = sum(
        r.get("flag_counts", {}).get("info", 0) for r in part_results
    )

    summary: dict[str, Any] = {
        "name": name,
        "total_length_bp": len(full_seq),
        "n_parts": len(parts),
        "circular": circular,
        "gc_content": round(gc, 4),
        "n_junctions": len(junction_results),
        "n_assembly_flags": len(assembly_flags),
        "n_assembly_warnings": sum(1 for f in assembly_flags if f["type"] == "warning"),
        "total_part_warnings": total_part_warnings,
        "total_part_info": total_part_info,
        "parts": [
            {
                "name": p["name"],
                "role": p["role"],
                "length_bp": len(p["sequence"]),
                "gc_content": round(_gc_content(p["sequence"]), 4) if p["sequence"] else 0,
            }
            for p in parts
        ],
    }

    return {
        "summary": summary,
        "parts": part_results,
        "junctions": junction_results,
        "assembly_flags": assembly_flags,
    }


def compare_constructs(
    constructs: list[dict[str, Any]],
    salt_mm: float = 150.0,
    analysis: str = "full",
) -> dict[str, Any]:
    """Compare two or more construct designs side-by-side.

    Parameters
    ----------
    constructs : list of dict
        Each dict has keys: name (str), parts (list), circular (bool, optional).
    salt_mm : float
        NaCl concentration in mM.
    analysis : str
        "full", "thermodynamic", or "structural".

    Returns
    -------
    dict
        Keys: constructs (list of full evaluations), comparison (delta table).
    """
    if len(constructs) < 2:
        raise ValueError("Need at least 2 constructs to compare.")
    if len(constructs) > 10:
        raise ValueError("Maximum 10 constructs for comparison.")

    evaluations: list[dict[str, Any]] = []
    for c in constructs:
        result = evaluate_construct(
            parts=c["parts"],
            name=c.get("name", "construct"),
            circular=c.get("circular", False),
            salt_mm=salt_mm,
            analysis=analysis,
        )
        evaluations.append(result)

    # Build comparison table
    ref = evaluations[0]
    comparison: list[dict[str, Any]] = []
    for i, ev in enumerate(evaluations):
        s = ev["summary"]
        entry: dict[str, Any] = {
            "name": s["name"],
            "total_length_bp": s["total_length_bp"],
            "gc_content": s["gc_content"],
            "n_parts": s["n_parts"],
            "n_assembly_warnings": s["n_assembly_warnings"],
            "total_part_warnings": s["total_part_warnings"],
        }
        if i > 0:
            rs = ref["summary"]
            entry["delta_length"] = s["total_length_bp"] - rs["total_length_bp"]
            entry["delta_gc"] = round(s["gc_content"] - rs["gc_content"], 4)
            entry["delta_assembly_warnings"] = (
                s["n_assembly_warnings"] - rs["n_assembly_warnings"]
            )
            entry["delta_part_warnings"] = (
                s["total_part_warnings"] - rs["total_part_warnings"]
            )
        comparison.append(entry)

    return {
        "n_constructs": len(constructs),
        "reference": ref["summary"]["name"],
        "comparison": comparison,
        "constructs": evaluations,
    }
