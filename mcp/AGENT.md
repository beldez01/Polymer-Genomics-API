# Polymer Genomics MCP — Agent Context

Curated genomic reference database (hg38/hg37): gene models, CpG sites, methylation array probes, isochores, methylation atlases, bioenergetics, and raw DNA sequence. All data is pre-indexed for millisecond-latency queries.

## Coordinate System

- **1-based closed.** `chr16:70699929-70700500` = 572 bp (both endpoints included).
- Region format: `chr16:70699930-70700000`
- Internal DB handles coordinate translation — never manually shift.

## Response Format

All region/gene/probe queries return GRanges-structured JSON:

```json
{
  "seqnames": ["chr16", ...],
  "ranges": { "start": [70699929, ...], "end": [70700500, ...] },
  "strand": ["+", "-", "*", ...],
  "mcols": { "gene_symbol": ["VAC14", ...], "feature_type": ["exon", ...] },
  "n": 42,
  "status": "complete"
}
```

- `mcols` keys vary by layer — inspect before accessing.
- `status` is `complete` or `truncated`.

## Truncation Recovery

If `status == "truncated"`, results are **incomplete**. Never report truncated data as complete.

1. Use `aggregate_region` with coarse resolution for overview first.
2. Add `layers=` filter to reduce results per request.
3. Split into sub-regions and query each.
4. Use `bulk_download` for full layer data.

## Tool Selection

| Task | Tool | Notes |
|------|------|-------|
| Gene coordinates/structure | `lookup_gene` | Exons, introns, UTRs by transcript |
| Probe by ID | `lookup_probe` | Coordinates + CpG context + crossmap |
| Multiple probes | `batch_probes` | Up to 10,000; same fields as lookup_probe |
| All annotations in a region | `query_region` | Use `layers=` to filter |
| Large region overview | `aggregate_region` | Use BEFORE query_region for >500kb |
| Annotations near a gene | `query_proximity` | Gene symbol + radius in one call |
| Gene symbol search | `search` | Prefix match, min 2 chars |
| Raw DNA sequence | `get_sequence` | Max 100,000 bp |
| Available data layers | `list_layers` | Row counts, build support |
| Full layer download | `bulk_download` | Presigned URL, 1-hour TTL |
| Gene biosynthetic cost | `lookup_gene_cost` | Akashi-Gojobori + GTEx EWGC |
| Gene expression profile | `lookup_gene_expression` | GTEx v10, 54-tissue median TPM |
| Protein abundance | `lookup_protein_abundance` | PaxDb v6.0, tissue-specific PPM |
| Gene constraint | `lookup_gene_constraint` | gnomAD pLI, LOEUF, Z-scores |
| Gene pathways | `lookup_gene_pathways` | Reactome pathway memberships |
| Gene sets | `lookup_gene_sets` | MSigDB Hallmark (50 sets) |
| Protein atlas | `lookup_protein_atlas` | HPA tissue expression + subcellular |
| NN thermodynamics | `lookup_nn_parameters` | SantaLucia/Xia/Sugimoto ΔH, ΔS, ΔG₃₇ |
| Dinucleotide properties | `lookup_dinucleotide_properties` | ε₂₆₀, groove geometry, form propensity |
| Amino acid properties | `lookup_amino_acid_properties` | MW, volume, hydrophobicity, pKa, cost |
| Physical constants | `lookup_physical_constants` | Lp, Manning ξ, elastic moduli, rates |
| Region biophysics | `compute_region_biophysics` | ΔG₃₇, ε₂₆₀, form propensity, groove (max 10kb) |

## Composition Patterns

### Gene locus analysis
```
search(query=symbol) → lookup_gene(symbol) → query_region(gene±region, layers="cpg_sites,probe_epic_v2") → aggregate_region(gene±50kb, resolution=1000)
```

### Probe-to-locus context
```
lookup_probe(probe_id) → query_region(probe±2kb, layers="gencode_v44,cpg_sites") → get_sequence(probe±200bp)
```

### Large region drill-down
```
aggregate_region(region, resolution=100000) → identify density peaks → query_region(sub-region, layers=...)
```

### Cross-platform probe comparison
```
batch_probes(probe_ids) → identify platform overlaps → query_region(neighborhood) if needed
```

## Available Layers

| layer_key | type | Description |
|-----------|------|-------------|
| gencode_v44 | gene_model | GENCODE v44 — 63K transcripts |
| cpg_sites | cpg | 29M sites — islands/shores/shelves |
| cpg_islands | cpg | 28K annotated CGIs |
| probe_epic_v2 | probe | EPIC v2 — 937K probes |
| probe_epic_v1 | probe | EPIC v1 — 866K probes |
| probe_450k | probe | 450K array — 486K probes |
| isochores | isochore | GC composition — 10K segments |
| chromatin_state | chromatin | ChromHMM 18-state (9 cell types) |
| methylation_atlas | methylation | Loyfer 2023 — 39 cell/tissue types |
| sequence_biophysics_l0 | biophysics | GC, stacking ΔG₃₇, Tm, curvature, groove, dipole, periodicity (1kb bins) |

Use `list_layers(build)` to confirm current availability and row counts.

## R / Bioconductor Integration

The API provides **reference data**. Statistical analysis uses R:
- **API**: coordinate lookups, probe metadata, region annotation, sequence
- **R**: differential methylation (limma), cell deconvolution (minfi), IDAT QC, pathway analysis
- **Combine**: query API for coordinates → run R analysis → query API for locus context

## Common Errors

| Error | Recovery |
|-------|----------|
| `REGION_TOO_LARGE` | Split into sub-regions |
| `BUILD_MISMATCH` | Check `list_layers` for build support |
| `LAYER_NOT_FOUND` | Check `list_layers` for valid keys |
| `status=truncated` | See Truncation Recovery above |
| Probe not found | Verify cg/ch prefix; check platform with `list_layers` |

## Reproducibility

Every response includes `layers_resolved[].content_hash` (SHA-256) and `version`. Include these in analyses for full provenance.
