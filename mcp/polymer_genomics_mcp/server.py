"""Polymer Genomics MCP Server.

Wraps the Polymer Genomics REST API as MCP tools for AI agent consumption.
Runs on stdio transport for Claude Code integration.

Usage:
    uv run polymer-genomics-mcp

Configure via environment variables:
    POLYMER_API_BASE=http://localhost:8000  (default)
"""

from __future__ import annotations

import os

import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = os.environ.get("POLYMER_API_BASE", "http://localhost:8000")
API_KEY = os.environ.get("POLYMER_API_KEY", "")

mcp = FastMCP(
    "Polymer Genomics",
    instructions=(
        "Polymer Genomics: curated genomic reference database (hg38/hg37).\n\n"
        "COORDINATES: All regions are 1-based closed. Format: chr16:70699930-70700000.\n"
        "RESPONSE FORMAT: GRanges JSON — seqnames[], ranges.start[], ranges.end[], "
        "strand[], mcols{}. status='complete' or 'truncated'.\n"
        "TRUNCATION: If status='truncated', results are incomplete. Use aggregate_region "
        "for overview, then drill into sub-regions. Never report truncated data as complete.\n\n"
        "TOOL SELECTION:\n"
        "- Gene by name → lookup_gene (returns exons/introns/UTRs; supports aliases like OCT4→POU5F1, p53→TP53)\n"
        "- Probe by ID → lookup_probe (coordinates + CpG context + crossmap)\n"
        "- Everything in a region → query_region (use layers= to filter)\n"
        "- Large region overview → aggregate_region (binned density)\n"
        "- Annotations near a gene → query_proximity (gene + radius, single call)\n"
        "- Gene search → search (prefix match, min 2 chars; also searches gene aliases/synonyms)\n"
        "- DNA sequence → get_sequence (max 100kb)\n"
        "- Multiple probes → batch_probes (max 10,000)\n"
        "- Available data → list_layers\n"
        "- Bulk download → bulk_download (presigned URL, 1hr TTL)\n"
        "- Gene biosynthetic cost → lookup_gene_cost (Akashi-Gojobori + GTEx EWGC)\n"
        "- Gene expression profile → lookup_gene_expression (GTEx v10 54-tissue TPM)\n"
        "- Protein abundance → lookup_protein_abundance (PaxDb tissue-specific PPM)\n"
        "- Gene constraint → lookup_gene_constraint (gnomAD pLI, LOEUF, Z-scores)\n"
        "- Gene pathways → lookup_gene_pathways (Reactome pathway memberships)\n"
        "- Gene sets → lookup_gene_sets (MSigDB Hallmark gene sets)\n"
        "- Protein atlas → lookup_protein_atlas (HPA tissue expression + subcellular)\n"
        "- NN thermodynamics → lookup_nn_parameters (SantaLucia/Xia/Sugimoto ΔH, ΔS, ΔG₃₇)\n"
        "- Dinucleotide properties → lookup_dinucleotide_properties (ε₂₆₀, groove geometry, form propensity)\n"
        "- Amino acid properties → lookup_amino_acid_properties (MW, volume, hydrophobicity, pKa, cost)\n"
        "- Physical constants → lookup_physical_constants (Lp, Manning ξ, elastic moduli, enzymatic rates)\n"
        "- Region biophysics → compute_region_biophysics (ΔG₃₇, ε₂₆₀, form propensity, groove geometry)\n"
        "- Sequence biophysics (1kb bins) → query_region with layers='sequence_biophysics_l0'\n"
        "  (GC, stacking ΔG₃₇, Tm, curvature, groove width, dipole, periodicity, MGW, ProT, Roll, HelT — genome-wide pre-computed)\n"
        "- Cross-layer correlation → correlate_layers (Pearson, Spearman, overlap enrichment, Jaccard, Fisher exact)\n"
        "- SBS spectrum → lookup_sbs_spectrum (96-channel mutation thermodynamics, δΔG per trinucleotide)\n"
        "- Clock probes → lookup_clock_probes (Horvath/Hannum/PhenoAge/GrimAge/DunedinPACE coefficients)\n\n"
        "COMPUTE TOOLS (requires local R + Bioconductor):\n"
        "- Load IDATs → load_idats (creates analysis session)\n"
        "- Normalize → normalize (openSesame for EPICv2, funnorm for 450K/EPIC)\n"
        "- Filter probes → filter_probes (SNP, sex chr, cross-reactive)\n"
        "- Differential methylation → run_limma (limma eBayes on M-values)\n"
        "- Get beta values → get_betas (methylation levels 0-1)\n"
        "- Get M-values → get_m_values (log2 ratio for statistics)\n"
        "- Volcano plot → volcano_plot (from DMP results)\n"
        "- Clustering heatmap → cluster_probes (top variable probes)\n"
        "- Session status → session_status (check pipeline progress)\n"
        "- Cleanup → cleanup_session_tool (remove session data)\n"
        "WORKFLOW: load_idats → normalize → filter_probes → run_limma → visualize\n"
        "Then annotate hits with REFERENCE tools: batch_probes, lookup_gene_expression, compute_region_biophysics"
    ),
    json_response=True,
)

