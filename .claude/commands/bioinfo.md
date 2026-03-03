# Polymer Genomics — Bioinformatics Agent Context

You are now operating as an expert bioinformatician with full knowledge of the Polymer Genomics API.
Load this context before beginning any genomics analysis session.

---

## Coordinate System

- API is **1-based CLOSED**. `chr16:70699929-70700500` = 572 bp (both endpoints included).
- Internal DB is 0-based half-open (handled automatically — never manually shift coordinates).
- All API responses return 1-based closed coordinates. Trust them.

---

## GRanges Response Format

All region/gene/probe queries return GRanges-structured JSON:

```json
{
  "seqnames": ["chr16", "chr16", ...],
  "ranges": {
    "start": [70699929, ...],
    "end":   [70700500, ...]
  },
  "strand": ["+", "-", "*", ...],
  "mcols": {
    "gene_symbol":   ["VAC14", ...],
    "feature_type":  ["exon", "intron", "UTR", ...],
    "transcript_id": ["ENST...", ...]
  },
  "n": 42,
  "status": "complete"
}
```

- `start` and `end` are already 1-based closed.
- `mcols` keys vary by `layer_type` — always inspect before accessing.
- `n` = number of features returned.

---

## Truncation Recovery

If `status == "truncated"`, the query hit the row limit (default 1000, max 50000).

Recovery (in order):
1. Use `aggregate_region` with `resolution=1000` for an overview first.
2. Add `layers=` filter to reduce results per request.
3. Split into sub-regions and query each.
4. Use `bulk_download` for full layer data.

**Never report a truncated result as complete data.**

---

## Available Layers (hg38 and hg37)

| layer_key      | type       | Description                          |
|----------------|------------|--------------------------------------|
| gencode_v44    | gene_model | GENCODE v44 — 63K transcripts        |
| cpg_sites      | cpg        | 29M sites — islands/shores/shelves   |
| cpg_islands    | cpg        | 28K annotated CGIs                   |
| probe_epic_v2  | probe      | Illumina EPIC v2 array — 937K probes |
| probe_epic_v1  | probe      | EPIC v1 — 866K probes                |
| probe_450k     | probe      | 450K array — 486K probes             |
| isochores      | isochore   | GC composition structure — 10K segs  |

Use `list_layers(build)` to see current row counts and confirm availability.

---

## Tool Selection Guide

| Task | Primary Tool | Notes |
|------|-------------|-------|
| Find gene coordinates | `lookup_gene` | Returns exons, introns, UTRs by transcript |
| What data is available | `list_layers` | Filter by `layer_type` |
| All annotations in a region | `query_region` | Use `layers=` to filter |
| Probe by ID (cg/ch prefix) | `lookup_probe` | Returns chr, pos, gene, CpG context, crossmap |
| Multiple probes at once | `batch_probes` | Up to 10,000 per call |
| Density overview (large region) | `aggregate_region` | Use `resolution=10000` or `100000` |
| Gene symbol autocomplete | `search` | Prefix match, min 2 chars |
| Raw DNA sequence | `get_sequence` | Max 100,000 bp |
| Full layer data download | `bulk_download` | Returns presigned S3 URL (1-hour TTL) |

---

## Tool Composition Patterns

### Pattern: Analyze a gene locus
```
1. search(query=symbol)                    → verify gene exists, get canonical symbol
2. lookup_gene(symbol)                     → get coordinates and transcript structure
3. query_region(region=gene_bounds,
     layers="cpg_sites,probe_epic_v2")     → overlapping features
4. aggregate_region(region=expanded±50kb,
     resolution=1000)                      → density profile around locus
```

### Pattern: Probe-to-locus context
```
1. lookup_probe(probe_id)                  → get coordinates, gene, CpG context
2. query_region(region=probe±2kb,
     layers="gencode_v44,cpg_sites")       → surrounding annotation
3. get_sequence(region=probe±200bp)        → raw sequence for manual inspection
```

### Pattern: Large region → drill down
```
1. aggregate_region(region, resolution=100000)  → coarse density peaks
2. Identify subregions of interest from density
3. query_region(subregion, layers=...)          → fine-grained features
```

### Pattern: Cross-platform probe comparison
```
1. batch_probes(probe_ids=[...])           → coordinates + crossmap for all probes
2. Identify which probes overlap between platforms
3. query_region for each probe neighborhood if needed
```

---

## Common Errors and Recovery

| Error | Cause | Recovery |
|-------|-------|----------|
| `REGION_TOO_LARGE` | Region > 10 Mb | Split into sub-regions |
| `BUILD_MISMATCH` | Layer not available for this build | `list_layers` to confirm build support |
| `LAYER_NOT_FOUND` | `layer_key` not registered | `list_layers` to see valid keys |
| `status=truncated` | Row limit hit | See Truncation Recovery above |
| Probe not found | Wrong platform / ID format | Verify `cg`/`ch` prefix; check platform |

---

## R / Bioconductor Integration

Some analyses require R tools beyond what the API provides:
- Cell type deconvolution (minfi, FlowSorted.Blood.EPIC)
- Differential methylation (limma, missMethyl)
- IDAT-level QC (minfi, ewastools)
- Bioconductor annotation packages (TxDb, org.Hs.eg.db)

**For R tasks in Claude Code:** use the Bash tool to run Rscript.

```bash
Rscript /path/to/script.R --args param1 param2
```

**Complementary roles:**
- **API**: reference lookups, coordinate queries, region annotation, probe metadata
- **R**: statistical testing, normalization, cell deconvolution, IDAT processing
- **Combine**: query API for probe coordinates → run R analysis → query API for locus context

---

## Viewer

The viewer at **polymerbio.org** is a live, interactive genome browser.
- Direct link format: `https://polymerbio.org/view/hg38/chr7:117548628-117548880`
- Gene detail pages: `https://polymerbio.org/gene/hg38/BRCA1`
- Atlas (chromosome overview): `https://polymerbio.org/atlas`
- Shareable URLs include `?layers=` query param with active layers

---

## Reproducibility

Every API response includes:
- `layers_resolved[].content_hash` — SHA-256 of layer data at query time
- `layers_resolved[].version` — semantic version of the layer

Include these in any analysis for full reproducibility.
