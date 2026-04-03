"""QTL queries: eQTLs (GTEx) and meQTLs (GoDMC)."""

from polymer_genomics.queries._common import db_to_api


def region_eqtl_query() -> str:
    """Significant cis-eQTLs (GTEx v8)."""
    return """
        SELECT e.start_pos, e.end_pos,
               e.variant_id, e.gene_id, e.gene_symbol, e.tissue,
               e.tss_distance, e.effect_size, e.p_value, e.q_value
        FROM qtl.eqtls e
        WHERE e.build = $1::genome_build
          AND e.chr_id = $2
          AND e.coord && int4range($3, $4)
          AND e.layer_id = $5
        ORDER BY e.start_pos
        LIMIT $6
    """


def _convert_eqtl(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    vids, gids, gsyms, tissues = [], [], [], []
    dists, effects, pvals, qvals = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        vids.append(r["variant_id"])
        gids.append(r["gene_id"])
        gsyms.append(r["gene_symbol"])
        tissues.append(r["tissue"])
        dists.append(r["tss_distance"])
        effects.append(r["effect_size"])
        pvals.append(r["p_value"])
        qvals.append(r["q_value"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "variant_id": vids, "gene_id": gids, "gene_symbol": gsyms,
            "tissue": tissues, "tss_distance": dists, "effect_size": effects,
            "p_value": pvals, "q_value": qvals,
        },
        "n": len(rows),
    }


def region_meqtl_query() -> str:
    """Significant cis-meQTLs (GoDMC)."""
    return """
        SELECT m.start_pos, m.end_pos,
               m.snp_rsid, m.cpg_probe_id, m.beta, m.se,
               m.p_value, m.allele_freq, m.cis_trans, m.distance
        FROM qtl.meqtls m
        WHERE m.build = $1::genome_build
          AND m.chr_id = $2
          AND m.coord && int4range($3, $4)
          AND m.layer_id = $5
        ORDER BY m.start_pos
        LIMIT $6
    """


def _convert_meqtl(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    rsids, probes, betas, ses, pvals, freqs, cists, dists = [], [], [], [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        rsids.append(r["snp_rsid"])
        probes.append(r["cpg_probe_id"])
        betas.append(r["beta"])
        ses.append(r["se"])
        pvals.append(r["p_value"])
        freqs.append(r["allele_freq"])
        cists.append(r["cis_trans"])
        dists.append(r["distance"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "snp_rsid": rsids, "cpg_probe_id": probes,
            "beta": betas, "se": ses, "p_value": pvals,
            "allele_freq": freqs, "cis_trans": cists, "distance": dists,
        },
        "n": len(rows),
    }
