"""Parameterized SQL queries for genomic interval lookups."""


def region_cpg_sites_query() -> str:
    return """
        SELECT s.pos, s.pos + 2 AS end_pos, s.context, s.gc_content, s.island_id
        FROM cpg.sites s
        WHERE s.build = $1::genome_build
          AND s.chr_id = $2
          AND s.coord && int4range($3, $4)
          AND s.layer_id = $5
        ORDER BY s.pos
        LIMIT $6
    """


def region_gene_features_query() -> str:
    return """
        SELECT g.start_pos, g.end_pos, g.strand, g.gene_symbol,
               g.gene_id, g.transcript_id, g.feature_type
        FROM gene.features g
        WHERE g.build = $1::genome_build
          AND g.chr_id = $2
          AND g.coord && int4range($3, $4)
          AND g.layer_id = $5
        ORDER BY g.start_pos
        LIMIT $6
    """


def region_probe_coordinates_query() -> str:
    return """
        SELECT p.probe_id, p.pos, p.pos + 1 AS end_pos,
               p.gene_symbol, p.cpg_context
        FROM probe.coordinates p
        WHERE p.build = $1::genome_build
          AND p.chr_id = $2
          AND p.coord && int4range($3, $4)
          AND p.layer_id = $5
        ORDER BY p.pos
        LIMIT $6
    """


def region_isochores_query() -> str:
    return """
        SELECT i.start_pos, i.end_pos, i.gc_content, i.isochore_class
        FROM ref.isochores i
        WHERE i.build = $1::genome_build
          AND i.chr_id = $2
          AND i.coord && int4range($3, $4)
          AND i.layer_id = $5
        ORDER BY i.start_pos
        LIMIT $6
    """


# Map layer_type -> query function
LAYER_QUERY_MAP = {
    "cpg": region_cpg_sites_query,
    "gene_model": region_gene_features_query,
    "probe": region_probe_coordinates_query,
    "isochore": region_isochores_query,
}
