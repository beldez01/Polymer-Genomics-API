"""Variation queries: ClinVar pathogenic variants."""

from polymer_genomics.queries._common import db_to_api


def region_clinvar_query() -> str:
    """ClinVar pathogenic and likely pathogenic variants."""
    return """
        SELECT cv.start_pos, cv.end_pos,
               cv.variation_id, cv.rsid, cv.ref_allele, cv.alt_allele,
               cv.clinical_significance, cv.review_status,
               cv.disease, cv.gene_symbol, cv.molecular_consequence, cv.origin
        FROM variation.clinvar_variants cv
        WHERE cv.build = $1::genome_build
          AND cv.chr_id = $2
          AND cv.coord && int4range($3, $4)
          AND cv.layer_id = $5
        ORDER BY cv.start_pos
        LIMIT $6
    """


def _convert_clinvar(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    var_ids, rsids, refs, alts = [], [], [], []
    sigs, reviews, diseases, genes, consequences, origins = [], [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        var_ids.append(r["variation_id"])
        rsids.append(r["rsid"])
        refs.append(r["ref_allele"])
        alts.append(r["alt_allele"])
        sigs.append(r["clinical_significance"])
        reviews.append(r["review_status"])
        diseases.append(r["disease"])
        genes.append(r["gene_symbol"])
        consequences.append(r["molecular_consequence"])
        origins.append(r["origin"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "variation_id": var_ids, "rsid": rsids,
            "ref_allele": refs, "alt_allele": alts,
            "clinical_significance": sigs, "review_status": reviews,
            "disease": diseases, "gene_symbol": genes,
            "molecular_consequence": consequences, "origin": origins,
        },
        "n": len(rows),
    }
