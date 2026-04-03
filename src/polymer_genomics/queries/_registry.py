"""Central dispatch registry mapping layer keys to query/converter pairs."""

from polymer_genomics.queries.cpg import (
    region_cpg_sites_query, _convert_cpg,
    region_cpg_islands_query, _convert_cpg_islands,
    region_methylation_reference_query, _convert_methylation,
)
from polymer_genomics.queries.gene import (
    region_gene_features_query, _convert_gene_model,
    region_probe_coordinates_query, _convert_probe,
    region_gene_costs_query, _convert_gene_cost,
)
from polymer_genomics.queries.biophysics import (
    region_isochores_query, _convert_isochore,
    region_biophysics_query, _convert_biophysics,
)
from polymer_genomics.queries.conservation import (
    region_conservation_query, _convert_conservation,
    region_gene_constraint_query, _convert_gene_constraint,
    region_protein_evolution_query, _convert_protein_evolution,
)
from polymer_genomics.queries.expression import (
    region_expression_query, _convert_expression,
    region_protein_abundance_query, _convert_protein_abundance,
    region_protein_turnover_query, _convert_protein_turnover,
    region_protein_properties_query, _convert_protein_properties,
    region_protein_atlas_query, _convert_protein_atlas,
)
from polymer_genomics.queries.regulatory import (
    region_regulatory_query, _convert_regulatory,
    region_chromatin_state_query, _convert_chromatin_state,
    region_histone_peaks_query, _convert_histone_peaks,
    region_enhancer_gene_query, _convert_enhancer_gene,
)
from polymer_genomics.queries.genome3d import (
    region_hic_compartment_query, _convert_hic_compartment,
    region_insulation_score_query, _convert_insulation_score,
    region_tad_domains_query, _convert_tad_domains,
)
from polymer_genomics.queries.evolution import (
    region_ultraconserved_query, _convert_ultraconserved,
    region_accelerated_query, _convert_accelerated,
    region_archaic_introgression_query, _convert_archaic_introgression,
    region_selection_sweep_query, _convert_selection_sweep,
    region_te_exaptation_query, _convert_te_exaptation,
    region_archaic_methylation_query, _convert_archaic_methylation,
)
from polymer_genomics.queries.nuclear import (
    region_lad_query, _convert_lad,
    region_nad_query, _convert_nad,
    region_dmv_query, _convert_dmv,
    region_super_enhancer_query, _convert_super_enhancer,
)
from polymer_genomics.queries.qtl import (
    region_eqtl_query, _convert_eqtl,
    region_meqtl_query, _convert_meqtl,
)
from polymer_genomics.queries.variation import (
    region_clinvar_query, _convert_clinvar,
)
from polymer_genomics.queries.annotation import (
    region_gwas_query, _convert_gwas,
    region_repeats_query, _convert_repeats,
    region_herv_loci_query, _convert_herv_loci,
    region_nonb_dna_query, _convert_nonb_dna,
    region_breakpoints_query, _convert_breakpoints,
    region_fragility_query, _convert_fragility,
)