_client: httpx.AsyncClient | None = None


async def get_client() -> httpx.AsyncClient:
    """Return a lazily-initialized async HTTP client (singleton)."""
    global _client
    if _client is None:
        headers = {}
        if API_KEY:
            headers["X-API-Key"] = API_KEY
        _client = httpx.AsyncClient(
            base_url=API_BASE,
            timeout=30.0,
            headers=headers,
        )
    return _client


async def _get(path: str, params: dict | None = None) -> dict:
    """Perform a GET request against the Polymer Genomics API."""
    client = await get_client()
    resp = await client.get(path, params=params)
    resp.raise_for_status()
    return resp.json()


async def _post(path: str, json_body: dict) -> dict:
    """Perform a POST request against the Polymer Genomics API."""
    client = await get_client()
    resp = await client.post(path, json=json_body)
    resp.raise_for_status()
    return resp.json()


# -- Tools -----------------------------------------------------------------


@mcp.tool()
async def list_layers(
    build: str = "hg38",
    layer_type: str | None = None,
    evidence_class: str | None = None,
    tier: str | None = None,
) -> dict:
    """List available genomic data layers.

    Returns metadata about registered annotation layers including epistemic
    classification (evidence_class, tier, validation_status). Use this to
    discover what data is available before querying.

    Use this when you need to check what data is loaded, confirm a layer_key
    exists, filter by evidence quality, or see row counts before a large query.

    Args:
        build: Genome build ('hg38' or 'hg37'). Defaults to 'hg38'.
        layer_type: Optional filter by type ('cpg', 'gene_model', 'probe', etc.).
        evidence_class: Optional filter by epistemic class ('M','R','D','S','K','H','L').
        tier: Optional filter by biological tier ('intrinsic','constrained','active').
    """
    params = {"build": build}
    if layer_type:
        params["type"] = layer_type
    if evidence_class:
        params["evidence_class"] = evidence_class
    if tier:
        params["tier"] = tier
    return await _get("/v1/layers", params)


@mcp.tool()
async def query_region(
    build: str,
    region: str,
    layers: str | None = None,
) -> dict:
    """Query genomic features in a chromosomal region.

    Returns all annotation features (genes, CpG sites, probes, isochores) that
    overlap the specified region. Results are in GRanges format with 1-based
    closed coordinates.

    Use this when you need all annotations overlapping a specific interval.
    Use lookup_gene first if you only have a gene symbol.
    Prefer aggregate_region for regions > 500kb to avoid truncation.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region in format 'chr16:70699930-70700000' (1-based closed).
        layers: Optional comma-separated layer keys to query (e.g. 'cpg_sites,gencode_v44').
                Omit to query all active layers.
    """
    params = {}
    if layers:
        params["layers"] = layers
    return await _get(f"/v1/regions/{build}/{region}", params)


