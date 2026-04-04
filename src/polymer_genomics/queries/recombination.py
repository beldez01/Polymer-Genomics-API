"""Recombination queries: oNCO events, DMC1 hotspots, recombination rates.

Sources:
- Palsson et al. 2025, Nature 639:700-707 (oNCO events + CO/NCO/DSB maps)
- Pratto et al. 2014, Science 346:1256442 (DMC1 SSDS hotspot peaks)
"""
from polymer_genomics.queries._common import db_to_api


# ---------------------------------------------------------------------------
# Query functions
# ---------------------------------------------------------------------------

def region_onco_events_query() -> str:
    """Individual observed non-crossover (oNCO) events from Palsson 2025."""
    # Tables lack coord int4range and layer_id columns.
    # Accept standard 6-param signature; $5 consumed via dummy clause.
    return """
        SELECT o.start_pos, o.end_pos,
               o.parent_type, o.event_id,
               o.n_mpps, o.n_gc_mpps,
               o.end_pos - o.start_pos AS event_width
        FROM recombination.onco_events o
        WHERE o.build = $1
          AND o.chr_id = $2
          AND o.start_pos < $4
          AND o.end_pos > $3
          AND ($5::uuid IS NOT NULL)
        ORDER BY o.start_pos
        LIMIT $6
    """


def region_dmc1_hotspots_query() -> str:
    """DMC1 SSDS-defined meiotic DSB hotspot peaks (Pratto 2014, hg38 liftOver)."""
    return """
        SELECT d.start_pos, d.end_pos,
               d.mean_strength,
               d.end_pos - d.start_pos AS peak_width
        FROM recombination.dmc1_hotspots d
        WHERE d.build = $1
          AND d.chr_id = $2
          AND d.start_pos < $4
          AND d.end_pos > $3
          AND ($5::uuid IS NOT NULL)
        ORDER BY d.start_pos
        LIMIT $6
    """


def region_recombination_rates_query() -> str:
    """Recombination rates (CO, NCO, DSB) from biophysics windows.

    Returns 1kb bins within the queried region that have Palsson data.
    Uses standard biophysics table — layer_id filter is meaningful here.
    """
    return """
        SELECT b.start_pos, b.end_pos,
               b.co_rate_cmmb, b.nco_rate, b.dsb_rate,
               b.mat_co_rate, b.mat_nco_rate,
               b.pat_co_rate, b.pat_nco_rate
        FROM biophysics.sequence_properties b
        WHERE b.build = $1::genome_build
          AND b.chr_id = $2
          AND b.start_pos >= $3
          AND b.start_pos < $4
          AND b.layer_id = $5
          AND b.co_rate_cmmb IS NOT NULL
        ORDER BY b.start_pos
        LIMIT $6
    """


# ---------------------------------------------------------------------------
# Row converter functions
# ---------------------------------------------------------------------------

def _convert_onco_events(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    parent_types, event_ids = [], []
    n_mpps_list, n_gc_mpps_list, event_widths = [], [], []

    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        parent_types.append(r["parent_type"])
        event_ids.append(r["event_id"])
        n_mpps_list.append(r["n_mpps"])
        n_gc_mpps_list.append(r["n_gc_mpps"])
        event_widths.append(r["event_width"])

    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "parent_type": parent_types,
            "event_id": event_ids,
            "n_mpps": n_mpps_list,
            "n_gc_mpps": n_gc_mpps_list,
            "event_width": event_widths,
        },
        "n": len(rows),
    }


def _convert_dmc1_hotspots(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    strengths, peak_widths = [], []

    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strengths.append(r["mean_strength"])
        peak_widths.append(r["peak_width"])

    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "mean_strength": strengths,
            "peak_width": peak_widths,
        },
        "n": len(rows),
    }


def _convert_recombination_rates(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    co, nco, dsb = [], [], []
    mat_co, mat_nco, pat_co, pat_nco = [], [], [], []

    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        co.append(r["co_rate_cmmb"])
        nco.append(r["nco_rate"])
        dsb.append(r["dsb_rate"])
        mat_co.append(r["mat_co_rate"])
        mat_nco.append(r["mat_nco_rate"])
        pat_co.append(r["pat_co_rate"])
        pat_nco.append(r["pat_nco_rate"])

    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "co_rate_cmmb": co,
            "nco_rate": nco,
            "dsb_rate": dsb,
            "mat_co_rate": mat_co,
            "mat_nco_rate": mat_nco,
            "pat_co_rate": pat_co,
            "pat_nco_rate": pat_nco,
        },
        "n": len(rows),
    }
