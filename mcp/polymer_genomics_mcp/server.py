"""Polymer Genomics MCP Server.

Wraps the Polymer Genomics REST API as MCP tools for AI agent consumption.
Runs on stdio transport for Claude Code integration.

Usage:
    uv run polymer-genomics-mcp

Configure via environment variables:
    POLYMER_API_BASE=http://localhost:8000  (default)
"""

from __future__ import annotations

import atexit
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
        "START HERE:\n"
        "- Evaluate any DNA sequence → evaluate_design (physics linter: thermodynamics, CpG islands, flags, 10-100kb)\n"
        "- Compare multiple sequences → compare_sequences (side-by-side biophysical comparison with deltas)\n\n"
        "TOOL SELECTION:\n"
        "- Gene by name → lookup_gene (returns exons/introns/UTRs; supports aliases like OCT4→POU5F1, p53→TP53)\n"
        "- Probe by ID → lookup_probe (coordinates + CpG context + crossmap)\n"
        "- Everything in a region → query_region (use layers= to filter, fields= to select mcols, cursor= to paginate)\n"
        "- Region summary stats → region_stats (mean/median/sd/min/max/percentiles, no individual rows)\n"
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
        "- Clock probes → lookup_clock_probes (Horvath/Hannum/PhenoAge/GrimAge/DunedinPACE/Retro-Age coefficients)\n"
        "- Probe-repeat overlap → lookup_probe_repeat_overlap (which probes sit in LINE/SINE/LTR/DNA repeats)\n"
        "- Data validation → validate_layer (row counts, value ranges, null fractions per layer)\n\n"
        "WORKFLOW PATTERNS:\n"
        "- Evaluate a construct: evaluate_design → review flags\n"
        "- Compare designs: compare_sequences → check deltas_vs_reference\n"
        "- Investigate a gene: lookup_gene → lookup_gene_expression → compute_region_biophysics\n"
        "- Annotate methylation hits: batch_probes → lookup_gene → lookup_gene_expression\n"
        "- Cross-layer analysis: query_region (multi-layer) → correlate_layers\n\n"
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


def _shutdown_client() -> None:
    """Close the httpx client at interpreter exit."""
    import asyncio

    if _client is not None:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(_client.aclose())
            else:
                loop.run_until_complete(_client.aclose())
        except Exception:
            pass


atexit.register(_shutdown_client)


async def get_client() -> httpx.AsyncClient:
    """Return a lazily-initialized async HTTP client (singleton)."""
    global _client
    if _client is None:
        headers = {}
        if API_KEY:
            headers["X-API-Key"] = API_KEY
        _client = httpx.AsyncClient(
            base_url=API_BASE,
            timeout=120.0,
            headers=headers,
        )
    return _client


async def _get(path: str, params: dict | None = None) -> dict:
    """Perform a GET request against the Polymer Genomics API."""
    client = await get_client()
    try:
        resp = await client.get(path, params=params)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        return {
            "error": f"API returned {exc.response.status_code}",
            "detail": exc.response.text[:500],
            "path": path,
        }
    return resp.json()


async def _post(path: str, json_body: dict) -> dict:
    """Perform a POST request against the Polymer Genomics API."""
    client = await get_client()
    try:
        resp = await client.post(path, json=json_body)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        return {
            "error": f"API returned {exc.response.status_code}",
            "detail": exc.response.text[:500],
            "path": path,
        }
    return resp.json()


# -- Summary builders --------------------------------------------------------
# Deterministic text summaries prepended to tool results so AI agents get a
# quick overview without needing to parse deeply nested JSON.


def _summarize_gene(data: dict) -> str:
    """Build one-line summary from gene lookup response."""
    try:
        d = data.get("data", {})
        layer_key = next(iter(d), None)
        if not layer_key:
            return ""
        layer = d[layer_key]
        seqnames = layer.get("seqnames", [])
        starts = layer.get("ranges", {}).get("start", [])
        ends = layer.get("ranges", {}).get("end", [])
        mcols = layer.get("mcols", {})
        symbols = mcols.get("gene_symbol", [])
        features = mcols.get("feature_type", [])

        symbol = symbols[0] if symbols else "?"
        chrom = seqnames[0] if seqnames else "?"
        gene_start = min(starts) if starts else 0
        gene_end = max(ends) if ends else 0
        span_kb = (gene_end - gene_start) / 1000
        n_exons = sum(1 for f in features if f == "exon")
        strand = layer.get("strand", ["+"])[0]
        return (
            f"{symbol} on {chrom}:{gene_start}-{gene_end} "
            f"({span_kb:.1f} kb, {strand} strand). "
            f"{n_exons} exons, {len(seqnames)} total features."
        )
    except Exception:
        return ""