@mcp.tool()
async def get_sequence(
    build: str,
    region: str,
) -> dict:
    """Get the raw DNA sequence for a genomic region.

    Returns the nucleotide sequence (ACGT) for the specified region.
    Maximum 100,000 bp per request.

    Use this when you need the actual nucleotide content — e.g. to inspect
    CpG density, motif context, or primer design around a locus.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region in format 'chr16:70699930-70700000' (1-based closed).
    """
    return await _get(f"/v1/sequence/{build}/{region}")


@mcp.tool()
async def lookup_gene(
    build: str,
    symbol: str,
) -> dict:
    """Look up a gene by symbol.

    Returns all gene features (exons, introns, UTRs, etc.) for the specified
    gene symbol. Results are in GRanges format.

    Use this when you have a gene symbol and need its coordinates, transcript
    structure, or exon boundaries. Use search first if unsure of the exact symbol.

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'VAC14', 'BRCA1', 'TP53').
    """
    return await _get(f"/v1/genes/{build}/{symbol}")


@mcp.tool()
async def lookup_probe(
    build: str,
    probe_id: str,
) -> dict:
    """Look up a methylation array probe by ID.

    Returns probe coordinates, gene symbol, CpG context, and cross-platform
    mappings (450k, EPIC v1, EPIC v2).

    Use this when you have a probe ID (cg/ch prefix) and need its genomic
    position, associated gene, or cross-platform availability.

    Args:
        build: Genome build ('hg38' or 'hg37').
        probe_id: Probe identifier (e.g. 'cg08796240').
    """
    return await _get(f"/v1/probes/{build}/{probe_id}")


@mcp.tool()
async def batch_probes(
    build: str,
    probe_ids: list[str],
) -> dict:
    """Look up multiple probes at once (batch, max 10,000).

    Use this when you have a list of probe IDs — more efficient than calling
    lookup_probe in a loop. Returns the same fields as lookup_probe for each.

    Args:
        build: Genome build ('hg38' or 'hg37').
        probe_ids: List of probe identifiers.
    """
    return await _post(f"/v1/probes/{build}/batch", {"probe_ids": probe_ids})


@mcp.tool()
async def aggregate_region(
    build: str,
    region: str,
    resolution: int = 1000,
    layers: str | None = None,
) -> dict:
    """Get binned density/summary statistics for a region.

    Returns feature counts and density per bin for visualization or overview.

    Use this BEFORE query_region for large regions (>500kb) to avoid truncation.
    Identifies density hotspots to drill into with query_region.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region in format 'chr16:70699930-70700000'.
        resolution: Bin size in bp. Must be 1000, 10000, 100000, or 1000000.
        layers: Optional comma-separated layer keys.
    """
    params: dict = {"resolution": str(resolution)}
    if layers:
        params["layers"] = layers
    return await _get(f"/v1/aggregation/{build}/{region}", params)


@mcp.tool()
async def lookup_gene_cost(
    build: str,
    symbol: str,
) -> dict:
    """Look up bioenergetic cost metrics for a gene.

    Returns biosynthetic cost (Akashi-Gojobori ECPAgene), elemental composition
    (N, S, C atoms), amino acid composition fractions, codon optimization
    metrics (CAI, tAI, ENC), and tissue-specific expression with energetic
    weighted gene cost (EWGC) from GTEx.

    Use this when analyzing gene economy — biosynthetic investment per protein,
    codon bias, or tissue-weighted energetic cost.

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'ALB', 'TP53', 'BRCA1').
    """
    return await _get(f"/v1/genes/{build}/{symbol}/cost")


