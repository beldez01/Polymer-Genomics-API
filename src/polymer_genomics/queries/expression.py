"""Gene expression, protein abundance, turnover, properties, and atlas queries."""
from polymer_genomics.queries._common import db_to_api


def region_expression_query() -> str:
    """Gene expression summary (GTEx v10, 54 tissues)."""
    return """
        SELECT e.gene_symbol, e.gene_id, e.start_pos, e.end_pos, e.strand,
               e.median_tpm, e.max_tpm, e.max_tissue, e.n_tissues_detected,
               e.tpm_adipose_subcutaneous, e.tpm_adipose_visceral_omentum,
               e.tpm_adrenal_gland, e.tpm_artery_aorta, e.tpm_artery_coronary,
               e.tpm_artery_tibial, e.tpm_bladder,
               e.tpm_brain_amygdala, e.tpm_brain_anterior_cingulate_cortex_ba24,
               e.tpm_brain_caudate_basal_ganglia, e.tpm_brain_cerebellar_hemisphere,
               e.tpm_brain_cerebellum, e.tpm_brain_cortex,
               e.tpm_brain_frontal_cortex_ba9, e.tpm_brain_hippocampus,
               e.tpm_brain_hypothalamus, e.tpm_brain_nucleus_accumbens_basal_ganglia,
               e.tpm_brain_putamen_basal_ganglia, e.tpm_brain_spinal_cord_cervical_c1,
               e.tpm_brain_substantia_nigra, e.tpm_breast_mammary_tissue,
               e.tpm_cells_cultured_fibroblasts, e.tpm_cells_ebv_transformed_lymphocytes,
               e.tpm_cervix_ectocervix, e.tpm_cervix_endocervix,
               e.tpm_colon_sigmoid, e.tpm_colon_transverse,
               e.tpm_esophagus_gastroesophageal_junction, e.tpm_esophagus_mucosa,
               e.tpm_esophagus_muscularis, e.tpm_fallopian_tube,
               e.tpm_heart_atrial_appendage, e.tpm_heart_left_ventricle,
               e.tpm_kidney_cortex, e.tpm_kidney_medulla,
               e.tpm_liver, e.tpm_lung, e.tpm_minor_salivary_gland,
               e.tpm_muscle_skeletal, e.tpm_nerve_tibial,
               e.tpm_ovary, e.tpm_pancreas, e.tpm_pituitary, e.tpm_prostate,
               e.tpm_skin_not_sun_exposed_suprapubic, e.tpm_skin_sun_exposed_lower_leg,
               e.tpm_small_intestine_terminal_ileum, e.tpm_spleen, e.tpm_stomach,
               e.tpm_testis, e.tpm_thyroid, e.tpm_uterus, e.tpm_vagina,
               e.tpm_whole_blood
        FROM expression.gene_tpm e
        WHERE e.build = $1::genome_build
          AND e.chr_id = $2
          AND e.coord && int4range($3, $4)
          AND e.layer_id = $5
        ORDER BY e.start_pos
        LIMIT $6
    """


def region_protein_abundance_query() -> str:
    """Tissue-specific protein abundance (PaxDb v6.0)."""
    return """
        SELECT pa.gene_symbol, pa.start_pos, pa.end_pos, pa.strand,
               pa.tissue, pa.organ_group, pa.abundance_ppm,
               pa.coverage, pa.spectral_count, pa.data_source, pa.uniprot_id
        FROM bioenergetics.protein_abundance pa
        WHERE pa.build = $1::genome_build
          AND pa.chr_id = $2
          AND pa.coord && int4range($3, $4)
          AND pa.layer_id = $5
        ORDER BY pa.start_pos
        LIMIT $6
    """


def region_protein_turnover_query() -> str:
    """Protein half-life measurements (Mathieson et al. 2018)."""
    return """
        SELECT pt.gene_symbol, pt.start_pos, pt.end_pos, pt.strand,
               pt.cell_type, pt.half_life_hours, pt.k_degradation,
               pt.r_squared, pt.n_peptides, pt.measurement_method, pt.uniprot_id
        FROM bioenergetics.protein_turnover pt
        WHERE pt.build = $1::genome_build
          AND pt.chr_id = $2
          AND pt.coord && int4range($3, $4)
          AND pt.layer_id = $5
        ORDER BY pt.start_pos
        LIMIT $6
    """


