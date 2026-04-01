"""HLA allele query functions.

Standalone queries (not registered in TRACK_REGISTRY) since HLA data
is allele-centric, not coordinate-range-based.
"""

from __future__ import annotations


def locus_summary_query() -> str:
    """Per-locus counts and mean biophysics."""
    return """
        SELECT locus, hla_class,
               count(*) AS total_alleles,
               count(*) FILTER (WHERE has_genomic) AS genomic_alleles,
               avg(gc_content) FILTER (WHERE has_genomic) AS mean_gc,
               avg(mean_stacking_dg37) FILTER (WHERE has_genomic) AS mean_dg37,
               avg(melting_temp_est) FILTER (WHERE has_genomic) AS mean_tm
        FROM hla.alleles
        WHERE layer_id = $1
        GROUP BY locus, hla_class
        ORDER BY hla_class, locus
    """


def alleles_list_query(
    *,
    allele_group: str | None = None,
    protein: str | None = None,
    genomic_only: bool = False,
) -> tuple[str, list]:
    """Build a parameterized query for listing alleles at a locus.

    Returns (sql, params) where params[0] = layer_id, params[1] = locus.
    Additional params are appended for optional filters.
    """
    clauses = ["layer_id = $1", "locus = $2"]
    params: list = []  # layer_id and locus are positional ($1, $2)
    idx = 3

    if allele_group is not None:
        clauses.append(f"allele_group = ${idx}")
        params.append(allele_group)
        idx += 1

    if protein is not None:
        clauses.append(f"protein = ${idx}")
        params.append(protein)
        idx += 1

    if genomic_only:
        clauses.append("has_genomic = true")

    where = " AND ".join(clauses)

    sql = f"""
        SELECT allele_name, allele_group, protein, synonymous, noncoding,
               hla_class, expression_suffix, has_genomic,
               sequence_length, cds_length,
               gc_content, mean_stacking_dg37, melting_temp_est,
               nc_gc_content, nc_mean_stacking_dg37, nc_melting_temp_est
        FROM hla.alleles
        WHERE {where}
        ORDER BY allele_name
        LIMIT ${idx} OFFSET ${idx + 1}
    """

    return sql, params


def allele_lookup_query() -> str:
    """Single allele with full biophysics."""
    return """
        SELECT *
        FROM hla.alleles
        WHERE layer_id = $1
          AND allele_name = $2
    """


def allele_features_query() -> str:
    """Features for a single allele."""
    return """
        SELECT feature_type, feature_number, feature_label,
               start_pos, end_pos, length_bp, sequence_hash,
               gc_content, cpg_count, cpg_density, cpg_obs_exp,
               mean_stacking_dg37, melting_temp_est,
               mean_a_form_prop, mean_z_form_prop, total_z_penalty,
               mean_major_groove_w, mean_minor_groove_w,
               cpg_island_count, flag_count
        FROM hla.allele_features
        WHERE layer_id = $1
          AND allele_id = $2
        ORDER BY feature_number
    """


def alleles_by_protein_query() -> str:
    """Find all alleles encoding the same protein (same locus + group + protein).

    This is the Bettens query: alleles identical at the protein level
    but potentially different in non-coding regions.
    """
    return """
        SELECT allele_name, synonymous, noncoding,
               expression_suffix, has_genomic,
               sequence_length,
               gc_content, mean_stacking_dg37, melting_temp_est,
               cpg_density, cpg_island_count,
               nc_gc_content, nc_mean_stacking_dg37, nc_melting_temp_est,
               nc_cpg_density, nc_cpg_island_count
        FROM hla.alleles
        WHERE layer_id = $1
          AND locus = $2
          AND allele_group = $3
          AND protein = $4
          AND has_genomic = true
        ORDER BY allele_name
    """


def multi_allele_lookup_query(n: int) -> str:
    """Lookup multiple alleles by name for comparison.

    n: number of alleles (generates $3..$N+2 placeholders).
    """
    placeholders = ", ".join(f"${i}" for i in range(3, n + 3))
    return f"""
        SELECT *
        FROM hla.alleles
        WHERE layer_id = $1
          AND locus = $2
          AND allele_name = ANY(ARRAY[{placeholders}]::text[])
    """


def allele_sequence_query() -> str:
    """Retrieve raw sequence for an allele."""
    return """
        SELECT s.genomic_seq, s.cds_seq
        FROM hla.allele_sequences s
        JOIN hla.alleles a ON a.id = s.allele_id
        WHERE a.layer_id = $1
          AND a.allele_name = $2
    """