@mcp.tool()
async def lookup_gene_expression(
    build: str,
    symbol: str,
) -> dict:
    """Look up tissue expression profile for a gene (GTEx v10).

    Returns median TPM across 54 human tissues from GTEx v10. Includes
    summary statistics (median, max, tissue count) and per-tissue values
    sorted by expression level.

    Use this when you need to know where a gene is expressed, compare
    tissue-specific expression, or identify tissue-enriched genes.

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'TP53', 'BRCA1', 'ALB').
    """
    return await _get(f"/v1/genes/{build}/{symbol}/expression")


@mcp.tool()
async def query_proximity(
    build: str,
    gene: str,
    radius: int = 5000,
    layers: str | None = None,
) -> dict:
    """Query annotations around a gene with a specified radius.

    Resolves gene symbol to coordinates, expands by radius on each side,
    and returns all overlapping features. Equivalent to lookup_gene +
    query_region but in a single call.

    Use this when you want to find what CpG sites, probes, or other
    annotations are near a gene.

    Args:
        build: Genome build ('hg38' or 'hg37').
        gene: Gene symbol (e.g. 'TP53', 'BRCA1', 'VAC14').
        radius: Base pairs to expand on each side. Default 5000.
        layers: Optional comma-separated layer keys.
    """
    params: dict = {"build": build, "gene": gene, "radius": str(radius)}
    if layers:
        params["layers"] = layers
    return await _get("/v1/query", params)


@mcp.tool()
async def search(
    query: str,
    build: str = "hg38",
) -> dict:
    """Search for genes by symbol prefix.

    Returns matching gene symbols. Use this to find gene names before
    calling lookup_gene.

    Use this when unsure of the exact gene symbol, or to autocomplete a
    partial name. Always call this before lookup_gene if the symbol might
    have aliases or ambiguous capitalization.

    Args:
        query: Search term (minimum 2 characters). Case-insensitive prefix match.
        build: Genome build ('hg38' or 'hg37').
    """
    return await _get("/v1/search", {"q": query, "build": build})


@mcp.tool()
async def lookup_protein_abundance(
    build: str,
    symbol: str,
) -> dict:
    """Look up tissue-specific protein abundance for a gene (PaxDb v6.0).

    Returns protein abundance in parts per million (PPM) from mass spectrometry
    across multiple tissues. Shows where a protein is most abundant.

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'ALB', 'TP53', 'BRCA1').
    """
    return await _get(f"/v1/genes/{build}/{symbol}/protein-abundance")


@mcp.tool()
async def lookup_gene_constraint(
    build: str,
    symbol: str,
) -> dict:
    """Look up evolutionary constraint metrics for a gene (gnomAD).

    Returns loss-of-function intolerance (pLI, LOEUF), missense constraint
    (mis_z), and synonymous constraint (syn_z) from gnomAD. Lower LOEUF
    means more constrained (intolerant of loss-of-function variants).

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'TP53', 'TET2', 'BRCA1').
    """
    return await _get(f"/v1/genes/{build}/{symbol}/constraint")


@mcp.tool()
async def lookup_gene_pathways(
    build: str,
    symbol: str,
) -> dict:
    """Look up Reactome pathway memberships for a gene.

    Returns all pathways a gene participates in, with pathway hierarchy
    and evidence codes. Use this to understand a gene's biological context.

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'TP53', 'BRCA1', 'ALB').
    """
    return await _get(f"/v1/genes/{build}/{symbol}/pathways")


@mcp.tool()
async def lookup_gene_sets(
    build: str,
    symbol: str,
) -> dict:
    """Look up MSigDB Hallmark gene set memberships for a gene.

    Returns which of the 50 Hallmark gene sets (e.g. OXIDATIVE_PHOSPHORYLATION,
    MYC_TARGETS) a gene belongs to. Standard for functional interpretation.

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'TP53', 'BRCA1', 'MYC').
    """
    return await _get(f"/v1/genes/{build}/{symbol}/gene-sets")


