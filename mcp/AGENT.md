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
| sequence_biophysics_l0 | biophysics | Full material stack (43 columns, 1kb bins) — see sublayers below |

Use `list_layers(build)` to confirm current availability and row counts.

### Biophysics Sublayers (sequence_biophysics_l0)

All sublayers are returned together via `query_region` with `layers='sequence_biophysics_l0'`.

| Sublayer | Columns | Description |
|----------|---------|-------------|
| **L0 core** (7) | gc_content, stacking_dg37, melting_temp, curvature, groove_width, dipole_density, periodicity_power | Bare sequence thermodynamics + geometry |
| **L0 DNAshape** (8) | mgw_mean, prot_mean, roll_mean, helt_mean, delta_mgw, delta_prot, delta_roll, delta_helt | Minor groove width, propeller twist, roll, helix twist (mean + methylation delta) |
| **L0 melting** (3) | melting_cooperativity, bubble_propensity, melting_width | Melting domain properties |
| **L0 SBS** (4) | sbs_c_to_a_ddg, sbs_c_to_g_ddg, sbs_c_to_t_ddg, sbs_t_to_a_ddg | Single base substitution thermodynamic impact |
| **L0 extended** (6) | deformability, g4_density, g4_max_score, kmer_complexity, dinucleotide_entropy, dominant_period | Flexibility, G-quadruplex, sequence complexity |
| **L1 methylation** (10) | cpg_count, cpg_density, cpg_obs_exp, meth_delta_g, meth_delta_tm, meth_sensitivity, methylation_capacity, demethylation_cost, oxidation_depth, taut_relaxed | CpG landscape + methylation perturbation field |
| **L3.5 Green's fn** (4) | correlation_length, integrated_response, perturbation_reach, response_asymmetry | Mechanical connectivity / perturbation propagation |

**Total: 42 mcols + start_pos/end_pos = 44 fields per row.**

## Compute Tools (Methylation Pipeline)

PREREQUISITES: Local R installation with Bioconductor packages,
OR Docker container `polymerbio/methylation-toolkit`.

WORKFLOW: `load_idats` → `normalize` → `filter_probes` → `run_limma` → visualize.
Each step builds on previous. Session state persists on disk as .rds checkpoints.

| Task | Tool | Notes |
|------|------|-------|
| Load IDAT files | `load_idats` | Creates session; auto-detects 450K/EPIC/EPICv2 |
| Normalize | `normalize` | openSesame (EPICv2), funnorm (450K/EPIC) |
| Filter probes | `filter_probes` | Removes SNP, sex chr, cross-reactive, failed |
| Differential methylation | `run_limma` | limma eBayes on M-values; returns top DMPs |
| Get beta values | `get_betas` | Methylation levels 0–1; inline or CSV |
| Get M-values | `get_m_values` | Log2 ratio; inline or CSV |
| Volcano plot | `volcano_plot` | From DMP results; returns base64 PNG |
| Clustering heatmap | `cluster_probes` | Top variable probes; returns base64 PNG |
| Check progress | `session_status` | Which steps completed, files generated |
| Remove session | `cleanup_session_tool` | Deletes all session data |

### Composition Pattern — Full Methylation Analysis

```
load_idats(idat_dir)          → session_id
normalize(session_id)         → n_probes, method
filter_probes(session_id)     → n_before, n_after
run_limma(session_id, group)  → n_dmps, top_hits
volcano_plot(session_id)      → image_base64

# Then annotate hits with REFERENCE tools:
batch_probes(top_probe_ids)             → gene symbols, coordinates
lookup_gene_expression(gene)            → tissue context (GTEx)
compute_region_biophysics(hit_region)   → mechanistic interpretation
lookup_gene_pathways(gene)              → pathway memberships
```

### Without R Installed

If R is not available, compute tools return a helpful error with install
instructions. Reference tools (25+) work regardless — they hit polymerbio.org
over HTTP and need only Python.

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
