"""Structural variation queries: gnomAD v4 structural variants."""

from polymer_genomics.queries._common import db_to_api


def region_structural_variant_query() -> str:
    """gnomAD v4.1 structural variants with allele frequency and consequence."""
    return """
        SELECT sv.start_pos, sv.end_pos,
               sv.sv_id, sv.sv_type, sv.sv_length,
               sv.allele_count, sv.allele_number, sv.allele_freq,
               sv.homozygote_count, sv.popmax_af, sv.popmax_pop,
               sv.filter_status, sv.consequence, sv.gene_symbol
        FROM variation.structural_variants sv
        WHERE sv.build = $1::genome_build
          AND sv.chr_id = $2
          AND sv.coord && int4range($3, $4)
          AND sv.layer_id = $5
        ORDER BY sv.start_pos
        LIMIT $6
    """


def _convert_structural_variant(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    sv_ids, sv_types, sv_lengths = [], [], []
    acs, ans, afs = [], [], []
    hom_counts, popmax_afs, popmax_pops = [], [], []
    filters, consequences, genes = [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        sv_ids.append(r["sv_id"])
        sv_types.append(r["sv_type"])
        sv_lengths.append(r["sv_length"])
        acs.append(r["allele_count"])
        ans.append(r["allele_number"])
        afs.append(r["allele_freq"])
        hom_counts.append(r["homozygote_count"])
        popmax_afs.append(r["popmax_af"])
        popmax_pops.append(r["popmax_pop"])
        filters.append(r["filter_status"])
        consequences.append(r["consequence"])
        genes.append(r["gene_symbol"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "sv_id": sv_ids, "sv_type": sv_types, "sv_length": sv_lengths,
            "allele_count": acs, "allele_number": ans, "allele_freq": afs,
            "homozygote_count": hom_counts, "popmax_af": popmax_afs,
            "popmax_pop": popmax_pops,
            "filter_status": filters, "consequence": consequences,
            "gene_symbol": genes,
        },
        "n": len(rows),
    }