@mcp.tool()
async def lookup_protein_atlas(
    build: str,
    symbol: str,
) -> dict:
    """Look up Human Protein Atlas data for a gene.

    Returns antibody-based protein expression across ~45 normal tissues
    (Not detected/Low/Medium/High) and subcellular localization across
    26 compartments. Bridges RNA expression to protein reality.

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'TP53', 'ALB', 'BRCA1').
    """
    return await _get(f"/v1/genes/{build}/{symbol}/protein-atlas")


@mcp.tool()
async def bulk_download(
    layer_key: str,
) -> dict:
    """Get a presigned download URL for bulk layer data.

    Returns a temporary (1-hour) download URL for the full dataset of a layer.
    Useful for downloading complete probe manifests, CpG site lists, etc.

    Use this when you need the full dataset for offline analysis — e.g. all
    937K EPIC v2 probes or all 29M CpG sites. Not for ad-hoc queries.

    Args:
        layer_key: Layer identifier (e.g. 'probe_epic_v2', 'cpg_sites').
    """
    return await _get(f"/v1/bulk/{layer_key}")


@mcp.tool()
async def lookup_nn_parameters(
    duplex_type: str = "dna_dna",
    dinucleotide: str | None = None,
) -> dict:
    """Look up nearest-neighbor thermodynamic parameters.

    Returns ΔH (kcal/mol), ΔS (cal/mol·K), ΔG₃₇ (kcal/mol) per dinucleotide
    step in 1 M NaCl at 37°C. Sources: SantaLucia 1998 (DNA/DNA),
    Xia/Turner 1998 (RNA/RNA), Sugimoto 1995 (RNA/DNA).

    Use this when you need thermodynamic stability parameters for duplex
    formation — e.g. melting temperature prediction, hybridization energy,
    or stacking free energy per dinucleotide step.

    Args:
        duplex_type: Duplex type — 'dna_dna', 'rna_rna', or 'rna_dna'.
        dinucleotide: Optional specific dinucleotide (e.g. 'CG', 'AA').
    """
    params: dict = {"duplex_type": duplex_type}
    if dinucleotide:
        params["dinucleotide"] = dinucleotide
    return await _get("/v1/reference/nn-parameters", params)


@mcp.tool()
async def lookup_dinucleotide_properties(
    dinucleotide: str | None = None,
    property_set: str = "all",
) -> dict:
    """Look up per-dinucleotide biophysical properties.

    Returns extinction coefficients (Tataurov 2008), A/Z-form propensity
    (El Hassan & Calladine 1997, Ho 1994), and groove geometry (major/minor
    groove width and depth) per dinucleotide step.

    Use this when you need optical properties for concentration measurements,
    structural propensity for non-B DNA prediction, or groove dimensions
    for protein-DNA interaction analysis.

    Args:
        dinucleotide: Optional specific dinucleotide (e.g. 'CG').
        property_set: Which properties to return — 'all', 'extinction',
                      'groove', or 'form_propensity'.
    """
    params: dict = {"property_set": property_set}
    if dinucleotide:
        params["dinucleotide"] = dinucleotide
    return await _get("/v1/reference/dinucleotide-properties", params)


@mcp.tool()
async def lookup_amino_acid_properties(
    residue: str | None = None,
    scale: str = "all",
) -> dict:
    """Look up amino acid biophysical reference properties.

    Returns molecular weight (Da), van der Waals volume (Å³, Zamyatnin 1972),
    solvent-accessible surface area (Å²), hydrophobicity (Kyte-Doolittle,
    Wimley-White, Eisenberg scales), side-chain pKa, charge at pH 7,
    and biosynthetic cost (Akashi-Gojobori ATP equivalents).

    Use this when you need per-residue physical properties for protein
    analysis — sequence-based predictions, cost calculations, or
    hydrophobicity profiling.

    Args:
        residue: Optional one-letter amino acid code (e.g. 'M', 'W').
        scale: Hydrophobicity scale filter — 'all', 'kd', 'ww', or 'eisenberg'.
    """
    params: dict = {"scale": scale}
    if residue:
        params["residue"] = residue
    return await _get("/v1/reference/amino-acid-properties", params)