TRACK_REGISTRY: dict[str, dict] = {
    "cpg": {
        "query_fn": region_cpg_sites_query,
        "convert_fn": _convert_cpg,
    },
    "cpg_island": {
        "query_fn": region_cpg_islands_query,
        "convert_fn": _convert_cpg_islands,
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
    "gene_cost": {
        "query_fn": region_gene_costs_query,
        "convert_fn": _convert_gene_cost,
    },
    "expression": {
        "query_fn": region_expression_query,
        "convert_fn": _convert_expression,
    },
    "regulatory": {
        "query_fn": region_regulatory_query,
        "convert_fn": _convert_regulatory,
    },
    "conservation": {
        "query_fn": region_conservation_query,
        "convert_fn": _convert_conservation,
    },
    "protein_abundance": {
        "query_fn": region_protein_abundance_query,
        "convert_fn": _convert_protein_abundance,
    },
    "protein_turnover": {
        "query_fn": region_protein_turnover_query,
        "convert_fn": _convert_protein_turnover,
    },
    "protein_properties": {
        "query_fn": region_protein_properties_query,
        "convert_fn": _convert_protein_properties,
    },
    "constraint": {
        "query_fn": region_gene_constraint_query,
        "convert_fn": _convert_gene_constraint,
    },
    "protein_evolution": {
        "query_fn": region_protein_evolution_query,
        "convert_fn": _convert_protein_evolution,
    },
    "protein_atlas": {
        "query_fn": region_protein_atlas_query,
        "convert_fn": _convert_protein_atlas,
    },
    "chromatin_state": {
        "query_fn": region_chromatin_state_query,
        "convert_fn": _convert_chromatin_state,
    },
    "repeat": {
        "query_fn": region_repeats_query,
        "convert_fn": _convert_repeats,
    },
    "herv": {
        "query_fn": region_herv_loci_query,
        "convert_fn": _convert_herv_loci,
    },
    "biophysics": {
        "query_fn": region_biophysics_query,
        "convert_fn": _convert_biophysics,
    },
    "sequence_biophysics": {
        "query_fn": region_biophysics_query,
        "convert_fn": _convert_biophysics,
    },
    "histone_mark": {
        "query_fn": region_histone_peaks_query,
        "convert_fn": _convert_histone_peaks,
    },
    "gwas": {
        "query_fn": region_gwas_query,
        "convert_fn": _convert_gwas,
    },
    "nonb_dna": {
        "query_fn": region_nonb_dna_query,
        "convert_fn": _convert_nonb_dna,
    },
    "breakpoint": {
        "query_fn": region_breakpoints_query,
        "convert_fn": _convert_breakpoints,
    },
    "fragility": {
        "query_fn": region_fragility_query,
        "convert_fn": _convert_fragility,
    },
    "tad_domain": {
        "query_fn": region_tad_domains_query,
        "convert_fn": _convert_tad_domains,
    },
    "hic_compartment": {
        "query_fn": region_hic_compartment_query,
        "convert_fn": _convert_hic_compartment,
    },
    "insulation_score": {
        "query_fn": region_insulation_score_query,
        "convert_fn": _convert_insulation_score,
    },
    # Phase 10: Rosetta Stone expansion
    "ultraconserved": {
        "query_fn": region_ultraconserved_query,
        "convert_fn": _convert_ultraconserved,
    },
    "clinvar": {
        "query_fn": region_clinvar_query,
        "convert_fn": _convert_clinvar,
    },
    "accelerated_region": {
        "query_fn": region_accelerated_query,
        "convert_fn": _convert_accelerated,
    },
    "archaic_introgression": {
        "query_fn": region_archaic_introgression_query,
        "convert_fn": _convert_archaic_introgression,
    },
    "selection_sweep": {
        "query_fn": region_selection_sweep_query,
        "convert_fn": _convert_selection_sweep,
    },
    "te_exaptation": {
        "query_fn": region_te_exaptation_query,
        "convert_fn": _convert_te_exaptation,
    },
    "archaic_methylation": {
        "query_fn": region_archaic_methylation_query,
        "convert_fn": _convert_archaic_methylation,
    },
    "lad": {
        "query_fn": region_lad_query,
        "convert_fn": _convert_lad,
    },
    "nad": {
        "query_fn": region_nad_query,
        "convert_fn": _convert_nad,
    },
    "dmv": {
        "query_fn": region_dmv_query,
        "convert_fn": _convert_dmv,
    },
    "super_enhancer": {
        "query_fn": region_super_enhancer_query,
        "convert_fn": _convert_super_enhancer,
    },
    "eqtl": {
        "query_fn": region_eqtl_query,
        "convert_fn": _convert_eqtl,
    },
    "meqtl": {
        "query_fn": region_meqtl_query,
        "convert_fn": _convert_meqtl,
    },
    "enhancer_gene": {
        "query_fn": region_enhancer_gene_query,
        "convert_fn": _convert_enhancer_gene,
    },
}

# Backwards-compat alias (used by existing tests)
LAYER_QUERY_MAP = {k: v["query_fn"] for k, v in TRACK_REGISTRY.items()}