def region_protein_properties_query() -> str:
    """Protein physicochemical properties (UniProt ProtParam)."""
    return """
        SELECT pp.gene_symbol, pp.start_pos, pp.end_pos, pp.strand,
               pp.h_atoms, pp.o_atoms, pp.p_atoms, pp.total_atoms,
               pp.pi, pp.instability_index, pp.aliphatic_index, pp.gravy,
               pp.uniprot_id, pp.molecular_formula,
               pp.extinction_coeff_reduced, pp.extinction_coeff_oxidized
        FROM bioenergetics.protein_properties pp
        WHERE pp.build = $1::genome_build
          AND pp.chr_id = $2
          AND pp.coord && int4range($3, $4)
          AND pp.layer_id = $5
        ORDER BY pp.start_pos
        LIMIT $6
    """


def region_protein_atlas_query() -> str:
    """Protein tissue expression (Human Protein Atlas)."""
    return """
        SELECT te.gene_symbol, te.start_pos, te.end_pos, te.strand,
               te.tissue, te.cell_type, te.expression_level, te.reliability
        FROM proteomics.tissue_expression te
        WHERE te.build = $1::genome_build
          AND te.chr_id = $2
          AND te.coord && int4range($3, $4)
          AND te.layer_id = $5
        ORDER BY te.start_pos
        LIMIT $6
    """


_EXPRESSION_TISSUE_COLS = [
    "tpm_adipose_subcutaneous", "tpm_adipose_visceral_omentum",
    "tpm_adrenal_gland", "tpm_artery_aorta", "tpm_artery_coronary",
    "tpm_artery_tibial", "tpm_bladder",
    "tpm_brain_amygdala", "tpm_brain_anterior_cingulate_cortex_ba24",
    "tpm_brain_caudate_basal_ganglia", "tpm_brain_cerebellar_hemisphere",
    "tpm_brain_cerebellum", "tpm_brain_cortex",
    "tpm_brain_frontal_cortex_ba9", "tpm_brain_hippocampus",
    "tpm_brain_hypothalamus", "tpm_brain_nucleus_accumbens_basal_ganglia",
    "tpm_brain_putamen_basal_ganglia", "tpm_brain_spinal_cord_cervical_c1",
    "tpm_brain_substantia_nigra", "tpm_breast_mammary_tissue",
    "tpm_cells_cultured_fibroblasts", "tpm_cells_ebv_transformed_lymphocytes",
    "tpm_cervix_ectocervix", "tpm_cervix_endocervix",
    "tpm_colon_sigmoid", "tpm_colon_transverse",
    "tpm_esophagus_gastroesophageal_junction", "tpm_esophagus_mucosa",
    "tpm_esophagus_muscularis", "tpm_fallopian_tube",
    "tpm_heart_atrial_appendage", "tpm_heart_left_ventricle",
    "tpm_kidney_cortex", "tpm_kidney_medulla",
    "tpm_liver", "tpm_lung", "tpm_minor_salivary_gland",
    "tpm_muscle_skeletal", "tpm_nerve_tibial",
    "tpm_ovary", "tpm_pancreas", "tpm_pituitary", "tpm_prostate",
    "tpm_skin_not_sun_exposed_suprapubic", "tpm_skin_sun_exposed_lower_leg",
    "tpm_small_intestine_terminal_ileum", "tpm_spleen", "tpm_stomach",
    "tpm_testis", "tpm_thyroid", "tpm_uterus", "tpm_vagina",
    "tpm_whole_blood",
]


