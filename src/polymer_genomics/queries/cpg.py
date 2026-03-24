"""CpG sites, islands, and methylation reference queries."""
from polymer_genomics.queries._common import db_to_api


def region_cpg_sites_query() -> str:
    return """
        SELECT s.pos, s.pos + 2 AS end_pos, s.context, s.gc_content, s.island_id
        FROM cpg.sites s
        WHERE s.build = $1::genome_build
          AND s.chr_id = $2
          AND s.coord && int4range($3, $4)
          AND s.layer_id = $5
        ORDER BY s.pos
        LIMIT $6
    """


def region_cpg_islands_query() -> str:
    """CpG islands (UCSC, Gardiner-Garden & Frommer criteria)."""
    return """
        SELECT i.start_pos, i.end_pos, i.island_name
        FROM cpg.islands i
        WHERE i.build = $1::genome_build
          AND i.chr_id = $2
          AND i.coord && int4range($3, $4)
          AND i.layer_id = $5
        ORDER BY i.start_pos
        LIMIT $6
    """


def region_methylation_reference_query() -> str:
    """Cell-type reference methylation betas (Salas 2018 FlowSorted.Blood.EPIC)."""
    return """
        SELECT m.probe_id, m.pos, m.pos + 1 AS end_pos,
               m.gran, m.mono, m.nk, m.bcell, m.cd4t, m.cd8t
        FROM ref.methylation_reference m
        WHERE m.build = $1::genome_build
          AND m.chr_id = $2
          AND m.coord && int4range($3, $4)
          AND m.layer_id = $5
        ORDER BY m.pos
        LIMIT $6
    """


def _convert_cpg(rows: list, chr_name: str) -> dict:
    starts, ends, widths, contexts, gc_contents = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        contexts.append(r["context"])
        gc_contents.append(r["gc_content"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {"context": contexts, "gc_content": gc_contents},
        "n": len(rows),
    }


def _convert_cpg_islands(rows: list, chr_name: str) -> dict:
    starts, ends, widths, names = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        names.append(r["island_name"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {"island_name": names},
        "n": len(rows),
    }


def _convert_methylation(rows: list, chr_name: str) -> dict:
    starts, ends, widths, probe_ids = [], [], [], []
    gran, mono, nk, bcell, cd4t, cd8t = [], [], [], [], [], []
    for r in rows:
        api = db_to_api(r["pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        probe_ids.append(r["probe_id"])
        gran.append(r["gran"])
        mono.append(r["mono"])
        nk.append(r["nk"])
        bcell.append(r["bcell"])
        cd4t.append(r["cd4t"])
        cd8t.append(r["cd8t"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "probe_id": probe_ids,
            "Gran": gran, "Mono": mono, "NK": nk,
            "Bcell": bcell, "CD4T": cd4t, "CD8T": cd8t,
        },
        "n": len(rows),
    }