def _summarize_expression(data: dict, symbol: str) -> str:
    """Build summary from expression response."""
    try:
        d = data.get("data", {})
        tissues = d.get("tissues", {})
        if not tissues:
            return ""
        sorted_t = sorted(tissues.items(), key=lambda x: x[1], reverse=True)
        top3 = sorted_t[:3]
        n_expressed = sum(1 for _, v in tissues.items() if v > 1.0)
        top_str = ", ".join(f"{t} ({v:.1f})" for t, v in top3)
        return (
            f"{symbol}: expressed in {n_expressed}/{len(tissues)} tissues. "
            f"Highest: {top_str} TPM."
        )
    except Exception:
        return ""


def _summarize_evaluate(data: dict) -> str:
    """Build summary from evaluate_design response."""
    try:
        s = data.get("summary", {})
        flags = data.get("flags", [])
        fc = data.get("flag_counts", {})
        n_warnings = fc.get("warning", 0)
        n_info = fc.get("info", 0)
        gc = s.get("gc_content", 0)
        dg = s.get("mean_stacking_dG37_kcal", 0)
        length = s.get("length_bp", 0)
        cpg_n = s.get("cpg_island_count", 0)
        parts = [f"{length} bp, GC={gc:.1%}, mean ΔG₃₇={dg:.2f} kcal/mol"]
        if cpg_n:
            parts.append(f"{cpg_n} CpG island{'s' if cpg_n > 1 else ''}")
        parts.append(f"{n_warnings} warning{'s' if n_warnings != 1 else ''}, {n_info} info")
        if n_warnings > 0:
            codes = [f["code"] for f in flags if f.get("type") == "warning"]
            parts.append(f"warnings: {', '.join(codes)}")
        return ". ".join(parts) + "."
    except Exception:
        return ""


def _summarize_constraint(data: dict, symbol: str) -> str:
    """Build summary from constraint response."""
    try:
        d = data.get("data", {})
        pli = d.get("pLI", "?")
        loeuf = d.get("oe_lof_upper", "?")
        mis_z = d.get("mis_z", "?")
        if isinstance(pli, (int, float)):
            tolerance = "highly constrained" if pli > 0.9 else "moderately constrained" if pli > 0.5 else "tolerant of LoF"
            return f"{symbol}: pLI={pli:.3f} ({tolerance}), LOEUF={loeuf}, missense Z={mis_z}."
        return ""
    except Exception:
        return ""


def _summarize_region(data: dict, region: str) -> str:
    """Build summary from query_region response."""
    try:
        d = data.get("data", {})
        parts = [region]
        for layer_key, layer_data in d.items():
            n = len(layer_data.get("seqnames", []))
            parts.append(f"{layer_key}: {n} features")
        status = data.get("status", "complete")
        if status == "truncated":
            parts.append("TRUNCATED — use aggregate_region or narrow the region")
        return ". ".join(parts) + "."
    except Exception:
        return ""


def _summarize_biophysics(data: dict, region: str) -> str:
    """Build summary from compute_region_biophysics response."""
    try:
        d = data.get("data", {})
        mcols = d.get("mcols", {})
        dg_vals = mcols.get("stacking_dG37_kcal", [])
        if not dg_vals:
            return ""
        nums = [v for v in dg_vals if isinstance(v, (int, float))]
        if not nums:
            return ""
        mean_dg = sum(nums) / len(nums)
        min_dg = min(nums)
        max_dg = max(nums)
        n_steps = len(nums)
        return (
            f"{region}: {n_steps} dinucleotide steps. "
            f"Mean ΔG₃₇={mean_dg:.2f}, range [{min_dg:.2f}, {max_dg:.2f}] kcal/mol."
        )
    except Exception:
        return ""


def _with_summary(data: dict, summary: str) -> dict:
    """Prepend _summary to a response dict if summary is non-empty."""
    if summary and not data.get("error"):
        return {"_summary": summary, **data}
    return data


# -- Tools -----------------------------------------------------------------


