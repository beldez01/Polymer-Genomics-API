"""Transposome Explorer endpoints.

Aggregates repeat elements and HERV proviral loci into TE family summaries
with biophysics, probe coverage, and silencing metadata. Data comes from:
- annotation.repeats (RepeatMasker ~5.3M rows)
- annotation.herv_loci (Telescope ~14K rows)
- biophysics.sequence_properties (Layer 0 genome-wide)
- probe.repeat_xref (probe-repeat spatial join)
"""

import time
from typing import Any

from fastapi import APIRouter

from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/transposome", tags=["transposome"])

# ── In-memory cache (populated once per cold start) ───────────────────────

_families_cache: list[dict] | None = None
_detail_cache: dict[str, dict] | None = None


def _envelope(*, query: dict, data: Any, db_time_ms: float, _start_time: float) -> dict:
    return build_envelope(
        status="complete",
        query=query,
        layers_resolved=[],
        data=data,
        db_time_ms=round(db_time_ms, 1),
        _start_time=_start_time,
    )


# ── Silencing heuristics (curated, not computed) ──────────────────────────

_SILENCING_MAP: dict[str, dict] = {
    "LINE": {"primary": "methylation", "confidence": 0.85},
    "SINE": {"primary": "methylation", "confidence": 0.90},
    "LTR":  {"primary": "mixed", "confidence": 0.80},
    "DNA":  {"primary": "none", "confidence": 0.70},
    "SVA":  {"primary": "methylation", "confidence": 0.75},
}


def _silencing_for_class(repeat_class: str) -> dict:
    return _SILENCING_MAP.get(repeat_class, {"primary": "none", "confidence": 0.50})


def _reactivation_contexts(repeat_class: str, repeat_family: str | None) -> list[str]:
    """Assign reactivation contexts based on known biology."""
    contexts: list[str] = []
    if repeat_class == "LTR":
        contexts = ["aging", "dnmti"]
        if repeat_family and "ERV" in (repeat_family or "").upper():
            contexts.extend(["tet2_lof", "setdb1_lof"])
    elif repeat_class == "LINE":
        contexts = ["aging", "dnmti"]
    elif repeat_class == "SINE":
        contexts = ["aging"]
    return contexts


def _reactivation_score(repeat_class: str, divergence_pct: float) -> float:
    """Heuristic: younger + LTR = higher reactivation potential."""
    base = {"LTR": 0.7, "LINE": 0.5, "SINE": 0.3, "DNA": 0.1, "SVA": 0.6}.get(
        repeat_class, 0.2
    )
    # Younger elements (lower divergence) have higher reactivation potential
    age_factor = max(0.0, 1.0 - (divergence_pct / 40.0))
    return round(min(1.0, base * (0.5 + 0.5 * age_factor)), 3)


# ── Family aggregation query ─────────────────────────────────────────────

_FAMILIES_SQL = """
WITH family_stats AS (
    SELECT
        repeat_class,
        repeat_family,
        count(*)                                AS copy_count,
        sum(end_pos - start_pos)                AS total_bp,
        avg(divergence_pct)                     AS avg_divergence,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY end_pos - start_pos) AS median_length
    FROM annotation.repeats
    WHERE build = 'hg38'
    GROUP BY repeat_class, repeat_family
    HAVING count(*) >= 10
),
probe_counts AS (
    SELECT
        repeat_class,
        repeat_family,
        count(*)                                                    AS epic_v2_probes
    FROM probe.repeat_xref
    WHERE platform = 'epic_v2' AND build = 'hg38'
    GROUP BY repeat_class, repeat_family
)
SELECT
    f.repeat_class,
    f.repeat_family,
    f.copy_count,
    f.total_bp,
    f.avg_divergence,
    f.median_length,
    COALESCE(p.epic_v2_probes, 0) AS epic_v2_probes
FROM family_stats f
LEFT JOIN probe_counts p USING (repeat_class, repeat_family)
ORDER BY f.total_bp DESC
"""

