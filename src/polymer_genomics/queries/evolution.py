"""Evolution and deep-time queries: ultraconserved elements, HARs, introgression."""

from polymer_genomics.queries._common import db_to_api


def region_ultraconserved_query() -> str:
    """Ultraconserved elements (Bejerano et al. 2004, 100% identity human/mouse/rat >200bp)."""
    return """
        SELECT u.start_pos, u.end_pos,
               u.uce_name, u.length_bp, u.category
        FROM evolution.ultraconserved_elements u
        WHERE u.build = $1::genome_build
          AND u.chr_id = $2
          AND u.coord && int4range($3, $4)
          AND u.layer_id = $5
        ORDER BY u.start_pos
        LIMIT $6
    """


def _convert_ultraconserved(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    names, lengths, categories = [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        names.append(r["uce_name"])
        lengths.append(r["length_bp"])
        categories.append(r["category"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "uce_name": names,
            "length_bp": lengths,
            "category": categories,
        },
        "n": len(rows),
    }
