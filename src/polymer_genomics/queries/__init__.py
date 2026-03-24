"""Parameterized SQL queries and row converters for genomic interval lookups.

This package is split into domain modules for maintainability:
  cpg.py          — CpG sites, islands, methylation reference
  gene.py         — Gene features, probes, biosynthetic costs
  biophysics.py   — Sequence properties, isochores (49 columns)
  conservation.py — PhyloP/PhastCons, gene constraint, dN/dS
  expression.py   — GTEx expression, protein abundance/turnover/properties/atlas
  regulatory.py   — ENCODE cCREs, ChromHMM, histone marks
  genome3d.py     — Hi-C compartments, insulation scores, TAD domains
  annotation.py   — GWAS, repeats, HERV, non-B DNA, fragility

All consumers should import from this package:
  from polymer_genomics.queries import TRACK_REGISTRY
"""

from polymer_genomics.queries._registry import TRACK_REGISTRY, LAYER_QUERY_MAP

__all__ = ["TRACK_REGISTRY", "LAYER_QUERY_MAP"]
