# Polymer Genomics MCP Server

MCP server providing 70+ tools for querying the [Polymer Genomics](https://polymerbio.org) curated genomic reference database. Covers DNA biophysics, methylation probes, epigenetic clocks, gene expression/constraint, transposable elements, HLA alleles, and more — all on hg38/hg37.

## Quick Start

```bash
uvx polymer-genomics-mcp
```

Or install permanently:

```bash
uv tool install polymer-genomics-mcp
polymer-genomics-mcp
```

## Claude Code / Claude Desktop

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "polymer-genomics": {
      "command": "uvx",
      "args": ["polymer-genomics-mcp"]
    }
  }
}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `POLYMER_API_BASE` | `https://api.polymerbio.org` | API endpoint |
| `POLYMER_API_KEY` | *(empty)* | API key (optional) |

For local development:

```json
{
  "mcpServers": {
    "polymer-genomics": {
      "command": "uvx",
      "args": ["polymer-genomics-mcp"],
      "env": {
        "POLYMER_API_BASE": "http://localhost:8000"
      }
    }
  }
}
```

## What's Inside

70+ tools organized by domain:

- **Gene lookup** — coordinates, exons, aliases, constraint, expression, pathways
- **Probe lookup** — Illumina 450K/EPIC/EPICv2 with CpG context and crossmap
- **Region queries** — any genomic interval with layer filtering and pagination
- **DNA biophysics** — stacking energy, curvature, groove geometry, form propensity
- **Sequence evaluation** — physics linter for synthetic construct design
- **Epigenetic clocks** — probe sets, clock-biophysics correlation
- **HLA** — allele lookup, expression correlation, noncoding divergence
- **Transposable elements** — family lookup, methylation, platform coverage
- **Cross-layer** — correlate and intersect any two annotation layers

All coordinates are 1-based closed. Responses include epistemic metadata (evidence class, provenance, version).

## Links

- **Live database**: [polymerbio.org](https://polymerbio.org)
- **API docs**: [api.polymerbio.org/docs](https://api.polymerbio.org/docs)
- **Python SDK**: `pip install polymer-genomics`
- **Source**: [github.com/beldez01/Polymer-Genomics-API](https://github.com/beldez01/Polymer-Genomics-API)