@mcp.tool()
async def list_layers(
    build: str = "hg38",
    layer_type: str | None = None,
    evidence_class: str | None = None,
    tier: str | None = None,
) -> dict:
    """List available genomic data layers with epistemic metadata.

    Returns metadata about every registered annotation layer: layer_key,
    layer_type, row_count, evidence_class, tier, validation_status, and
    content_hash. Use this to discover what data is available.

    Example output (truncated):
    {"layers": [
      {"layer_key": "gencode_v44", "layer_type": "gene_model", "row_count": 1234567,
       "evidence_class": "R", "tier": "constrained"},
      {"layer_key": "cpg_sites", "layer_type": "cpg", "row_count": 29000000, ...}
    ]}

    Key output fields:
    - layer_key: identifier to pass to query_region, correlate_layers, etc.
    - row_count: total features in the layer (helps gauge query size)
    - evidence_class: M=measured, R=reference, D=derived, S=statistical, etc.

    Does NOT return the actual data — use query_region or aggregate_region for that.

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
    fields: str | None = None,
    cursor: str | None = None,
) -> dict:
    """Query genomic features in a chromosomal region.

    Returns all annotation features (genes, CpG sites, probes, isochores, etc.)
    overlapping the region. Results in GRanges format: seqnames[], ranges.start[],
    ranges.end[], strand[], mcols{}.

    Example output (truncated):
    {"status": "complete", "data": {
      "gencode_v44": {"seqnames": ["chr17"], "ranges": {"start": [7668402], "end": [7687550]},
                      "mcols": {"gene_symbol": ["TP53"], "feature_type": ["exon"]}},
      "cpg_sites": {"seqnames": ["chr17","chr17"], ...}
    }}

    Key output fields per layer:
    - seqnames[]: chromosome
    - ranges.start[], ranges.end[]: 1-based closed coordinates
    - mcols{}: layer-specific annotation columns

    Does NOT return biophysical properties — use compute_region_biophysics for ΔG₃₇/groove/form.
    Does NOT return expression — use lookup_gene_expression.
    Prefer aggregate_region for regions > 500kb to avoid truncation.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region in format 'chr16:70699930-70700000' (1-based closed).
        layers: Optional comma-separated layer keys to query (e.g. 'cpg_sites,gencode_v44').
                Omit to query all active layers.
        fields: Optional comma-separated mcols field names to return (e.g. 'gc_content,stacking_dg37').
                Omit to return all fields. Reduces response size significantly.
        cursor: Opaque pagination cursor from a previous response's pagination.{layer_key}.next_cursor.
                Use to fetch the next page of results.
    """
    params = {}
    if layers:
        params["layers"] = layers
    if fields:
        params["fields"] = fields
    if cursor:
        params["cursor"] = cursor
    data = await _get(f"/v1/regions/{build}/{region}", params)
    return _with_summary(data, _summarize_region(data, region))


@mcp.tool()
async def region_stats(
    build: str,
    region: str,
    layers: str | None = None,
    fields: str | None = None,
) -> dict:
    """Get summary statistics for data layers in a genomic region.

    Returns mean, median, sd, min, max, and percentiles (p25, p75) for
    continuous layers, or count + density for count-mode layers.
    Much smaller than query_region — ideal when you only need summary numbers.

    Example output:
    {"data": {
      "sequence_biophysics_l0": {
        "gc_content": {"n": 301, "mean": 0.412, "median": 0.41, "sd": 0.05, "min": 0.29, "max": 0.56, "p25": 0.38, "p75": 0.45},
        "stacking_dg37": {"n": 301, "mean": -1.42, ...}
      },
      "cpg_sites": {"count": 152, "density": 0.000507}
    }}

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region in format 'chr16:70699930-70700000' (1-based closed).
        layers: Optional comma-separated layer keys (e.g. 'sequence_biophysics_l0').
        fields: Optional comma-separated field names to include in stats (e.g. 'gc_content,stacking_dg37').
    """
    params = {}
    if layers:
        params["layers"] = layers
    if fields:
        params["fields"] = fields
    return await _get(f"/v1/stats/{build}/{region}", params)


@mcp.tool()
async def get_sequence(
    build: str,
    region: str,
) -> dict:
    """Get the raw DNA sequence for a genomic region.

    Returns the nucleotide sequence (ACGT) for the specified region.
    Maximum 100,000 bp per request.

    Example output:
    {"sequence": "ATGCGATCGATCG...", "length": 1000, "region": "chr17:7668402-7669401"}

    Does NOT return annotations — use query_region for that.
    Does NOT compute biophysics — use evaluate_design (for arbitrary sequences)
    or compute_region_biophysics (for genomic coordinates).

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
    """Look up a gene by symbol, returning exon/intron/UTR structure.

    Supports gene aliases (e.g., OCT4 → POU5F1, p53 → TP53).
    Returns GRanges JSON with one row per genomic feature
    (exon, intron, 5'UTR, 3'UTR, CDS).

    Example output (truncated):
    {"data": {"gencode_v44": {
      "seqnames": ["chr17","chr17",...],
      "ranges": {"start": [7668402,...], "end": [7669690,...]},
      "mcols": {"gene_symbol": ["TP53",...], "feature_type": ["exon","intron",...],
                "transcript_id": ["ENST00000269305",...]}
    }}}

    Key output fields in mcols:
    - gene_symbol: canonical symbol (alias resolved)
    - feature_type: exon, intron, 5UTR, 3UTR, CDS
    - transcript_id: ENSEMBL transcript ID

    Does NOT return: expression data (use lookup_gene_expression), constraint
    scores (use lookup_gene_constraint), pathways (use lookup_gene_pathways),
    or biophysical properties (use compute_region_biophysics with the coordinates).

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'VAC14', 'BRCA1', 'TP53'). Aliases auto-resolved.
    """
    data = await _get(f"/v1/genes/{build}/{symbol}")
    return _with_summary(data, _summarize_gene(data))


