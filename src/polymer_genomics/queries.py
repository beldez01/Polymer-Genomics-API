"""Parameterized SQL queries and row converters for genomic interval lookups.

Each entry in TRACK_REGISTRY has:
  - query_fn: callable returning parameterized SQL (args: build, chr_id, start, end, layer_id, limit)
  - convert_fn: callable(rows, chr_name) -> GRanges dict

To add a new layer type, add a query function, a convert function, and an entry here.
"""

from polymer_genomics.coordinates import db_to_api


# ---------------------------------------------------------------------------
# Query functions
# ---------------------------------------------------------------------------

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


def region_gene_features_query() -> str:
    return """
        SELECT g.start_pos, g.end_pos, g.strand, g.gene_symbol,
               g.gene_id, g.transcript_id, g.feature_type
        FROM gene.features g
        WHERE g.build = $1::genome_build
          AND g.chr_id = $2
          AND g.coord && int4range($3, $4)
          AND g.layer_id = $5
        ORDER BY g.start_pos
        LIMIT $6
    """


def region_probe_coordinates_query() -> str:
    return """
        SELECT p.probe_id, p.pos, p.pos + 1 AS end_pos,
               p.gene_symbol, p.cpg_context
        FROM probe.coordinates p
        WHERE p.build = $1::genome_build
          AND p.chr_id = $2
          AND p.coord && int4range($3, $4)
          AND p.layer_id = $5
        ORDER BY p.pos
        LIMIT $6
    """


def region_isochores_query() -> str:
    return """
        SELECT i.start_pos, i.end_pos, i.gc_content, i.isochore_class
        FROM ref.isochores i
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


# ---------------------------------------------------------------------------
# Row converter functions
# ---------------------------------------------------------------------------

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


def _convert_gene_model(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, gene_ids, tx_ids, ftypes = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"])
        symbols.append(r["gene_symbol"])
        gene_ids.append(r["gene_id"])
        tx_ids.append(r["transcript_id"])
        ftypes.append(r["feature_type"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "gene_id": gene_ids,
            "transcript_id": tx_ids,
            "feature_type": ftypes,
        },
        "n": len(rows),
    }


def _convert_probe(rows: list, chr_name: str) -> dict:
    starts, ends, widths, probe_ids, symbols, contexts = [], [], [], [], [], []
    for r in rows:
        api = db_to_api(r["pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        probe_ids.append(r["probe_id"])
        symbols.append(r["gene_symbol"])
        contexts.append(r["cpg_context"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {"probe_id": probe_ids, "gene_symbol": symbols, "cpg_context": contexts},
        "n": len(rows),
    }


def _convert_isochore(rows: list, chr_name: str) -> dict:
    starts, ends, widths, gc_contents, classes = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        gc_contents.append(r["gc_content"])
        classes.append(r["isochore_class"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {"gc_content": gc_contents, "isochore_class": classes},
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


# ---------------------------------------------------------------------------
# Declarative track registry
# ---------------------------------------------------------------------------

TRACK_REGISTRY: dict[str, dict] = {
    "cpg": {
        "query_fn": region_cpg_sites_query,
        "convert_fn": _convert_cpg,
    },
    "gene_model": {
        "query_fn": region_gene_features_query,
        "convert_fn": _convert_gene_model,
    },
    "probe": {
        "query_fn": region_probe_coordinates_query,
        "convert_fn": _convert_probe,
    },
    "isochore": {
        "query_fn": region_isochores_query,
        "convert_fn": _convert_isochore,
    },
    "methylation": {
        "query_fn": region_methylation_reference_query,
        "convert_fn": _convert_methylation,
    },
}

# Backwards-compat alias (used by existing tests)
LAYER_QUERY_MAP = {k: v["query_fn"] for k, v in TRACK_REGISTRY.items()}
