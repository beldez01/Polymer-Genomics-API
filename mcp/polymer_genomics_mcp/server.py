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
        "Query curated genomic reference data (hg37/hg38): gene models, CpG sites, "
        "probes, isochores, methylation atlases, and raw DNA sequence. "
        "All coordinates are 1-based closed. Regions use format chr16:70699930-70700000."
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
async def list_layers(build: str = "hg38", layer_type: str | None = None) -> dict:
    """List available genomic data layers.

    Returns metadata about registered annotation layers (gene models, CpG sites,
    probes, isochores, methylation atlases). Use this to discover what data is
    available before querying.

    Args:
        build: Genome build ('hg38' or 'hg37'). Defaults to 'hg38'.
        layer_type: Optional filter by type ('cpg', 'gene_model', 'probe', 'isochore', 'methylation').
    """
    params = {"build": build}
    if layer_type:
        params["type"] = layer_type
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

    Args:
        build: Genome build ('hg38' or 'hg37').
        symbol: Gene symbol (e.g. 'ALB', 'TP53', 'BRCA1').
    """
    return await _get(f"/v1/genes/{build}/{symbol}/cost")


@mcp.tool()
async def search(
    query: str,
    build: str = "hg38",
) -> dict:
    """Search for genes by symbol prefix.

    Returns matching gene symbols. Use this to find gene names before
    calling lookup_gene.

    Args:
        query: Search term (minimum 2 characters). Case-insensitive prefix match.
        build: Genome build ('hg38' or 'hg37').
    """
    return await _get("/v1/search", {"q": query, "build": build})


@mcp.tool()
async def bulk_download(
    layer_key: str,
) -> dict:
    """Get a presigned download URL for bulk layer data.

    Returns a temporary (1-hour) download URL for the full dataset of a layer.
    Useful for downloading complete probe manifests, CpG site lists, etc.

    Args:
        layer_key: Layer identifier (e.g. 'probe_epic_v2', 'cpg_sites').
    """
    return await _get(f"/v1/bulk/{layer_key}")


def main():
    """Entry point for the MCP server."""
    mcp.run()


if __name__ == "__main__":
    main()