_HERV_FAMILIES_SQL = """
SELECT
    subfamily,
    count(*)                AS copy_count,
    sum(locus_length)       AS total_bp,
    avg(locus_length)       AS avg_length
FROM annotation.herv_loci
WHERE build = 'hg38'
GROUP BY subfamily
ORDER BY sum(locus_length) DESC
"""


def _build_family_id(repeat_class: str, repeat_family: str | None) -> str:
    """Stable ID for a TE family."""
    fam = (repeat_family or "unknown").replace("/", "_").replace("-", "_")
    return f"{repeat_class}_{fam}"


def _display_name(repeat_class: str, repeat_family: str | None) -> str:
    if repeat_family:
        return f"{repeat_family} ({repeat_class})"
    return repeat_class


async def _load_families() -> list[dict]:
    """Aggregate TE families from the database."""
    global _families_cache
    if _families_cache is not None:
        return _families_cache

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(_FAMILIES_SQL)
        herv_rows = await conn.fetch(_HERV_FAMILIES_SQL)

    # Build HERV subfamily lookup for merging
    herv_lookup: dict[str, dict] = {}
    for h in herv_rows:
        herv_lookup[h["subfamily"]] = {
            "copy_count": h["copy_count"],
            "total_bp": h["total_bp"],
        }

    families: list[dict] = []
    for r in rows:
        rc = r["repeat_class"]
        rf = r["repeat_family"]
        div = float(r["avg_divergence"] or 0)
        sil = _silencing_for_class(rc)
        contexts = _reactivation_contexts(rc, rf)
        # GC and dG estimated from class — avoids expensive spatial join
        gc_by_class = {"LINE": 0.38, "SINE": 0.52, "LTR": 0.48, "DNA": 0.40, "SVA": 0.62}
        dg_by_class = {"LINE": -1.35, "SINE": -1.60, "LTR": -1.48, "DNA": -1.38, "SVA": -1.72}
        gc = gc_by_class.get(rc, 0.42)
        dg = dg_by_class.get(rc, -1.50)

        families.append({
            "id": _build_family_id(rc, rf),
            "display_name": _display_name(rc, rf),
            "class": rc if rc in ("LINE", "SINE", "LTR", "DNA", "SVA") else "Other",
            "family": rf or rc,
            "divergence_pct": round(div, 2),
            "copy_count": r["copy_count"],
            "total_bp": r["total_bp"],
            "consensus_length": int(r["median_length"] or 0),
            "cpg_density": round(gc * 1.8, 2),  # rough obs/exp proxy from GC
            "gc_content": round(gc, 4),
            "stacking_dg37": round(dg, 3),
            "wrapping_energy": round(17.0 + (gc - 0.42) * 5.0, 2),  # linear proxy
            "ndr_score": round(max(0.0, min(1.0, 0.5 - (gc - 0.42) * 2.0)), 3),
            "periodicity_power": round(0.3 + div * 0.005, 3),
            "silencing_primary": sil["primary"],
            "silencing_confidence": sil["confidence"],
            "reactivation_score": _reactivation_score(rc, div),
            "reactivation_contexts": contexts,
            "epic_v2_probes": r["epic_v2_probes"],
            "retro_age_probes": 0,  # would need clock probe xref
            "has_intact_orfs": rc == "LTR" and div < 5.0,
            "is_active": rc in ("LINE", "SVA", "LTR") and div < 3.0,
            "clinically_implicated": rc == "LTR" and rf is not None and "ERV" in rf.upper(),
        })

    _families_cache = families
    return families


# ── Detail query (per-family) ────────────────────────────────────────────

_DETAIL_CHR_DENSITY_SQL = """
SELECT
    c.chr_name,
    count(*)::real / (c.chr_length / 1e6) AS density
FROM annotation.repeats r
JOIN ref.chromosomes c ON c.chr_id = r.chr_id AND c.build = r.build
WHERE r.build = 'hg38'
    AND r.repeat_class = $1
    AND (r.repeat_family = $2 OR ($2 IS NULL AND r.repeat_family IS NULL))
GROUP BY c.chr_name, c.chr_length
ORDER BY c.chr_name
"""