@mcp.tool()
async def lookup_probe(
    build: str,
    probe_id: str,
) -> dict:
    """Look up a methylation array probe by ID.

    Returns probe coordinates, associated gene, CpG context (island/shore/shelf/
    open_sea), and cross-platform availability (450K, EPIC v1, EPIC v2).

    Example output:
    {"data": {"probe_id": "cg08796240", "chr": "chr16", "pos": 70699929,
     "gene_symbol": "VAC14", "cpg_context": "island", "strand": "+",
     "platforms": {"450k": true, "epic_v1": true, "epic_v2": true}}}

    Key output fields:
    - cpg_context: island, shore, shelf, or open_sea
    - platforms: which arrays include this probe
    - gene_symbol: nearest gene (may be null for intergenic probes)

    Does NOT return methylation beta values — use get_betas (compute tool).
    Does NOT return clock membership — use lookup_clock_probes.
    For multiple probes, use batch_probes instead (max 10,000).

    Args:
        build: Genome build ('hg38' or 'hg37').
        probe_id: Probe identifier (e.g. 'cg08796240', 'ch.1.1234').
    """
    return await _get(f"/v1/probes/{build}/{probe_id}")


@mcp.tool()
async def batch_probes(
    build: str,
    probe_ids: list[str],
) -> dict:
    """Look up multiple probes at once (batch, max 10,000).

    Returns the same fields as lookup_probe for each probe. Far more efficient
    than calling lookup_probe in a loop.

    Example output (truncated):
    {"data": {"found": 95, "not_found": 5, "probes": [
      {"probe_id": "cg08796240", "chr": "chr16", "pos": 70699929, "gene_symbol": "VAC14", ...},
      ...
    ]}}

    Does NOT return methylation values — use get_betas after loading IDATs.

    Args:
        build: Genome build ('hg38' or 'hg37').
        probe_ids: List of probe identifiers (max 10,000).
    """
    return await _post(f"/v1/probes/{build}/batch", {"probe_ids": probe_ids})


@mcp.tool()
async def aggregate_region(
    build: str,
    region: str,
    resolution: int = 1000,
    layers: str | None = None,
) -> dict:
    """Get binned density/summary statistics for a large region.

    Returns feature counts per bin. Use this BEFORE query_region for regions
    > 500kb to avoid truncation and identify density hotspots.

    Example output (truncated):
    {"data": {"gencode_v44": {"bins": [
      {"start": 70000000, "end": 70001000, "count": 3, "density": 0.003},
      ...
    ]}}}

    Key output fields per bin:
    - count: number of features in this bin
    - density: features per bp

    Does NOT return individual features — drill into hotspots with query_region.

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

    Returns biosynthetic cost (Akashi-Gojobori ECPAgene in ATP equivalents),
    elemental composition (N, S, C atoms), amino acid composition fractions,
    codon optimization metrics (CAI, tAI, ENC), and tissue-specific
    expression-weighted gene cost (EWGC) from GTEx.

    Example output (truncated):
    {"data": {"symbol": "ALB", "ecpa_gene": 23456.7, "cai": 0.78, "enc": 51.2,
     "amino_acid_fractions": {"L": 0.12, "A": 0.09, ...},
     "ewgc_by_tissue": {"Liver": 98765.4, "Blood": 1234.5, ...}}}

    Key output fields:
    - ecpa_gene: total ATP cost to synthesize one protein molecule
    - ewgc_by_tissue: cost × expression = metabolic investment per tissue
    - cai: Codon Adaptation Index (higher = more optimized)

    Does NOT return expression alone — use lookup_gene_expression.
    Does NOT return constraint — use lookup_gene_constraint.

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
    """Look up tissue expression profile for a gene (GTEx v10, 54 tissues).

    Returns median TPM across 54 human tissues. Includes summary statistics
    (median, max, tissue count, breadth) and per-tissue values sorted by
    expression level.

    Example output (truncated):
    {"data": {"symbol": "ALB", "summary": {"max_tpm": 45678.9, "max_tissue": "Liver",
     "n_expressed": 3, "median_tpm": 0.1},
     "tissues": {"Liver": 45678.9, "Kidney - Cortex": 12.3, ...}}}

    Key output fields:
    - tissues{}: tissue name → median TPM (sorted by expression)
    - summary.max_tissue: where the gene is most highly expressed
    - summary.n_expressed: number of tissues with TPM > 1

    Does NOT return protein abundance — use lookup_protein_abundance (PaxDb).
    Does NOT return protein localization — use lookup_protein_atlas (HPA).

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'TP53', 'BRCA1', 'ALB').
    """
    data = await _get(f"/v1/genes/{build}/{symbol}/expression")
    return _with_summary(data, _summarize_expression(data, symbol))


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

    Example output (truncated):
    {"data": {"gencode_v44": {...}, "cpg_sites": {...}, "probe_epic_v2": {...}},
     "query": {"gene": "TP53", "radius": 5000, "resolved_region": "chr17:7663402-7692550"}}

    Does NOT return biophysical properties — chain with compute_region_biophysics.
    Does NOT return expression — use lookup_gene_expression separately.

    Args:
        build: Genome build ('hg38' or 'hg37').
        gene: Gene symbol (e.g. 'TP53', 'BRCA1', 'VAC14'). Aliases auto-resolved.
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
    """Search for genes by symbol prefix (also searches aliases/synonyms).

    Returns matching gene symbols with their canonical names. Use this
    before lookup_gene when unsure of the exact symbol.

    Example output:
    {"results": [
      {"symbol": "BRCA1", "name": "BRCA1 DNA repair associated", "chr": "chr17"},
      {"symbol": "BRCA2", "name": "BRCA2 DNA repair associated", "chr": "chr13"}
    ]}

    Does NOT return gene structure — follow up with lookup_gene.

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
    across multiple human tissues.

    Example output (truncated):
    {"data": {"symbol": "ALB", "tissues": {"Plasma": 54000.0, "Liver": 23000.0, ...},
     "summary": {"max_ppm": 54000.0, "max_tissue": "Plasma"}}}

    Does NOT return RNA expression — use lookup_gene_expression (GTEx TPM).
    Does NOT return protein localization — use lookup_protein_atlas (HPA).

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
    """Look up evolutionary constraint metrics for a gene (gnomAD v4).

    Returns loss-of-function intolerance (pLI, LOEUF), missense constraint
    (mis_z), and synonymous constraint (syn_z). Lower LOEUF = more constrained.

    Example output:
    {"data": {"symbol": "TP53", "pLI": 0.999, "oe_lof_upper": 0.13,
     "mis_z": 3.42, "syn_z": 0.87}}

    Key output fields:
    - pLI: probability of loss-of-function intolerance (>0.9 = highly constrained)
    - oe_lof_upper: LOEUF — observed/expected LoF upper bound (<0.35 = constrained)
    - mis_z: missense Z-score (>3 = missense-constrained)

    Does NOT return expression — use lookup_gene_expression.
    Does NOT return pathways — use lookup_gene_pathways.

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'TP53', 'TET2', 'BRCA1').
    """
    data = await _get(f"/v1/genes/{build}/{symbol}/constraint")
    return _with_summary(data, _summarize_constraint(data, symbol))