@mcp.tool()
async def lookup_physical_constants(
    name: str | None = None,
    category: str | None = None,
) -> dict:
    """Look up scalar biophysical constants.

    Returns named physical/chemical constants with values, units, experimental
    context, and primary literature citations. Includes persistence length
    (multiple conditions), Manning condensation parameter, elastic moduli,
    polymerase/ribosome rates, nucleosome thermodynamics, and more.

    Use this when you need canonical published values for biophysical
    calculations — e.g. DNA stiffness, charge density, or enzymatic rates.

    Args:
        name: Optional exact constant name (e.g. 'lp_bdna_physiological_nm').
        category: Optional category filter (e.g. 'mechanics', 'kinetics',
                  'electrostatics', 'nucleosome').
    """
    params: dict = {}
    if name:
        params["name"] = name
    if category:
        params["category"] = category
    return await _get("/v1/reference/physical-constants", params)


@mcp.tool()
async def compute_region_biophysics(
    build: str,
    region: str,
    duplex_type: str = "dna_dna",
    salt_mm: float = 1000.0,
    properties: str = "all",
) -> dict:
    """Compute sequence-derived biophysical properties for a genomic region.

    Fetches the DNA sequence and applies published lookup tables to compute
    per-dinucleotide profiles: thermodynamic stability (SantaLucia ΔG₃₇),
    extinction coefficients (Tataurov ε₂₆₀), A/Z-form propensity, and
    groove geometry. Returns GRanges format (each dinucleotide = one 2-bp range).

    Use this when you need to analyze the biophysical landscape of a genomic
    region — e.g. thermodynamic stability profile, structural propensity
    for non-B DNA, or groove accessibility variation.

    Maximum 10,000 bp per request.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region in format 'chr16:70699930-70700000' (1-based closed).
        duplex_type: Duplex type for NN params — 'dna_dna' (default for genomic DNA).
        salt_mm: NaCl concentration in mM. 1000 = standard (1 M), 150 = physiological.
        properties: Comma-separated properties to compute: 'thermodynamics', 'extinction',
                    'form_propensity', 'groove', or 'all' (default).
    """
    params: dict = {
        "duplex_type": duplex_type,
        "salt_mm": str(salt_mm),
        "properties": properties,
    }
    return await _get(f"/v1/biophysics/{build}/{region}", params)


@mcp.tool()
async def correlate_layers(
    build: str,
    region: str,
    layer_a: str,
    layer_b: str,
    stat: str,
    resolution: int = 10000,
    field_a: str = "density",
    field_b: str = "density",
) -> dict:
    """Compute cross-layer statistical correlation in a genomic region.

    Bins both layers into fixed-size windows, pairs them on bin identity,
    and computes the requested statistic on the paired vectors.

    Available stats:
    - pearson_r, spearman_rho: work on all layer combinations
    - overlap_enrichment, jaccard, fisher_exact: count x count layers only

    Use this when you need to test whether two genomic features co-vary —
    e.g. "does CpG density correlate with conservation?" or "do regulatory
    elements overlap with CpG islands more than expected?"

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region in format 'chr16:70699930-70700000' (1-based closed).
        layer_a: First layer key (e.g. 'cpg_sites').
        layer_b: Second layer key (e.g. 'encode_ccre_v4').
        stat: Statistic — 'pearson_r', 'spearman_rho', 'overlap_enrichment',
              'jaccard', or 'fisher_exact'.
        resolution: Bin size in bp. Must be 1000, 10000, 100000, or 1000000.
                    Default 10000.
        field_a: Numeric field from layer_a (default 'density').
        field_b: Numeric field from layer_b (default 'density').
    """
    params: dict = {
        "layer_a": layer_a,
        "layer_b": layer_b,
        "stat": stat,
        "resolution": str(resolution),
        "field_a": field_a,
        "field_b": field_b,
    }
    return await _get(f"/v1/correlate/{build}/{region}", params)