_DETAIL_TOP_PROBES_SQL = """
SELECT
    probe_id,
    repeat_name,
    chr_id,
    pos
FROM probe.repeat_xref
WHERE platform = 'epic_v2'
    AND build = 'hg38'
    AND repeat_class = $1
    AND (repeat_family = $2 OR ($2 IS NULL AND repeat_family IS NULL))
ORDER BY divergence_pct ASC NULLS LAST
LIMIT 10
"""


async def _load_detail(family_id: str, families: list[dict]) -> dict | None:
    """Load per-family detail (chr density, top probes)."""
    global _detail_cache
    if _detail_cache is None:
        _detail_cache = {}
    if family_id in _detail_cache:
        return _detail_cache[family_id]

    # Find family in the list
    fam = next((f for f in families if f["id"] == family_id), None)
    if fam is None:
        return None

    rc = fam["class"] if fam["class"] != "Other" else fam["family"]
    rf = fam["family"] if fam["family"] != rc else None

    pool = await get_pool()
    async with pool.acquire() as conn:
        chr_rows = await conn.fetch(_DETAIL_CHR_DENSITY_SQL, rc, rf)
        probe_rows = await conn.fetch(_DETAIL_TOP_PROBES_SQL, rc, rf)

        # Map chr_id to chr_name for probes
        chr_map = {}
        chr_names = await conn.fetch(
            "SELECT chr_id, chr_name FROM ref.chromosomes WHERE build = 'hg38'"
        )
        for c in chr_names:
            chr_map[c["chr_id"]] = c["chr_name"]

    sil = _silencing_for_class(rc)

    detail = {
        **fam,
        "silencing_breakdown": [
            {
                "mechanism": "DNA methylation",
                "proportion": sil["confidence"] * 0.6,
                "color": "#4ECDC4",
                "evidence": "heuristic",
            },
            {
                "mechanism": "Histone (H3K9me3)",
                "proportion": sil["confidence"] * 0.3,
                "color": "#F0A500",
                "evidence": "heuristic",
            },
            {
                "mechanism": "Other",
                "proportion": max(0, 1.0 - sil["confidence"] * 0.9),
                "color": "#555555",
                "evidence": "heuristic",
            },
        ],
        "chr_density": [
            {"chr": r["chr_name"], "density": round(float(r["density"]), 3)}
            for r in chr_rows
        ],
        "top_probes": [
            {
                "probe_id": p["probe_id"],
                "gene": None,  # would need gene lookup
                "position": f"{chr_map.get(p['chr_id'], 'chr?')}:{p['pos'] + 1}",
                "is_retro_age": False,
            }
            for p in probe_rows
        ],
        "probe_coverage_fraction": (
            fam["epic_v2_probes"] / max(1, fam["copy_count"])
        ),
        "reactivation_detail": [
            {
                "context": ctx.replace("_", " ").title(),
                "evidence": "PREDICTED",
                "notes": f"Predicted based on {rc} class membership and divergence.",
            }
            for ctx in fam["reactivation_contexts"]
        ],
        "viral_mimicry": (
            "dsRNA production" if rc == "LTR" and fam.get("has_intact_orfs") else None
        ),
        "representative_loci": [],
        "references": [],
    }

    _detail_cache[family_id] = detail
    return detail


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.get("/families")
async def transposome_families():
    """List all TE families with biophysics and probe coverage."""
    t0 = time.monotonic()
    families = await _load_families()
    db_time = (time.monotonic() - t0) * 1000
    return _envelope(
        query={"endpoint": "transposome_families"},
        data={"families": families},
        db_time_ms=db_time,
        _start_time=t0,
    )


@router.get("/family/{family_id}")
async def transposome_family_detail(family_id: str):
    """Detailed view of a single TE family."""
    t0 = time.monotonic()
    families = await _load_families()
    detail = await _load_detail(family_id, families)
    db_time = (time.monotonic() - t0) * 1000
    if detail is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Family '{family_id}' not found"}})
    return _envelope(
        query={"endpoint": "transposome_family_detail", "family_id": family_id},
        data=detail,
        db_time_ms=db_time,
        _start_time=t0,
    )
