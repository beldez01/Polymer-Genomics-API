"""Evolution and deep-time queries: UCEs, HARs, introgression, selection, exaptation, archaic methylation."""

from polymer_genomics.queries._common import db_to_api


# ── Ultraconserved Elements ─────────────────────────────────────────────────


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


# ── Human Accelerated Regions ───────────────────────────────────────────────


def region_accelerated_query() -> str:
    """Human Accelerated Regions (Doan et al. 2016)."""
    return """
        SELECT a.start_pos, a.end_pos,
               a.har_name, a.acceleration_score, a.conservation_score,
               a.nearest_gene, a.distance_to_gene, a.category
        FROM evolution.accelerated_regions a
        WHERE a.build = $1::genome_build
          AND a.chr_id = $2
          AND a.coord && int4range($3, $4)
          AND a.layer_id = $5
        ORDER BY a.start_pos
        LIMIT $6
    """


def _convert_accelerated(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    har_names, accel, conserv, genes, dists, cats = [], [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        har_names.append(r["har_name"])
        accel.append(r["acceleration_score"])
        conserv.append(r["conservation_score"])
        genes.append(r["nearest_gene"])
        dists.append(r["distance_to_gene"])
        cats.append(r["category"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "har_name": har_names, "acceleration_score": accel,
            "conservation_score": conserv, "nearest_gene": genes,
            "distance_to_gene": dists, "category": cats,
        },
        "n": len(rows),
    }


# ── Archaic Introgression ───────────────────────────────────────────────────


def region_archaic_introgression_query() -> str:
    """Archaic hominin introgression segments (Browning et al. 2018)."""
    return """
        SELECT a.start_pos, a.end_pos,
               a.source_species, a.population, a.posterior_prob,
               a.segment_length_kb, a.snp_count
        FROM evolution.archaic_segments a
        WHERE a.build = $1::genome_build
          AND a.chr_id = $2
          AND a.coord && int4range($3, $4)
          AND a.layer_id = $5
        ORDER BY a.start_pos
        LIMIT $6
    """


def _convert_archaic_introgression(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    species, pops, probs, lengths, snps = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        species.append(r["source_species"])
        pops.append(r["population"])
        probs.append(r["posterior_prob"])
        lengths.append(r["segment_length_kb"])
        snps.append(r["snp_count"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "source_species": species, "population": pops,
            "posterior_prob": probs, "segment_length_kb": lengths,
            "snp_count": snps,
        },
        "n": len(rows),
    }


# ── Selection Sweeps ────────────────────────────────────────────────────────


def region_selection_sweep_query() -> str:
    """Regions under recent positive selection (selscan / 1000 Genomes)."""
    return """
        SELECT s.start_pos, s.end_pos,
               s.population, s.ihs_max, s.xpehh_score, s.fst_vs_global,
               s.candidate_gene, s.sweep_type
        FROM evolution.selection_sweeps s
        WHERE s.build = $1::genome_build
          AND s.chr_id = $2
          AND s.coord && int4range($3, $4)
          AND s.layer_id = $5
        ORDER BY s.start_pos
        LIMIT $6
    """


def _convert_selection_sweep(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    pops, ihs, xpehh, fst, genes, types = [], [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        pops.append(r["population"])
        ihs.append(r["ihs_max"])
        xpehh.append(r["xpehh_score"])
        fst.append(r["fst_vs_global"])
        genes.append(r["candidate_gene"])
        types.append(r["sweep_type"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "population": pops, "ihs_max": ihs, "xpehh_score": xpehh,
            "fst_vs_global": fst, "candidate_gene": genes, "sweep_type": types,
        },
        "n": len(rows),
    }


# ── TE Exaptation ───────────────────────────────────────────────────────────


def region_te_exaptation_query() -> str:
    """TEs co-opted as regulatory elements (Chuong et al. 2017)."""
    return """
        SELECT t.start_pos, t.end_pos,
               t.te_name, t.te_family, t.te_age_mya,
               t.regulatory_function, t.target_gene, t.evidence
        FROM evolution.te_exaptation t
        WHERE t.build = $1::genome_build
          AND t.chr_id = $2
          AND t.coord && int4range($3, $4)
          AND t.layer_id = $5
        ORDER BY t.start_pos
        LIMIT $6
    """


def _convert_te_exaptation(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    names, fams, ages, funcs, genes, evids = [], [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        names.append(r["te_name"])
        fams.append(r["te_family"])
        ages.append(r["te_age_mya"])
        funcs.append(r["regulatory_function"])
        genes.append(r["target_gene"])
        evids.append(r["evidence"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "te_name": names, "te_family": fams, "te_age_mya": ages,
            "regulatory_function": funcs, "target_gene": genes, "evidence": evids,
        },
        "n": len(rows),
    }


# ── Archaic Methylation ─────────────────────────────────────────────────────


def region_archaic_methylation_query() -> str:
    """Reconstructed Neanderthal/Denisovan methylation (Gokhman et al. 2014, 2020)."""
    return """
        SELECT m.start_pos, m.end_pos,
               m.species, m.methylation_level, m.confidence,
               m.dmr_id, m.direction_vs_modern
        FROM evolution.archaic_methylation m
        WHERE m.build = $1::genome_build
          AND m.chr_id = $2
          AND m.coord && int4range($3, $4)
          AND m.layer_id = $5
        ORDER BY m.start_pos
        LIMIT $6
    """


def _convert_archaic_methylation(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    species, levels, confs, dmrs, dirs = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        species.append(r["species"])
        levels.append(r["methylation_level"])
        confs.append(r["confidence"])
        dmrs.append(r["dmr_id"])
        dirs.append(r["direction_vs_modern"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "species": species, "methylation_level": levels,
            "confidence": confs, "dmr_id": dmrs,
            "direction_vs_modern": dirs,
        },
        "n": len(rows),
    }