@mcp.tool()
async def lookup_sbs_spectrum(
    mutation_type: str | None = None,
    channel: str | None = None,
) -> dict:
    """Look up SBS thermodynamic spectrum for trinucleotide mutations.

    Returns the 96-channel COSMIC SBS mutation spectrum with nearest-neighbor
    stacking energy perturbation (δΔG) computed from SantaLucia 1998 parameters.
    Each channel maps a trinucleotide mutation context to its thermodynamic
    impact on DNA duplex stability. Positive δΔG = destabilizing mutation.

    Use this when analyzing mutational signatures through a biophysical lens —
    e.g. mapping COSMIC SBS signatures to energy perturbation profiles, or
    understanding which mutations are thermodynamically costly.

    Args:
        mutation_type: Filter by mutation type (e.g. 'C>A', 'T>G'). Returns 16 channels.
        channel: Specific SBS channel (e.g. 'A[C>A]G'). Returns 1 channel.
    """
    params: dict = {}
    if mutation_type:
        params["mutation_type"] = mutation_type
    if channel:
        params["channel"] = channel
    return await _get("/v1/reference/sbs-spectrum", params)


@mcp.tool()
async def lookup_clock_probes(
    clock: str | None = None,
    probe_id: str | None = None,
) -> dict:
    """Look up epigenetic clock probe coefficients.

    Returns probe weights for epigenetic age clocks: Horvath (2013, pan-tissue),
    Hannum (2013, blood), PhenoAge (Levine 2018), GrimAge (Lu 2019), and
    DunedinPACE (Belsky 2022). Query by clock name to get all probes, or by
    probe_id to see which clocks use it.

    Use this when checking whether a CpG probe is part of an epigenetic clock,
    retrieving clock coefficients for age prediction, or understanding the
    relative weight of a probe in age estimation.

    Args:
        clock: Clock name (e.g. 'horvath_2013', 'phenoage_2018'). Returns all probes for that clock.
        probe_id: Probe ID (e.g. 'cg16867657'). Returns all clocks using this probe.
    """
    params: dict = {}
    if clock:
        params["clock"] = clock
    if probe_id:
        params["probe_id"] = probe_id
    return await _get("/v1/reference/clock-probes", params)


@mcp.tool()
async def intersect_layers(
    build: str,
    region: str,
    filters: list[dict],
    return_layers: list[str] | None = None,
    limit: int = 1000,
) -> dict:
    """Find genomic positions satisfying multiple cross-layer conditions.

    The killer feature: specify conditions across different annotation layers
    and get positions that satisfy ALL of them. No other genomics API offers this.

    Example: find 1kb windows with low stacking energy AND high conservation
    AND overlapping a CpG island.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region 'chr16:70000000-71000000'.
        filters: List of filter dicts, each with 'layer', 'op', and optionally 'field'/'value'.
            Available layers: biophysics, conservation, cpg_sites, cpg_islands, ccre,
            chromatin_state, breakpoints, nonb_dna, repeats.
            Operators: 'overlaps', '>', '<', '>=', '<=', '==', '!=', 'between'.
        return_layers: Optional list of layer keys to annotate intersecting positions with.
        limit: Max results (default 1000, max 10000).
    """
    return await _post("/v1/query/intersect", {
        "build": build,
        "region": region,
        "filters": filters,
        "return_layers": return_layers,
        "limit": limit,
    })


def _register_compute_tools() -> None:
    """Register compute tools if engine is available."""
    try:
        from .compute_tools import register_compute_tools
        register_compute_tools(mcp)
    except Exception:
        # Compute tools are optional — reference tools work without R
        pass


# Register compute tools at import time
_register_compute_tools()


def main():
    """Entry point for the MCP server."""
    mcp.run()


if __name__ == "__main__":
    main()