def _convert_expression(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, gene_ids = [], []
    median_tpms, max_tpms, max_tissues, n_detected = [], [], [], []
    tissue_data = {col: [] for col in _EXPRESSION_TISSUE_COLS}
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        gene_ids.append(r["gene_id"])
        median_tpms.append(r["median_tpm"])
        max_tpms.append(r["max_tpm"])
        max_tissues.append(r["max_tissue"])
        n_detected.append(r["n_tissues_detected"])
        for col in _EXPRESSION_TISSUE_COLS:
            tissue_data[col].append(r[col])
    mcols = {
        "gene_symbol": symbols,
        "gene_id": gene_ids,
        "median_tpm": median_tpms,
        "max_tpm": max_tpms,
        "max_tissue": max_tissues,
        "n_tissues_detected": n_detected,
    }
    mcols.update(tissue_data)
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": mcols,
        "n": len(rows),
    }


def _convert_protein_abundance(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, tissues, organ_groups, ppms = [], [], [], []
    coverages, spectral_counts, data_sources, uniprot_ids = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        tissues.append(r["tissue"])
        organ_groups.append(r["organ_group"])
        ppms.append(r["abundance_ppm"])
        coverages.append(r["coverage"])
        spectral_counts.append(r["spectral_count"])
        data_sources.append(r["data_source"])
        uniprot_ids.append(r["uniprot_id"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "tissue": tissues,
            "organ_group": organ_groups,
            "abundance_ppm": ppms,
            "coverage": coverages,
            "spectral_count": spectral_counts,
            "data_source": data_sources,
            "uniprot_id": uniprot_ids,
        },
        "n": len(rows),
    }


def _convert_protein_turnover(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, cell_types, half_lives, k_degs = [], [], [], []
    r_squareds, n_peptides_list, methods, uniprot_ids = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        cell_types.append(r["cell_type"])
        half_lives.append(r["half_life_hours"])
        k_degs.append(r["k_degradation"])
        r_squareds.append(r["r_squared"])
        n_peptides_list.append(r["n_peptides"])
        methods.append(r["measurement_method"])
        uniprot_ids.append(r["uniprot_id"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "cell_type": cell_types,
            "half_life_hours": half_lives,
            "k_degradation": k_degs,
            "r_squared": r_squareds,
            "n_peptides": n_peptides_list,
            "measurement_method": methods,
            "uniprot_id": uniprot_ids,
        },
        "n": len(rows),
    }


def _convert_protein_properties(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols = []
    h_atoms, o_atoms, p_atoms, total_atoms = [], [], [], []
    pis, instabilities, aliphatics, gravys = [], [], [], []
    uniprot_ids, mol_formulas = [], []
    ext_reduced, ext_oxidized = [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        h_atoms.append(r["h_atoms"])
        o_atoms.append(r["o_atoms"])
        p_atoms.append(r["p_atoms"])
        total_atoms.append(r["total_atoms"])
        pis.append(r["pi"])
        instabilities.append(r["instability_index"])
        aliphatics.append(r["aliphatic_index"])
        gravys.append(r["gravy"])
        uniprot_ids.append(r["uniprot_id"])
        mol_formulas.append(r["molecular_formula"])
        ext_reduced.append(r["extinction_coeff_reduced"])
        ext_oxidized.append(r["extinction_coeff_oxidized"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "h_atoms": h_atoms, "o_atoms": o_atoms,
            "p_atoms": p_atoms, "total_atoms": total_atoms,
            "pi": pis, "instability_index": instabilities,
            "aliphatic_index": aliphatics, "gravy": gravys,
            "uniprot_id": uniprot_ids,
            "molecular_formula": mol_formulas,
            "extinction_coeff_reduced": ext_reduced,
            "extinction_coeff_oxidized": ext_oxidized,
        },
        "n": len(rows),
    }


def _convert_protein_atlas(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, tissues, cell_types, levels, reliabilities = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        tissues.append(r["tissue"])
        cell_types.append(r["cell_type"])
        levels.append(r["expression_level"])
        reliabilities.append(r["reliability"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "tissue": tissues, "cell_type": cell_types,
            "expression_level": levels, "reliability": reliabilities,
        },
        "n": len(rows),
    }
