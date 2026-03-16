"""Per-layer validation specifications.

Each spec defines the checks to run for a given layer_key.
These encode invariants that should always hold for correctly-ingested data.
"""

from __future__ import annotations

LAYER_VALIDATION_SPECS: dict[str, dict] = {
    "sequence_biophysics_l0": {
        "table": "biophysics.sequence_properties",
        "row_count_min": 2_900_000,
        "value_ranges": {
            "gc_content": (0.0, 1.0),
            "stacking_dg37": (-3.0, 0.0),
            "melting_temp": (40.0, 110.0),
            "curvature": (0.0, 0.5),
        },
        "max_null_frac": 0.001,
        "cross_checks": [
            {
                "field_a": "gc_content",
                "field_b": "stacking_dg37",
                "stat": "pearson_r",
                "expected_sign": "negative",
                "min_abs": 0.90,
            },
            {
                "field_a": "gc_content",
                "field_b": "melting_temp",
                "stat": "pearson_r",
                "expected_sign": "positive",
                "min_abs": 0.95,
            },
        ],
    },
    "cpg_sites": {
        "table": "cpg.sites",
        "row_count_min": 28_000_000,
        "value_ranges": {
            "gc_content": (0.0, 1.0),
        },
        "max_null_frac": 0.0,
    },
    "nonb_dna": {
        "table": "fragility.nonb_dna",
        "row_count_min": 2_900_000,
        "value_ranges": {
            "g4_density": (0.0, 100.0),
            "z_dna_density": (0.0, 100.0),
            "total_nonb_density": (0.0, 500.0),
        },
        "max_null_frac": 0.001,
    },
    "encode_ccre_v4": {
        "table": "regulatory.ccre",
        "row_count_min": 900_000,
        "value_ranges": {
            "score": (0, 1000),
        },
        "max_null_frac": 0.0,
    },
    "phylop_phastcons_100way": {
        "table": "conservation.scores",
        "row_count_min": 3_000_000,
        "value_ranges": {
            "phylop_mean": (-20.0, 10.0),
        },
        "max_null_frac": 0.10,  # centromeric/telomeric gaps have no conservation scores
    },
    "gtex_v10": {
        "table": "expression.gene_tpm",
        "row_count_min": 50_000,
        "value_ranges": {
            "median_tpm": (0.0, 500_000.0),
        },
        "max_null_frac": 0.01,
    },
    "gencode_v44": {
        "table": "gene.features",
        "row_count_min": 2_500_000,
        "value_ranges": {},
        "max_null_frac": 0.0,
    },
    "fragility_composite": {
        "table": "fragility.composite_score",
        "row_count_min": 2_900_000,
        "value_ranges": {
            "fragility_score": (0.0, 1.0),
            "nonb_component": (0.0, 1.0),
            "curvature_component": (0.0, 1.0),
            "stacking_component": (0.0, 1.0),
        },
        "max_null_frac": 0.001,
    },
    "breakpoints": {
        "table": "fragility.breakpoints",
        "row_count_min": 40,
        "value_ranges": {},
        "max_null_frac": 0.0,
    },
}
