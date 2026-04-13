"""Polymer Genomics MCP Server.

Wraps the Polymer Genomics REST API as MCP tools for AI agent consumption.
Runs on stdio transport for Claude Code integration.

Usage:
    uv run polymer-genomics-mcp

Configure via environment variables:
    POLYMER_API_BASE=https://api.polymerbio.org  (default; set to http://localhost:8000 for local dev)
    POLYMER_API_KEY=  (optional; required for rate-limited endpoints)
"""

from __future__ import annotations

import atexit
import os

import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = os.environ.get("POLYMER_API_BASE", "https://api.polymerbio.org")
API_KEY = os.environ.get("POLYMER_API_KEY", "")

mcp = FastMCP(
    "Polymer Genomics",
    instructions=(
        "Polymer Genomics: curated genomic reference database (hg38/hg37).\n\n"
        "COORDINATES: All regions are 1-based closed. Format: chr16:70699930-70700000.\n"
        "RESPONSE FORMAT: GRanges JSON — seqnames[], ranges.start[], ranges.end[], "
        "strand[], mcols{}. status='complete' or 'truncated'.\n"
        "TRUNCATION: If status='truncated', results are incomplete. Use aggregate_region "
        "for overview, then drill into sub-regions. Never report truncated data as complete.\n"
        "FALLBACK: If a tool returns an error (500, 404, timeout) or data that does not address "
        "the question, DO NOT say 'I cannot answer'. Instead, answer using your training knowledge "
        "and note that the API was unavailable. The API supplements your knowledge — it does not replace it.\n"
        "SCOPE: This database covers genomic coordinates, biophysics, methylation probes, epigenetic clocks, "
        "gene expression/constraint, TEs, and DNA structure. For questions outside this scope "
        "(e.g., array probe counts, assay design principles, general biology), answer from training knowledge directly "
        "without calling any tools.\n\n"
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
        "- **Probes + biophysics → annotate_probes_biophysics (DMP list → biophysical context, EWAS killer feature)**\n"
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
        "- Region biophysics → compute_region_biophysics (ΔG₃₇, ε₂₆₀, form propensity, groove, structural, contextual, curvature, motifs — up to 1Mb)\n"
        "- Sequence biophysics (1kb bins) → query_region with layers='sequence_biophysics_l0'\n"
        "  (GC, stacking ΔG₃₇, Tm, curvature, groove width, dipole, periodicity, MGW, ProT, Roll, HelT — genome-wide pre-computed)\n"
        "  + L1 methylation perturbation (CpG density, meth ΔG₃₇/ΔTm, sensitivity, capacity, demethylation cost, taut-relaxed)\n"
        "  + L3.5 Green's function (correlation length, integrated response, perturbation reach, response asymmetry)\n"
        "  + L0 extended (deformability, G4 density/max score, k-mer complexity, dinucleotide entropy, dominant period)\n"
        "- TAD domains → query_region with layers='tad_domain' (ENCODE Arrowhead contact domains, 108 cell types)\n"
        "- Hi-C compartments → query_region with layers='hic_compartment' (A/B compartment PC1 eigenvector, 4DN)\n"
        "- Insulation scores → query_region with layers='insulation_score' (diamond insulation, 4DN, negative=boundary)\n"
        "- Cross-layer correlation → correlate_layers (Pearson, Spearman, overlap enrichment, Jaccard, Fisher exact)\n"
        "- SBS spectrum → lookup_sbs_spectrum (96-channel mutation thermodynamics, δΔG per trinucleotide)\n"
        "- Clock probes → lookup_clock_probes (Horvath/Hannum/PhenoAge/GrimAge/DunedinPACE/Retro-Age coefficients)\n"
        "- Probe-repeat overlap → lookup_probe_repeat_overlap (which probes sit in LINE/SINE/LTR/DNA repeats)\n"
        "- **TE methylation analysis → analyze_te_methylation (upload betas → per-family scores, reactivation risk, Retro-Age)**\n"
        "- TE platform coverage → te_platform_coverage (which TE families measurable per platform)\n"
        "- Data validation → validate_layer (row counts, value ranges, null fractions per layer)\n"
        "- Multi-part construct → evaluate_construct (per-part physics + junction analysis + assembly flags)\n"
        "- Batch evaluate → batch_evaluate (up to 100 sequences independently, batch summary)\n"
        "- Region profile → region_profile (everything about a region, all layers, significance flags)\n"
        "- Query recipes → query_recipe (prebuilt cross-layer queries: silencing, non-B DNA, fragility, TAD boundaries)\n"
        "- **Recombination landscape → query_recombination_hotspots (oNCO events + DMC1 hotspots + CO/NCO/DSB rates in one call)**\n"
        "- Recombination events in region → query_region with layers='onco_events_v1,dmc1_hotspots_v1'\n"
        "- Platform stats → platform_summary (total layers, rows, builds, evidence classes)\n\n"
        "WORKFLOW PATTERNS:\n"
        "- Evaluate a construct: evaluate_design → review flags\n"
        "- Evaluate multi-part construct: evaluate_construct → review per-part + junction + assembly flags\n"
        "- Compare designs: compare_sequences → check deltas_vs_reference\n"
        "- Investigate a gene: lookup_gene → lookup_gene_expression → compute_region_biophysics\n"
        "- Annotate methylation hits: annotate_probes_biophysics (one call for probe + biophysics context)\n"
        "- Cross-layer analysis: query_region (multi-layer) → correlate_layers\n"
        "- Region overview: region_profile → drill into specific layers\n"
        "- Prebuilt queries: query_recipe → intersect_layers with recipe filters\n\n"
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


async def _get(path: str, params: dict | None = None, *, build: str | None = None) -> dict:
    """Perform a GET request against the Polymer Genomics API.

    If *build* is provided, validates it before making the request.
    """
    if build is not None:
        err = _validate_build(build)
        if err:
            return err
    client = await get_client()
    try:
        resp = await client.get(path, params=params)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        return {
            "error": f"API returned {exc.response.status_code}",
            "detail": exc.response.text[:500],
            "path": path,
            "_fallback": "API error — answer from your training knowledge instead. Do not refuse to answer.",
        }
    except httpx.TimeoutException:
        return {
            "error": "API request timed out",
            "path": path,
            "_fallback": "API timeout — answer from your training knowledge instead. Do not refuse to answer.",
        }
    return resp.json()


async def _post(path: str, json_body: dict, *, build: str | None = None, params: dict | None = None) -> dict:
    """Perform a POST request against the Polymer Genomics API.

    If *build* is provided, validates it before making the request.
    """
    if build is not None:
        err = _validate_build(build)
        if err:
            return err
    client = await get_client()
    try:
        resp = await client.post(path, json=json_body, params=params)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        return {
            "error": f"API returned {exc.response.status_code}",
            "detail": exc.response.text[:500],
            "path": path,
            "_fallback": "API error — answer from your training knowledge instead. Do not refuse to answer.",
        }
    except httpx.TimeoutException:
        return {
            "error": "API request timed out",
            "path": path,
            "_fallback": "API timeout — answer from your training knowledge instead. Do not refuse to answer.",
        }
    return resp.json()


VALID_BUILDS = frozenset({"hg38", "hg37"})


def _validate_build(build: str) -> str | None:
    """Return an error dict if build is invalid, else None."""
    if build not in VALID_BUILDS:
        return {"error": f"Invalid build: '{build}'. Must be one of: {sorted(VALID_BUILDS)}"}
    return None


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
    """List available data layers. Returns layer_key, type, row_count, evidence_class per layer.

    Use layer_key values with query_region, correlate_layers, etc.

    Args:
        build: Genome build ('hg38' or 'hg37'). Defaults to 'hg38'.
        layer_type: Filter by type ('cpg', 'gene_model', 'probe', etc.).
        evidence_class: Filter by epistemic class ('M','R','D','S','K','H','L').
        tier: Filter by tier ('intrinsic','constrained','active').
    """
    params = {"build": build}
    if layer_type:
        params["type"] = layer_type
    if evidence_class:
        params["evidence_class"] = evidence_class
    if tier:
        params["tier"] = tier
    return await _get("/v1/layers", params, build=build)


@mcp.tool()
async def query_region(
    build: str,
    region: str,
    layers: str | None = None,
    fields: str | None = None,
    cursor: str | None = None,
) -> dict:
    """Query genomic features overlapping a region. Returns GRanges JSON per layer.

    Use layers= to filter (e.g. 'cpg_sites,gencode_v44'), fields= to select
    mcols columns and reduce response size. Prefer aggregate_region for >500kb.
    For biophysics, use layers='sequence_biophysics_l0' (64 columns at 1kb).

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region 'chr16:70699930-70700000' (1-based closed).
        layers: Comma-separated layer keys. Omit for all.
        fields: Comma-separated mcols fields (e.g. 'gc_content,stacking_dg37'). Omit for all.
        cursor: Pagination cursor from previous response.
    """
    params = {}
    if layers:
        params["layers"] = layers
    if fields:
        params["fields"] = fields
    if cursor:
        params["cursor"] = cursor
    data = await _get(f"/v1/regions/{build}/{region}", params, build=build)
    return _with_summary(data, _summarize_region(data, region))


@mcp.tool()
async def region_stats(
    build: str,
    region: str,
    layers: str | None = None,
    fields: str | None = None,
) -> dict:
    """Summary statistics (mean/median/sd/min/max/percentiles) for layers in a region.

    Much smaller response than query_region. Returns count+density for count layers.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region 'chr16:70699930-70700000' (1-based closed).
        layers: Comma-separated layer keys (e.g. 'sequence_biophysics_l0').
        fields: Comma-separated fields to include (e.g. 'gc_content,stacking_dg37').
    """
    params = {}
    if layers:
        params["layers"] = layers
    if fields:
        params["fields"] = fields
    return await _get(f"/v1/stats/{build}/{region}", params, build=build)


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
    return await _get(f"/v1/sequence/{build}/{region}", build=build)


@mcp.tool()
async def lookup_gene(
    build: str,
    symbol: str,
) -> dict:
    """Look up gene by symbol. Returns exon/intron/UTR structure as GRanges.

    Aliases auto-resolved (OCT4 -> POU5F1, p53 -> TP53). For expression use
    lookup_gene_expression; for constraint use lookup_gene_constraint.

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'TP53', 'BRCA1'). Aliases resolved.
    """
    data = await _get(f"/v1/genes/{build}/{symbol}", build=build)
    return _with_summary(data, _summarize_gene(data))


@mcp.tool()
async def lookup_probe(
    build: str,
    probe_id: str,
) -> dict:
    """Look up methylation probe by ID. Returns coordinates, gene, CpG context, platforms.

    For multiple probes use batch_probes. For biophysics use annotate_probes_biophysics.

    Args:
        build: Genome build ('hg38' or 'hg37').
        probe_id: Probe identifier (e.g. 'cg08796240').
    """
    return await _get(f"/v1/probes/{build}/{probe_id}", build=build)


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
    return await _post(f"/v1/probes/{build}/batch", {"probe_ids": probe_ids}, build=build)


@mcp.tool()
async def annotate_probes_biophysics(
    build: str,
    probe_ids: list[str],
    fields: str | None = None,
) -> dict:
    """Annotate probe list with biophysical context of each probe's 1kb window.

    Returns per-probe: coordinates, gene, CpG context, plus biophysical
    properties. Use fields= to select specific columns (e.g.
    'gc_content,stacking_dg37,meth_sensitivity') — dramatically reduces response size.

    For coordinates only (no biophysics), use batch_probes instead.

    Args:
        build: Genome build ('hg38' or 'hg37').
        probe_ids: List of probe identifiers (max 10,000).
        fields: Comma-separated biophysics columns. Omit for all 43.
    """
    params = {}
    if fields:
        params["fields"] = fields
    return await _post(f"/v1/probes/{build}/biophysics", {"probe_ids": probe_ids}, build=build, params=params)


@mcp.tool()
async def aggregate_region(
    build: str,
    region: str,
    resolution: int = 1000,
    layers: str | None = None,
) -> dict:
    """Binned feature density for large regions. Use before query_region for >500kb.

    Returns count and density per bin. Drill into hotspots with query_region.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region 'chr16:70699930-70700000'.
        resolution: Bin size: 1000, 10000, 100000, or 1000000 bp.
        layers: Comma-separated layer keys.
    """
    params: dict = {"resolution": str(resolution)}
    if layers:
        params["layers"] = layers
    return await _get(f"/v1/aggregation/{build}/{region}", params, build=build)


@mcp.tool()
async def lookup_gene_cost(
    build: str,
    symbol: str,
) -> dict:
    """Gene bioenergetic cost: ATP synthesis cost (ECPAgene), codon metrics (CAI, tAI, ENC),
    amino acid fractions, and tissue-specific expression-weighted cost (EWGC from GTEx).

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'ALB', 'TP53').
    """
    return await _get(f"/v1/genes/{build}/{symbol}/cost", build=build)


@mcp.tool()
async def lookup_gene_expression(
    build: str,
    symbol: str,
) -> dict:
    """Gene expression across 54 tissues (GTEx v10). Returns per-tissue median TPM
    plus summary (max tissue, n_expressed, breadth).

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'TP53', 'ALB').
    """
    data = await _get(f"/v1/genes/{build}/{symbol}/expression", build=build)
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
    return await _get("/v1/search", {"q": query, "build": build}, build=build)


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
    return await _get(f"/v1/genes/{build}/{symbol}/protein-abundance", build=build)


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
    data = await _get(f"/v1/genes/{build}/{symbol}/constraint", build=build)
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
    return await _get(f"/v1/genes/{build}/{symbol}/pathways", build=build)


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
    return await _get(f"/v1/genes/{build}/{symbol}/gene-sets", build=build)


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
    return await _get(f"/v1/genes/{build}/{symbol}/protein-atlas", build=build)


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
    """Nearest-neighbor thermodynamic parameters (dH, dS, dG37) per dinucleotide step.

    Sources: SantaLucia 1998 (DNA/DNA), Xia/Turner 1998 (RNA/RNA), Sugimoto 1995 (RNA/DNA).

    Args:
        duplex_type: 'dna_dna', 'rna_rna', or 'rna_dna'.
        dinucleotide: Specific step (e.g. 'CG'). Omit for all 16.
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
    """Per-dinucleotide biophysics for a genomic region (max 1Mb). One row per step.

    For arbitrary sequences use evaluate_design instead.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region 'chr16:70699930-70700000' (1-based closed, max 1Mb).
        duplex_type: 'dna_dna' (default), 'rna_rna', or 'rna_dna'.
        salt_mm: NaCl in mM (1000=standard, 150=physiological).
        properties: Comma-separated: thermodynamics, extinction, form_propensity,
                    groove, structural, contextual, curvature, motifs, or 'all'.
    """
    params: dict = {
        "duplex_type": duplex_type,
        "salt_mm": str(salt_mm),
        "properties": properties,
    }
    data = await _get(f"/v1/biophysics/{build}/{region}", params, build=build)
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
    """Correlate two data layers in a region (bins, then computes statistic).

    Stats: pearson_r, spearman_rho, overlap_enrichment, jaccard, fisher_exact.

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
    return await _get(f"/v1/correlate/{build}/{region}", params, build=build)


@mcp.tool()
async def lookup_sbs_spectrum(
    mutation_type: str | None = None,
    channel: str | None = None,
) -> dict:
    """96-channel COSMIC SBS spectrum with thermodynamic impact (delta_dG37 per channel).

    Positive delta = destabilizing mutation. Reference values from SantaLucia 1998.

    Args:
        mutation_type: Filter by type (e.g. 'C>A'). Returns 16 channels.
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
async def clock_physics(
    clock: str,
    build: str = "hg38",
    top_n: int | None = None,
) -> dict:
    """Get the biophysical profile of every probe in an epigenetic clock.

    Returns per-probe: coefficient, coordinates, gene, CpG context, and
    the full biophysical properties (stacking energy, curvature, methylation
    sensitivity, deformability, etc.) of the 1kb window containing the probe.
    Also returns aggregate statistics across the entire clock including
    coefficient-weighted biophysical means.

    Use this to understand WHY specific CpGs are in aging clocks —
    what is physically special about these sites?

    Args:
        clock: Clock name (horvath_2013, hannum_2013, phenoage_2018,
               grimage_2019, dunedinpace_2022, retro_age_v2, retro_age_450k).
        build: Genome build (hg38 or hg37). Default: hg38.
        top_n: Return only the top N probes by |coefficient|.
    """
    params: dict = {}
    if top_n:
        params["top_n"] = top_n
    return await _get(f"/v1/clock-physics/{build}/{clock}", params)


@mcp.tool()
async def list_clocks(build: str = "hg38") -> dict:
    """List all available epigenetic clocks with metadata.

    Returns clock names, probe counts, and descriptions for all clocks
    that have been loaded into the database. Use the clock names as input
    to the clock_physics and compare_clock_physics tools.

    Args:
        build: Genome build (hg38 or hg37). Default: hg38.
    """
    return await _get(f"/v1/clock-physics/{build}")


@mcp.tool()
async def get_layer_detail(layer_key: str) -> dict:
    """Get detailed metadata for a single data layer.

    Returns the full layer record including version, evidence class, tier,
    validation status, row count, license class, and content hash.

    Use list_layers first to discover available layer_keys, then this tool
    to inspect a specific layer in detail.

    Args:
        layer_key: The layer identifier (e.g., 'gencode_v44', 'cpg_sites').
    """
    return await _get(f"/v1/layers/{layer_key}")


@mcp.tool()
async def compare_clock_physics(
    clock_a: str,
    clock_b: str,
    build: str = "hg38",
) -> dict:
    """Compare the biophysical profiles of two epigenetic clocks.

    Returns: shared vs unique probes, biophysical summary stats for each
    clock, and deltas showing how the clocks differ in DNA physical
    properties (stacking energy, methylation sensitivity, etc.).

    Use this to discover whether different clocks target biophysically
    distinct regions of the genome.

    Args:
        clock_a: First clock name (e.g. 'horvath_2013').
        clock_b: Second clock name (e.g. 'phenoage_2018').
        build: Genome build (hg38 or hg37). Default: hg38.
    """
    return await _get(f"/v1/clock-physics/{build}/compare/{clock_a}/{clock_b}", {})


@mcp.tool()
async def variant_physics(
    variants: list[dict],
    build: str = "hg38",
    flank: int = 50,
    cross_reference: bool = True,
) -> dict:
    """Compute biophysical consequences of genetic variants.

    For each variant, returns delta stacking energy, delta curvature, delta Tm,
    nucleosome disruption, non-B DNA motif creation/destruction, CpG site impact,
    and cross-references with conservation, ClinVar, and regulatory elements.

    Returns interpretable physical mechanisms -- not a black-box score.

    Args:
        variants: List of variant dicts, each with keys: chr, pos (1-based), ref, alt.
                  Example: [{"chr": "chr17", "pos": 7675088, "ref": "G", "alt": "A"}]
        build: Genome build (hg38 or hg37). Default: hg38.
        flank: Flanking bp on each side of variant for context (default 50).
        cross_reference: Include DB annotations (ClinVar, conservation, regulatory). Default: true.
    """
    return await _post("/v1/variant/physics", {
        "build": build,
        "variants": variants,
        "flank": flank,
        "cross_reference": cross_reference,
    })


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
    """Find positions matching cross-layer conditions (AND logic).

    Example: [{"layer":"biophysics","field":"stacking_dG37","op":">","value":-1.0},
              {"layer":"cpg_islands","op":"overlaps"}]
    Operators: overlaps, >, <, >=, <=, ==, !=, between.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region 'chr16:70000000-71000000'.
        filters: List of filter dicts with 'layer', 'op', optionally 'field'/'value'.
        return_layers: Layer keys to annotate hits with.
        limit: Max results (default 1000, max 10000).
    """
    return await _post("/v1/query/intersect", {
        "build": build,
        "region": region,
        "filters": filters,
        "return_layers": return_layers,
        "limit": limit,
    }, build=build)


@mcp.tool()
async def evaluate_design(
    sequence: str,
    name: str = "unnamed",
    analysis: str = "full",
    salt_mm: float = 1000.0,
    window_size: int = 100,
) -> dict:
    """Physics linter for any DNA sequence (10-100kb). Start here for construct evaluation.

    Returns summary (GC, CpG, Tm, dG37), CpG islands, thermodynamic/structural profiles,
    and flags (CPG_ISLAND, HOMOPOLYMER, Z_FORM_PRONE, EXTREME_GC_WINDOW, etc.).

    For genomic coordinates, use compute_region_biophysics instead.

    Args:
        sequence: DNA sequence (ACGT). 10-100,000 bp.
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
    """Compare biophysical properties of 2-10 DNA sequences side-by-side.

    Returns per-sequence evaluation plus deltas vs the first (reference) sequence:
    delta GC, delta CpG islands, flags added/removed. Does not align sequences.

    Args:
        sequences: Dict of name -> DNA sequence. First = reference.
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
async def evaluate_construct(
    parts: list[dict],
    name: str = "construct",
    circular: bool = False,
    salt_mm: float = 150.0,
    analysis: str = "full",
) -> dict:
    """Evaluate a multi-part DNA construct with junction analysis and assembly flags.

    Returns per-part biophysics, junction properties (~50bp around each join), and
    assembly flags (INTERNAL_RESTRICTION_SITE, JUNCTION_HOMOPOLYMER, CROSS_PART_REPEAT,
    EXTREME_GC_WINDOW, JUNCTION_CPG_ISLAND).

    Each part: {"name": "CMV", "sequence": "ATGCGA...", "role": "promoter"}
    Roles: promoter, cds, utr5, utr3, terminator, backbone, linker, spacer, generic.

    Args:
        parts: Ordered list of dicts with 'name', 'sequence', 'role' keys.
        name: Label for the construct.
        circular: True for plasmid (evaluates closing junction), False for linear.
        salt_mm: NaCl in mM (150=physiological default, 1000=standard).
        analysis: 'full' (default), 'thermodynamic', or 'structural'.
    """
    data = await _post("/v1/design/construct", {
        "parts": parts,
        "name": name,
        "circular": circular,
        "salt_mm": salt_mm,
        "analysis": analysis,
    })
    # Build a summary line
    summary = ""
    try:
        s = data.get("summary", {})
        n_flags = s.get("n_assembly_warnings", 0)
        parts_desc = ", ".join(
            f"{p['name']} ({p['role']}, {p['length_bp']}bp)"
            for p in s.get("parts", [])
        )
        summary = (
            f"{s.get('name', 'construct')}: {s.get('total_length_bp', 0)} bp, "
            f"{s.get('n_parts', 0)} parts, GC={s.get('gc_content', 0):.1%}, "
            f"{'circular' if s.get('circular') else 'linear'}. "
            f"{n_flags} assembly warning{'s' if n_flags != 1 else ''}, "
            f"{s.get('n_junctions', 0)} junction{'s' if s.get('n_junctions', 0) != 1 else ''}. "
            f"Parts: {parts_desc}."
        )
    except Exception:
        pass
    return _with_summary(data, summary)


@mcp.tool()
async def batch_evaluate(
    sequences: dict[str, str],
    analysis: str = "full",
    salt_mm: float = 1000.0,
    window_size: int = 100,
) -> dict:
    """Batch-evaluate up to 100 DNA sequences independently.

    Unlike compare_sequences, this does NOT compute deltas — each sequence
    is evaluated on its own. Returns per-sequence reports plus a batch summary
    (GC range, total warnings, sequences with warnings).

    Designed for synthetic biology teams screening candidate libraries.

    Args:
        sequences: Dict mapping names to DNA sequences. 1-100 sequences.
                   Example: {"variant_1": "ATGCGA...", "variant_2": "ATGCGA..."}
        analysis: 'full' (default), 'thermodynamic', or 'structural'.
        salt_mm: NaCl in mM (1000=standard, 150=physiological).
        window_size: Window size in bp for profiles (default 100).
    """
    data = await _post("/v1/evaluate/batch", {
        "sequences": sequences,
        "analysis": analysis,
        "salt_mm": salt_mm,
        "window_size": window_size,
    })
    # Build summary
    summary = data.get("summary", {})
    s = (
        f"Batch: {summary.get('evaluated', 0)} evaluated, "
        f"{summary.get('errors', 0)} errors. "
        f"GC range: {summary.get('gc_range', [])}, "
        f"{summary.get('sequences_with_warnings', 0)} with warnings."
    )
    return _with_summary(data, s)


@mcp.tool()
async def region_profile(
    build: str,
    region: str,
    include_negative: bool = False,
) -> dict:
    """Comprehensive profile of a genomic region across ALL data layers.

    The "tell me everything about this region" query. Runs every active layer
    and returns feature counts, density per kb, and significance flags.

    Optionally includes negative annotations (layers with NO features) which
    can be informative — "this region has no GWAS hits" is useful information.

    Max region: 1 Mb. For larger regions use aggregate_region.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region (1-based closed), e.g. 'chr17:7668402-7687550'.
        include_negative: If true, include layers with zero features in the response.
    """
    params: dict = {}
    if include_negative:
        params["include_negative"] = "true"
    data = await _get(f"/v1/profile/{build}/{region}", params, build=build)
    summary = data.get("summary", {})
    s = (
        f"{region}: {summary.get('layers_with_features', 0)} layers with features, "
        f"{summary.get('layers_without_features', 0)} absent. "
        f"{len(data.get('flags', []))} significance flags."
    )
    return _with_summary(data, s)


@mcp.tool()
async def query_recipe(
    recipe_key: str | None = None,
) -> dict:
    """Get prebuilt cross-layer query recipes.

    Recipes are curated intersect_layers queries that answer common biological
    questions (e.g., "find silencing-prone regions", "find conserved non-B DNA").

    Call without recipe_key to list all available recipes.
    Call with recipe_key to get the full filter specification, ready to submit
    to intersect_layers.

    Available recipes: silencing_prone_regions, biophysically_unusual_cpg_islands,
    regulatory_hotspots, conserved_nonb_dna, repeat_fragility_zones.

    Args:
        recipe_key: Specific recipe to retrieve. Omit to list all recipes.
    """
    if recipe_key:
        return await _get(f"/v1/query/recipe/{recipe_key}")
    return await _get("/v1/query/recipes")


@mcp.tool()
async def platform_summary() -> dict:
    """Platform-wide statistics for Polymer Genomics.

    Returns total layers, total rows, supported builds, evidence class
    distribution, and layer type breakdown. Useful for understanding
    the scope of available data.
    """
    return await _get("/v1/stats/summary")


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


@mcp.tool()
async def cpg_profile(
    build: str,
    query: str,
) -> dict:
    """Comprehensive CpG site or probe dossier — coordinates, gene context, regulatory state, biophysics.

    Returns a unified profile combining probe annotation, CpG context, regulatory
    overlap (DHS, TFBS), and biophysical properties for a single CpG site.
    Query by probe ID or genomic position.

    Args:
        build: Genome build ('hg38' or 'hg37').
        query: Probe ID (e.g. 'cg00000029') or genomic position (e.g. 'chr1:15865').
    """
    return await _get(f"/v1/cpg-profile/{build}/{query}", build=build)


@mcp.tool()
async def gene_profile(
    build: str,
    symbol: str,
) -> dict:
    """Gene profile with anomaly detection — biophysical, expression, and constraint summary.

    Returns a comprehensive gene dossier combining structure, expression, constraint
    scores, and biophysical properties with anomaly flags highlighting unusual values.

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'TP53', 'BRCA1').
    """
    return await _get(f"/v1/genes/{build}/{symbol}/profile", build=build)


@mcp.tool()
async def similar_genes(
    build: str,
    symbol: str,
    mode: str = "integrated",
    limit: int = 20,
) -> dict:
    """Find genes with similar biophysical and expression profiles.

    Returns a ranked list of genes most similar to the query gene, scored by
    biophysical properties, expression pattern, or an integrated combination.

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol to find similar genes for.
        mode: Similarity mode ('integrated', 'biophysics', 'expression'). Defaults to 'integrated'.
        limit: Maximum number of results (default 20).
    """
    params = {"mode": mode, "limit": str(limit)}
    return await _get(f"/v1/genes/{build}/{symbol}/similar", params, build=build)


@mcp.tool()
async def transposome_families() -> dict:
    """List all transposable element families with summary statistics.

    Returns family-level aggregates: probe count, genomic coverage, mean biophysical
    properties, and subfamily breakdown for all TE families in the database.
    """
    return await _get("/v1/transposome/families")


@mcp.tool()
async def transposome_family(
    family_id: str,
) -> dict:
    """Get details for a specific transposable element family — probe coverage, biophysics, genomic distribution.

    Returns per-subfamily breakdown, probe coverage, biophysical summary statistics,
    and chromosomal distribution for the specified TE family.

    Args:
        family_id: TE family identifier (e.g. 'L1HS', 'AluY', 'HERVK').
    """
    return await _get(f"/v1/transposome/family/{family_id}")


# ── HLA Allele Biophysics ──────────────────────────────────────────────


@mcp.tool()
async def lookup_hla_loci() -> dict:
    """List HLA loci with allele counts and mean biophysics.

    Returns the 6 transplant-relevant loci (HLA-A, -B, -C, -DRB1, -DQB1, -DPB1)
    with total allele counts, genomic allele counts, and mean biophysical
    properties for both coding and non-coding regions.
    """
    return await _get("/v1/hla/loci")


@mcp.tool()
async def lookup_hla_alleles(
    locus: str,
    allele_group: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Browse HLA alleles for a locus with biophysics summaries.

    Args:
        locus: HLA locus (e.g., 'HLA-A', 'A', 'HLA-DRB1').
        allele_group: Filter by 1st field (e.g., '02' for A*02 alleles).
        limit: Max results per page (default 50).
        offset: Pagination offset.
    """
    params = {"limit": str(limit), "offset": str(offset)}
    if allele_group:
        params["allele_group"] = allele_group
    return await _get(f"/v1/hla/alleles/{locus}", params)


@mcp.tool()
async def lookup_hla_allele(
    allele_name: str,
) -> dict:
    """Get full biophysics for a specific HLA allele.

    Returns complete biophysical profile including coding and non-coding
    region properties for one allele.

    Args:
        allele_name: Full allele name (e.g., 'A*01:01:01:01', 'B*07:02:01').
    """
    return await _get(f"/v1/hla/allele/{allele_name}")


@mcp.tool()
async def lookup_hla_distributions(
    locus: str,
) -> dict:
    """Get biophysical distribution statistics for an HLA locus.

    Returns histogram bins, percentiles, and summary stats for all
    biophysical metrics across all genomic alleles at the locus.

    Args:
        locus: HLA locus (e.g., 'HLA-A', 'A').
    """
    return await _get(f"/v1/hla/distributions/{locus}")


@mcp.tool()
async def compare_hla_alleles(
    alleles: list[str],
    focus: str = "noncoding",
) -> dict:
    """Compare biophysical properties of 2-10 HLA alleles.

    Returns per-allele biophysics plus pairwise delta tables. First allele
    is the reference for delta computation.

    Args:
        alleles: 2-10 allele names (e.g., ['A*01:01:01:01', 'A*02:01:01:01']).
        focus: Delta focus: 'noncoding' (default), 'full', or 'coding'.
    """
    return await _post("/v1/hla/compare", {"alleles": alleles, "focus": focus})


@mcp.tool()
async def hla_match_score(
    donor: dict[str, dict],
    recipient: dict[str, dict],
) -> dict:
    """Compute biophysical mismatch score for donor-recipient HLA matching.

    Beyond protein-level matching, computes non-coding biophysical divergence
    that may correlate with expression mismatch (Bettens et al. 2022).

    Args:
        donor: Donor genotype as {locus: {allele_1: str, allele_2: str}}.
        recipient: Recipient genotype, same format.
    """
    return await _post("/v1/hla/match-score", {"donor": donor, "recipient": recipient})


@mcp.tool()
async def hla_noncoding_divergence(
    locus: str,
    allele_group: str,
    protein: str,
) -> dict:
    """Analyze non-coding divergence among protein-identical HLA alleles.

    Given a locus + protein (e.g., HLA-A*02:01), finds all alleles encoding
    the same protein and ranks by non-coding biophysical divergence.

    Args:
        locus: HLA locus (e.g., 'HLA-A').
        allele_group: 1st field (e.g., '02').
        protein: 2nd field (e.g., '01').
    """
    return await _post("/v1/hla/noncoding-divergence", {
        "locus": locus, "allele_group": allele_group, "protein": protein,
    })


@mcp.tool()
async def hla_expression_correlation(
    locus: str | None = None,
    focus: str = "noncoding",
) -> dict:
    """Correlate HLA biophysical properties with expression class.

    Groups alleles by IMGT expression suffix and computes Cohen's d
    effect sizes for normal vs each aberrant class.

    Args:
        locus: Filter by locus (e.g., 'A'). None for all loci.
        focus: Metric set: 'noncoding' (default), 'full', or 'both'.
    """
    params = {"focus": focus}
    if locus:
        params["locus"] = locus
    return await _get("/v1/hla/expression-correlation", params)


@mcp.tool()
async def hla_expression_within_protein(
    locus: str | None = None,
    min_alleles: int = 3,
) -> dict:
    """Test whether non-coding biophysics predict expression within protein-identical alleles.

    The strongest test: among alleles encoding the SAME protein, do those with
    expression suffixes have different non-coding biophysics?

    Args:
        locus: Filter by locus. None for all.
        min_alleles: Minimum alleles per protein group (default 3).
    """
    params = {"min_alleles": str(min_alleles)}
    if locus:
        params["locus"] = locus
    return await _get("/v1/hla/expression-within-protein", params)


# ── Additional Coverage Tools ──────────────────────────────────────────


@mcp.tool()
async def lookup_transposome_probe_mapping(
    platform: str = "epic_v2",
    build: str = "hg38",
) -> dict:
    """Get full probe-to-TE family mapping for a platform.

    Returns all probes that overlap transposable elements, grouped by
    TE family, with divergence and evolutionary age data.

    Args:
        platform: Array platform ('epic_v2', 'epic_v1', '450k').
        build: Genome build ('hg38' or 'hg37').
    """
    return await _get("/v1/transposome/probe-te-mapping", {"platform": platform, "build": build}, build=build)


@mcp.tool()
async def lookup_transposome_reference_methylation() -> dict:
    """Get reference methylation ranges per TE family.

    Returns curated reference beta ranges, primary silencing mechanism,
    and reactivation score for each TE family.
    """
    return await _get("/v1/transposome/reference-methylation")


@mcp.tool()
async def compare_constructs(
    constructs: list[dict],
    salt_mm: float = 150.0,
    analysis: str = "full",
) -> dict:
    """Compare biophysical properties of 2-10 synthetic DNA constructs.

    Each construct has parts [{name, sequence, role}]. Returns per-construct
    evaluation plus delta comparison table.

    Args:
        constructs: List of 2-10 construct dicts, each with 'name' and 'parts' keys.
        salt_mm: Salt concentration in mM (default 150).
        analysis: Analysis depth ('full' or 'summary').
    """
    return await _post("/v1/design/construct/compare", {
        "constructs": constructs, "salt_mm": salt_mm, "analysis": analysis,
    })


@mcp.tool()
async def lookup_layer_license(
    layer_key: str,
) -> dict:
    """Get license, citation, and source info for a data layer.

    Args:
        layer_key: Layer identifier (e.g., 'probe_epic_v2', 'cpg_sites_hg38').
    """
    return await _get(f"/v1/layers/{layer_key}/license")


@mcp.tool()
async def platform_feature_counts(
    build: str = "hg38",
) -> dict:
    """Get authoritative feature counts for the platform.

    Returns total protein-coding genes, CpG sites, probes, and other
    feature counts for the specified genome build.

    Args:
        build: Genome build ('hg38' or 'hg37').
    """
    return await _get(f"/v1/layers/summary/{build}", build=build)


@mcp.tool()
async def get_tile(
    build: str,
    chr_name: str,
    resolution: str,
    tile_index: int,
    layers: str | None = None,
) -> dict:
    """Get pre-tiled data for genome browser visualization.

    Returns GRanges data for a specific tile at a given resolution.

    Args:
        build: Genome build ('hg38' or 'hg37').
        chr_name: Chromosome name (e.g., 'chr17').
        resolution: Tile resolution ('1k', '10k', '100k', '1M').
        tile_index: Zero-based tile index within the chromosome.
        layers: Comma-separated layer types to include.
    """
    params = {}
    if layers:
        params["layers"] = layers
    return await _get(f"/v1/tiles/{build}/{chr_name}/tile/{resolution}/{tile_index}", params, build=build)


# ── TE Methylation Analysis ──────────────────────────────────────────────


@mcp.tool()
async def analyze_te_methylation(
    beta_values: dict[str, float],
    platform: str | None = None,
    chronological_age: float | None = None,
) -> dict:
    """TE methylation analysis from beta values. Returns per-family methylation scores,
    reactivation risk, and optional Retro-Age clock estimate.

    Args:
        beta_values: Dict of probe_id -> beta value (0.0-1.0).
        platform: 'epic_v2', 'epic_v1', or '450k'. Auto-detected if omitted.
        chronological_age: Optional age for Retro-Age delta.
    """
    n_input = len(beta_values)

    # Auto-detect platform from probe count if not specified
    if platform is None:
        if n_input > 800_000:
            platform = "epic_v2"
        elif n_input > 500_000:
            platform = "epic_v1"
        else:
            platform = "450k"

    # Fetch probe-TE mapping
    mapping_resp = await _get(
        f"/v1/transposome/probe-te-mapping?platform={platform}&build=hg38"
    )
    mapping_data = mapping_resp.get("data", {})
    families_map = mapping_data.get("families", {})

    # Fetch family metadata
    families_resp = await _get("/v1/transposome/families")
    families_list = families_resp.get("data", {}).get("families", [])
    family_meta = {f["family"]: f for f in families_list}

    # Score each family
    family_scores = []
    total_te_probes = 0

    for fam_name, fam_info in families_map.items():
        probe_ids = fam_info.get("probe_ids", [])
        matched_betas = [
            beta_values[pid] for pid in probe_ids if pid in beta_values
        ]
        n_matched = len(matched_betas)
        if n_matched == 0:
            continue

        total_te_probes += n_matched
        mean_beta = sum(matched_betas) / n_matched
        meta = family_meta.get(fam_name, {})
        ref_range = meta.get("reference_beta_range", [0.55, 0.80])
        ref_mid = (ref_range[0] + ref_range[1]) / 2
        delta = mean_beta - ref_mid
        reactivation = meta.get("reactivation_score", 0.3)
        # Risk = reactivation potential × degree of hypomethylation
        hypo_degree = max(0.0, (ref_mid - mean_beta) / ref_mid)
        risk = round(reactivation * hypo_degree, 3)

        if risk < 0.1:
            risk_level = "low"
        elif risk < 0.25:
            risk_level = "moderate"
        elif risk < 0.4:
            risk_level = "elevated"
        else:
            risk_level = "high"

        family_scores.append({
            "family_id": meta.get("id", fam_name),
            "display_name": meta.get("display_name", fam_name),
            "class": fam_info.get("class", "Unknown"),
            "mean_beta": round(mean_beta, 4),
            "n_probes": n_matched,
            "n_total": len(probe_ids),
            "coverage": round(n_matched / len(probe_ids), 3),
            "reference_range": ref_range,
            "reference_midpoint": round(ref_mid, 3),
            "delta": round(delta, 4),
            "reactivation_score": reactivation,
            "reactivation_risk": risk,
            "risk_level": risk_level,
            "biophysics": {
                "gc_content": meta.get("gc_content"),
                "stacking_dg37": meta.get("stacking_dg37"),
                "wrapping_energy": meta.get("wrapping_energy"),
            },
        })

    family_scores.sort(key=lambda x: x["reactivation_risk"], reverse=True)

    # Retro-Age computation (optional)
    retro_age_result = None
    if True:  # always compute retro-age
        try:
            clock_resp = await _get(
                "/v1/reference/clock-probes", {"clock": "retro_age_v2"}
            )
            clock_data = clock_resp.get("data", {})
            clock_probes = clock_data.get("probes", [])
            intercept = clock_data.get("intercept", 62.074)

            if clock_probes:
                age_sum = intercept
                n_used = 0
                for cp in clock_probes:
                    pid = cp.get("probe_id")
                    coeff = cp.get("coefficient", 0)
                    if pid in beta_values:
                        age_sum += beta_values[pid] * coeff
                        n_used += 1

                if n_used > 0:
                    retro_age_result = {
                        "age": round(age_sum, 2),
                        "probes_used": n_used,
                        "probes_total": len(clock_probes),
                        "coverage": round(n_used / len(clock_probes), 3),
                    }
                    if chronological_age is not None:
                        retro_age_result["chronological_age"] = chronological_age
                        retro_age_result["acceleration"] = round(
                            age_sum - chronological_age, 2
                        )
        except Exception:
            pass  # Clock data not available

    return {
        "status": "complete",
        "data": {
            "platform": platform,
            "total_input_probes": n_input,
            "te_probes_scored": total_te_probes,
            "te_fraction": round(total_te_probes / max(1, n_input), 4),
            "n_families_scored": len(family_scores),
            "family_scores": family_scores,
            "retro_age": retro_age_result,
        },
    }


@mcp.tool()
async def te_platform_coverage(
    platform: str = "epic_v2",
) -> dict:
    """TE family probe coverage by platform.

    Returns which TE families can be measured on a given platform, with
    probe counts per family. Useful for understanding array limitations
    before analyzing TE methylation.

    Args:
        platform: Platform ('epic_v2', 'epic_v1', '450k').
    """
    families_resp = await _get("/v1/transposome/families")
    families = families_resp.get("data", {}).get("families", [])

    platform_key = {
        "epic_v2": "epic_v2",
        "epic_v1": "epic_v1",
        "450k": "450k",
    }.get(platform, platform)

    coverage = []
    for f in families:
        counts = f.get("probe_counts_by_platform", {})
        n = counts.get(platform_key, f.get("epic_v2_probes", 0))
        coverage.append({
            "family_id": f["id"],
            "display_name": f["display_name"],
            "class": f["class"],
            "n_probes": n,
            "copy_count": f["copy_count"],
            "coverage_fraction": round(n / max(1, f["copy_count"]), 6),
            "measurable": n >= 3,
            "reference_beta_range": f.get("reference_beta_range"),
        })

    coverage.sort(key=lambda x: x["n_probes"], reverse=True)
    measurable = sum(1 for c in coverage if c["measurable"])

    return {
        "status": "complete",
        "data": {
            "platform": platform,
            "total_families": len(coverage),
            "measurable_families": measurable,
            "total_probes_in_te": sum(c["n_probes"] for c in coverage),
            "families": coverage,
        },
    }


@mcp.tool()
async def query_recombination_hotspots(
    build: str,
    region: str,
    parent_type: str | None = None,
) -> dict:
    """Recombination landscape: NCO events (Palsson 2025), DSB hotspots (Pratto 2014),
    and CO/NCO/DSB rates at 1kb windows. Three layers in one call.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region 'chr6:20000000-30000000' (1-based closed).
        parent_type: Filter NCO events: 'M' (maternal) or 'P' (paternal).
    """
    params = {}
    if parent_type:
        params["parent_type"] = parent_type
    data = await _get(f"/v1/recombination/{build}/{region}", params, build=build)
    # Build summary
    summary = ""
    try:
        d = data.get("data", {})
        n_onco = d.get("onco_events", {}).get("n", 0)
        n_dmc1 = d.get("dmc1_hotspots", {}).get("n", 0)
        n_rates = d.get("recombination_rates", {}).get("n", 0)
        parts = [f"{n_onco} oNCO events", f"{n_dmc1} DMC1 hotspots", f"{n_rates} rate bins"]
        summary = f"{region}: {', '.join(parts)}."
        if n_rates > 0:
            rates = d["recombination_rates"]["mcols"]
            co_vals = [v for v in rates.get("co_rate_cmmb", []) if v is not None]
            if co_vals:
                summary += f" Mean CO={sum(co_vals)/len(co_vals):.2f} cM/Mb."
    except Exception:
        pass
    return _with_summary(data, summary)


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