@mcp.tool()
async def lookup_gene_pathways(
    build: str,
    symbol: str,
) -> dict:
    """Look up Reactome pathway memberships for a gene.

    Returns all pathways a gene participates in, with pathway hierarchy,
    evidence codes, and top-level category.

    Example output (truncated):
    {"data": {"symbol": "TP53", "pathways": [
      {"pathway_id": "R-HSA-6791312", "name": "TP53 Regulates Transcription of Cell Cycle Genes",
       "top_category": "Cell Cycle", "evidence": "TAS"},
      ...
    ], "n_pathways": 42}}

    Does NOT return gene sets — use lookup_gene_sets (MSigDB Hallmark).
    Does NOT return expression — use lookup_gene_expression.

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

    Returns which of the 50 Hallmark gene sets a gene belongs to.
    Standard for functional interpretation of gene lists.

    Example output:
    {"data": {"symbol": "MYC", "gene_sets": [
      "HALLMARK_MYC_TARGETS_V1", "HALLMARK_MYC_TARGETS_V2",
      "HALLMARK_E2F_TARGETS", "HALLMARK_G2M_CHECKPOINT"
    ], "n_sets": 4}}

    Does NOT return Reactome pathways — use lookup_gene_pathways.

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

    Example output (truncated):
    {"data": {"symbol": "TP53", "tissue_expression": [
      {"tissue": "Liver", "level": "Medium", "cell_type": "hepatocytes"},
      ...
    ], "subcellular": ["Nucleoplasm", "Cytosol"]}}

    Does NOT return RNA expression — use lookup_gene_expression (GTEx).
    Does NOT return protein abundance — use lookup_protein_abundance (PaxDb PPM).

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

    Returns a temporary (1-hour) download URL for the complete dataset.

    Example output:
    {"url": "https://storage.googleapis.com/...", "expires_in": 3600,
     "layer_key": "probe_epic_v2", "row_count": 937000}

    Use this for offline analysis — e.g. all 937K EPIC v2 probes.
    Does NOT return data directly — download from the returned URL.

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
    step in 1 M NaCl at 37 C. Sources: SantaLucia 1998 (DNA/DNA),
    Xia/Turner 1998 (RNA/RNA), Sugimoto 1995 (RNA/DNA).

    Example output (for dinucleotide='CG'):
    {"data": {"dinucleotide": "CG", "dH_kcal": -10.6, "dS_cal": -27.2,
     "dG37_kcal": -2.17, "duplex_type": "dna_dna", "source": "SantaLucia 1998"}}

    Key output fields:
    - dG37_kcal: stacking free energy at 37 C (more negative = more stable)
    - dH_kcal, dS_cal: enthalpy/entropy components

    Does NOT compute over a sequence — use evaluate_design or compute_region_biophysics.

    Args:
        duplex_type: Duplex type — 'dna_dna', 'rna_rna', or 'rna_dna'.
        dinucleotide: Optional specific dinucleotide (e.g. 'CG', 'AA'). Omit for all 16.
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

    Example output (for dinucleotide='CG'):
    {"data": {"dinucleotide": "CG", "extinction_260_M_cm": 7600,
     "a_form_propensity": 0.85, "z_form_propensity": 0.92,
     "major_groove_width_A": 11.2, "minor_groove_width_A": 5.9}}

    Does NOT compute over a sequence — use evaluate_design for that.

    Args:
        dinucleotide: Optional specific dinucleotide (e.g. 'CG'). Omit for all 16.
        property_set: Which properties — 'all', 'extinction', 'groove', or 'form_propensity'.
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

    Returns molecular weight (Da), van der Waals volume (A^3), SASA (A^2),
    hydrophobicity (Kyte-Doolittle, Wimley-White, Eisenberg), pKa, charge
    at pH 7, and biosynthetic cost (Akashi-Gojobori ATP equivalents).

    Example output (for residue='W'):
    {"data": {"residue": "W", "name": "Tryptophan", "mw_da": 204.23,
     "volume_A3": 163.3, "hydrophobicity_kd": -0.9, "cost_atp": 74.3,
     "pka_sidechain": null, "charge_ph7": 0}}

    Does NOT return gene-level cost — use lookup_gene_cost for protein cost.

    Args:
        residue: Optional one-letter amino acid code (e.g. 'M', 'W'). Omit for all 20.
        scale: Hydrophobicity scale — 'all', 'kd', 'ww', or 'eisenberg'.
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
    """Look up scalar biophysical constants with citations.

    Returns named constants with values, units, experimental context,
    and primary literature references. Categories: mechanics, kinetics,
    electrostatics, nucleosome, thermodynamics.

    Example output (for name='lp_bdna_physiological_nm'):
    {"data": {"name": "lp_bdna_physiological_nm", "value": 50.0, "unit": "nm",
     "context": "B-DNA in 150 mM NaCl, 25C", "source": "Hagerman 1988",
     "category": "mechanics"}}

    Does NOT compute over sequences — these are scalar reference values.

    Args:
        name: Optional exact constant name (e.g. 'lp_bdna_physiological_nm').
        category: Optional category filter ('mechanics', 'kinetics', 'electrostatics',
                  'nucleosome', 'thermodynamics').
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
    """Compute per-dinucleotide biophysical properties for a genomic region.

    Fetches the DNA sequence and applies published lookup tables to compute
    profiles: stacking ΔG₃₇ (SantaLucia), extinction ε₂₆₀ (Tataurov),
    A/Z-form propensity, and groove geometry. Each dinucleotide step = one row.

    Example output (truncated):
    {"data": {"seqnames": ["chr17","chr17",...],
     "ranges": {"start": [7668402,7668403,...], "end": [7668403,7668404,...]},
     "mcols": {"stacking_dG37_kcal": [-1.44,-2.17,...], "extinction_260": [7200,7600,...],
               "a_form_propensity": [0.5,0.85,...], "z_form_propensity": [0.1,0.92,...],
               "major_groove_width_A": [11.7,11.2,...]}}}

    Key output fields in mcols:
    - stacking_dG37_kcal: free energy per step (more negative = more stable)
    - z_form_propensity: Z-DNA propensity (>0.5 = Z-form prone)
    - major/minor_groove_width_A: groove dimensions in angstroms

    Does NOT work on arbitrary sequences — use evaluate_design for non-genomic DNA.
    Maximum 10,000 bp per request.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region 'chr16:70699930-70700000' (1-based closed, max 10kb).
        duplex_type: 'dna_dna' (default), 'rna_rna', or 'rna_dna'.
        salt_mm: NaCl in mM. 1000 = standard (1 M), 150 = physiological.
        properties: Comma-separated: 'thermodynamics', 'extinction', 'form_propensity',
                    'groove', or 'all' (default).
    """
    params: dict = {
        "duplex_type": duplex_type,
        "salt_mm": str(salt_mm),
        "properties": properties,
    }
    data = await _get(f"/v1/biophysics/{build}/{region}", params)
    return _with_summary(data, _summarize_biophysics(data, region))


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

    Bins both layers into fixed-size windows, pairs them, and computes
    the requested statistic.

    Available stats:
    - pearson_r, spearman_rho: continuous correlation (all layer combos)
    - overlap_enrichment, jaccard, fisher_exact: binary overlap (count layers)

    Example output:
    {"data": {"stat": "pearson_r", "value": 0.42, "p_value": 1.2e-8,
     "n_bins": 100, "layer_a": "cpg_sites", "layer_b": "gencode_v44"}}

    Does NOT return individual features — use query_region for that.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region 'chr16:70699930-70700000' (1-based closed).
        layer_a: First layer key (e.g. 'cpg_sites').
        layer_b: Second layer key (e.g. 'gencode_v44').
        stat: 'pearson_r', 'spearman_rho', 'overlap_enrichment', 'jaccard', or 'fisher_exact'.
        resolution: Bin size in bp (1000, 10000, 100000, or 1000000). Default 10000.
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

    Returns 96-channel COSMIC SBS mutation spectrum with nearest-neighbor
    stacking energy perturbation (deltaG) from SantaLucia 1998. Each channel
    maps a trinucleotide context to thermodynamic impact. Positive = destabilizing.

    Example output (for channel='A[C>A]G'):
    {"data": {"channel": "A[C>A]G", "mutation_type": "C>A",
     "ref_trinuc": "ACG", "alt_trinuc": "AAG",
     "dG37_ref_kcal": -3.61, "dG37_alt_kcal": -2.89, "delta_dG37_kcal": 0.72}}

    Key output fields:
    - delta_dG37_kcal: energy perturbation (positive = destabilizing, negative = stabilizing)

    Does NOT compute mutation impact on a specific sequence — it provides per-channel
    reference values. For sequence-specific analysis, use evaluate_design + compare_sequences.

    Args:
        mutation_type: Filter by type (e.g. 'C>A', 'T>G'). Returns 16 channels.
        channel: Specific channel (e.g. 'A[C>A]G'). Returns 1 entry.
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

    Returns probe weights for: Horvath (2013, pan-tissue), Hannum (2013, blood),
    PhenoAge (Levine 2018), GrimAge (Lu 2019), DunedinPACE (Belsky 2022),
    Retro-Age (retro_age_v2, retro_age_450k, retro_age_panmammalian).

    Query by clock name → all probes for that clock.
    Query by probe_id → all clocks using that probe.

    Example output (for clock='horvath_2013', truncated):
    {"data": {"clock": "horvath_2013", "n_probes": 353, "probes": [
      {"probe_id": "cg16867657", "coefficient": 0.0217, "intercept_contrib": 0.0012},
      ...
    ]}}

    Does NOT return methylation values — load IDATs first with compute tools.

    Args:
        clock: Clock name (e.g. 'horvath_2013', 'phenoage_2018', 'retro_age_v2').
        probe_id: Probe ID (e.g. 'cg16867657'). Returns all clocks using it.
    """
    params: dict = {}
    if clock:
        params["clock"] = clock
    if probe_id:
        params["probe_id"] = probe_id
    return await _get("/v1/reference/clock-probes", params)


@mcp.tool()
async def lookup_probe_repeat_overlap(
    probe_id: str | None = None,
    platform: str | None = None,
    repeat_class: str | None = None,
    repeat_age: str | None = None,
    limit: int = 100,
) -> dict:
    """Look up probes overlapping repeat elements (LINE, SINE, LTR, DNA transposons).

    Returns which probes sit inside transposable elements, with evolutionary
    age classification (young/intermediate/ancient) and sequence divergence.

    Example output (truncated):
    {"data": {"probes": [
      {"probe_id": "cg16867657", "repeat_name": "L1HS", "repeat_class": "LINE",
       "repeat_age": "young", "divergence_pct": 2.1, "platform": "epic_v2"},
      ...
    ], "total": 42}}

    Does NOT return probe coordinates — use lookup_probe for position/gene/context.

    Args:
        probe_id: Optional probe ID. Check one probe for repeat overlap.
        platform: Optional filter ('epic_v2', 'epic_v1', '450k').
        repeat_class: Optional filter ('LINE', 'SINE', 'LTR', 'DNA').
        repeat_age: Optional filter ('young', 'intermediate', 'ancient').
        limit: Max results (default 100, max 10000).
    """
    params: dict = {"limit": str(limit)}
    if probe_id:
        params["probe_id"] = probe_id
    if platform:
        params["platform"] = platform
    if repeat_class:
        params["repeat_class"] = repeat_class
    if repeat_age:
        params["repeat_age"] = repeat_age
    return await _get("/v1/reference/probe-repeat-overlap", params)


@mcp.tool()
async def intersect_layers(
    build: str,
    region: str,
    filters: list[dict],
    return_layers: list[str] | None = None,
    limit: int = 1000,
) -> dict:
    """Find genomic positions satisfying multiple cross-layer conditions.

    Specify conditions across different annotation layers and get positions
    that satisfy ALL of them simultaneously.

    Example: find positions with low stacking energy AND in a CpG island:
    filters=[
      {"layer": "biophysics", "field": "stacking_dG37", "op": ">", "value": -1.0},
      {"layer": "cpg_islands", "op": "overlaps"}
    ]

    Example output (truncated):
    {"data": {"n_hits": 42, "positions": [
      {"chr": "chr16", "start": 70699950, "end": 70699960,
       "annotations": {"stacking_dG37": -0.85, "cpg_context": "island"}},
      ...
    ]}}

    Available filter layers: biophysics, conservation, cpg_sites, cpg_islands,
    ccre, chromatin_state, breakpoints, nonb_dna, repeats.
    Operators: 'overlaps', '>', '<', '>=', '<=', '==', '!=', 'between'.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region 'chr16:70000000-71000000'.
        filters: List of filter dicts with 'layer', 'op', and optionally 'field'/'value'.
        return_layers: Optional layer keys to annotate hits with.
        limit: Max results (default 1000, max 10000).
    """
    return await _post("/v1/query/intersect", {
        "build": build,
        "region": region,
        "filters": filters,
        "return_layers": return_layers,
        "limit": limit,
    })


@mcp.tool()
async def evaluate_design(
    sequence: str,
    name: str = "unnamed",
    analysis: str = "full",
    salt_mm: float = 1000.0,
    window_size: int = 100,
) -> dict:
    """Evaluate the biophysical properties of any DNA sequence (physics linter).

    Takes a raw DNA sequence (10-100,000 bp, NOT a genomic coordinate) and returns
    a structured biophysical assessment. This is the recommended starting point
    for evaluating synthetic constructs, promoters, or any designed DNA.

    Returns:
    - summary: GC content, CpG count/density, melting temp, mean stacking dG37
    - cpg_islands: detected CpG islands (Gardiner-Garden & Frommer criteria)
    - thermodynamics: stacking energy statistics + windowed profiles
    - extinction: UV absorbance at 260 nm (for concentration measurements)
    - structural: A/Z-form propensity, groove geometry
    - flags: actionable warnings and info (CpG islands, homopolymers, repeats, instability)
    - flag_counts: {"warning": N, "info": M}

    Example output (truncated):
    {"summary": {"length_bp": 4521, "gc_content": 0.523, "cpg_island_count": 1,
      "mean_stacking_dG37_kcal": -1.42, "melting_temp_estimate_C": 84.2},
     "cpg_islands": [{"start": 1200, "end": 1850, "gc": 0.67, "obs_exp_cpg": 0.82}],
     "thermodynamics": {"stacking_dG37": {"mean": -1.42, "sd": 0.31, "min": -2.17, "max": -0.58}},
     "flags": [{"type": "warning", "code": "CPG_ISLAND", "region": "1200-1850",
       "message": "CpG island detected — susceptible to methylation-mediated silencing"}],
     "flag_counts": {"warning": 1, "info": 2}}

    Flag codes: CPG_ISLAND (warning), LOW_STABILITY (info), HIGH_STABILITY (info),
    HIGH_GC (info), LOW_GC (info), Z_FORM_PRONE (warning), HOMOPOLYMER (warning),
    DINUC_REPEAT (warning).

    Does NOT use genomic coordinates — works on any arbitrary sequence.
    For genomic regions, use compute_region_biophysics instead.

    Args:
        sequence: DNA sequence (ACGT, Ns tolerated). 10-100,000 bp.
        name: Label for this sequence.
        analysis: 'full' (default), 'thermodynamic', or 'structural'.
        salt_mm: NaCl in mM (1000=standard, 150=physiological).
        window_size: Window size in bp for windowed profiles (default 100).
    """
    data = await _post("/v1/evaluate", {
        "sequence": sequence,
        "name": name,
        "analysis": analysis,
        "salt_mm": salt_mm,
        "window_size": window_size,
    })
    return _with_summary(data, _summarize_evaluate(data))


@mcp.tool()
async def compare_sequences(
    sequences: dict[str, str],
    analysis: str = "full",
    salt_mm: float = 1000.0,
    window_size: int = 100,
) -> dict:
    """Compare biophysical properties of multiple DNA sequences side-by-side.

    Accepts 2-10 named sequences. Returns per-sequence evaluations plus a
    delta table comparing each against the first (reference) sequence.

    Use this when comparing codon-optimized variants, promoter candidates,
    or assessing the biophysical impact of mutations.

    Example output (truncated):
    {"reference": "wildtype",
     "comparison": {
       "wildtype":  {"gc_content": 0.52, "cpg_island_count": 1, "flag_count": 3},
       "optimized": {"gc_content": 0.48, "cpg_island_count": 0, "flag_count": 1}
     },
     "deltas_vs_reference": {
       "optimized": {"delta_gc": -0.04, "delta_cpg_islands": -1,
                     "flags_added": [], "flags_removed": ["CPG_ISLAND at 1200-1850"]}
     }}

    Key output fields:
    - comparison{}: side-by-side metrics per sequence
    - deltas_vs_reference{}: changes relative to first sequence
    - flags_added/flags_removed: new or resolved biophysical issues

    Does NOT align sequences — it evaluates each independently and compares metrics.

    Args:
        sequences: Dict mapping names to DNA sequences. First entry = reference.
                   Example: {"wildtype": "ATGCGA...", "v1": "ATGCGA..."}
        analysis: 'full' (default), 'thermodynamic', or 'structural'.
        salt_mm: NaCl in mM (1000=standard, 150=physiological).
        window_size: Window size in bp for profiles (default 100).
    """
    return await _post("/v1/compare", {
        "sequences": sequences,
        "analysis": analysis,
        "salt_mm": salt_mm,
        "window_size": window_size,
    })


@mcp.tool()
async def validate_layer(
    layer_key: str | None = None,
    build: str = "hg38",
) -> dict:
    """Run validation checks on a data layer.

    Checks row counts, value ranges, and null fractions against per-layer
    specifications. Omit layer_key to validate all layers.

    Returns pass/fail for each check with summary counts.
    """
    params: dict = {"build": build}
    if layer_key:
        params["layer_key"] = layer_key
    return await _get("/v1/reference/validation", params)


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
