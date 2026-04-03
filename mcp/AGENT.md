# Polymer Genomics MCP — Agent Context

The first production database of genome-wide DNA biophysical properties. 41 curated layers on hg38/hg37, 44 MCP tools, anti-hallucination design.

## Anti-Hallucination Design

This API is built so AI agents never confuse measured data with predictions:

- **Evidence classes** on every layer: Measured (M), Curated (K), Derived (D), Statistical (S), Hypothetical (H)
- **Provenance** in every response: `api_version`, `data_version`, source database, license, content hash
- **Structured flags** — machine-parseable codes (e.g., `HOMOPOLYMER`, `SILENCING_RISK`), not free text
- **Truncation warnings** — `status: "truncated"` means results are INCOMPLETE. Never report truncated data as complete.
- **Negative annotations** — `region_profile` with `include_negative=true` tells you what ISN'T there

## Coordinate System

- **1-based closed.** `chr16:70699929-70700500` = 572 bp (both endpoints included).
- Region format: `chr16:70699930-70700000`
- Internal DB handles coordinate translation — never manually shift.

## Response Format

All region/gene/probe queries return GRanges-structured JSON:

```json
{
  "status": "complete",
  "api_version": "0.1.0",
  "data_version": "2026.03",
  "coordinate_system": "1-based_closed",
  "layers_resolved": [
    {"layer_key": "cpg_sites", "source": "UCSC CpG Islands",
     "source_license": "Free for non-commercial use",
     "evidence_class": "D", "content_hash": "sha256..."}
  ],
  "data": {
    "cpg_sites": {
      "seqnames": ["chr16"],
      "ranges": {"start": [70699929], "end": [70700500]},
      "strand": ["*"],
      "mcols": {"density": [0.082]},
      "n": 1
    }
  }
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

### Start Here
| Task | Tool |
|------|------|
| Evaluate a DNA sequence | `evaluate_design` |
| Compare multiple sequences | `compare_sequences` |
| Batch evaluate (up to 100) | `batch_evaluate` |
| Everything about a region | `region_profile` |

### Region & Layer Queries
| Task | Tool | Notes |
|------|------|-------|
| All annotations in a region | `query_region` | Use `layers=` to filter, `fields=` to select mcols |
| Region summary stats | `region_stats` | Mean/median/sd/percentiles, no individual rows |
| Large region overview | `aggregate_region` | Use BEFORE query_region for >500kb |
| Platform-wide stats | `platform_summary` | Total layers, rows, builds |

### Gene & Probe Queries
| Task | Tool | Notes |
|------|------|-------|
| Gene coordinates/structure | `lookup_gene` | Supports aliases: p53→TP53, OCT4→POU5F1 |
| Probe by ID | `lookup_probe` | Coordinates + CpG context + crossmap |
| Multiple probes | `batch_probes` | Up to 10,000 |
| Gene symbol search | `search` | Prefix match, min 2 chars |
| Annotations near a gene | `query_proximity` | Gene + radius, single call |

### Cross-Layer Analysis
| Task | Tool | Notes |
|------|------|-------|
| Correlate two layers | `correlate_layers` | Pearson, Spearman, overlap, Jaccard, Fisher |
| Boolean intersection | `intersect_layers` | Up to 10 filters with field-level conditions |
| Prebuilt query recipes | `query_recipe` | Silencing, non-B DNA, fragility, etc. |

### Biological Context
| Task | Tool |
|------|------|
| Gene expression (54 tissues) | `lookup_gene_expression` |
| Gene biosynthetic cost | `lookup_gene_cost` |
| Protein abundance | `lookup_protein_abundance` |
| Gene constraint (pLI, LOEUF) | `lookup_gene_constraint` |
| Gene pathways | `lookup_gene_pathways` |
| Gene sets (Hallmark) | `lookup_gene_sets` |
| Protein atlas | `lookup_protein_atlas` |

### Reference Data
| Task | Tool |
|------|------|
| NN thermodynamics | `lookup_nn_parameters` |
| Dinucleotide properties | `lookup_dinucleotide_properties` |
| Amino acid properties | `lookup_amino_acid_properties` |
| Physical constants | `lookup_physical_constants` |
| SBS mutation spectrum | `lookup_sbs_spectrum` |
| Epigenetic clock probes | `lookup_clock_probes` |
| Probe-repeat overlap | `lookup_probe_repeat_overlap` |
| Region biophysics (max 10kb) | `compute_region_biophysics` |
| Raw DNA sequence (max 100kb) | `get_sequence` |
| Layer list + metadata | `list_layers` |
| Full layer download | `bulk_download` |
| Layer validation | `validate_layer` |

## Composition Patterns

### Evaluate a construct
```
evaluate_design(sequence) → review flags
```

### Compare designs
```
compare_sequences(sequences) → check deltas_vs_reference
```

### Investigate a gene
```
lookup_gene(symbol) → lookup_gene_expression(symbol) → compute_region_biophysics(region)
```

### Region overview → drill down
```
region_profile(region) → query_region(region, layers=specific_layers)
```

### Prebuilt cross-layer query
```
query_recipe() → pick recipe → intersect_layers(region, filters=recipe.filters)
```

### Annotate methylation hits
```
batch_probes(probe_ids) → lookup_gene(symbol) → lookup_gene_expression(symbol)
```

### Full methylation pipeline
```
load_idats(dir) → normalize(session) → filter_probes(session) → run_limma(session, group)
→ volcano_plot(session) → batch_probes(top_hits) → lookup_gene_expression(gene)
```

## Available Layers (41 on hg38)

| layer_key | type | Description |
|-----------|------|-------------|
| gencode_v44 | gene_model | GENCODE v44 — 3M features, 63K transcripts |
| cpg_sites | cpg | 29.4M sites — islands/shores/shelves |
| cpg_islands | cpg | 28K annotated CGIs |
| probe_epic_v2 | probe | EPIC v2 — 937K probes |
| probe_epic_v1 | probe | EPIC v1 — 866K probes |
| probe_450k | probe | 450K array — 486K probes |
| isochores | isochore | GC composition — 10K segments |
| methylation_atlas | methylation | Loyfer 2023 — 866K features |
| phylop_phastcons_100way | conservation | PhyloP + PhastCons 100-way |
| encode_ccre_v4 | regulatory | ENCODE cCREs v4 |
| chromhmm_15state_v1 | chromatin_state | ChromHMM 15-state |
| histone_peaks_encode_v1 | histone_mark | ENCODE v3 ChIP-seq |
| gtex_v10 | expression | GTEx v10 — 54 tissues |
| gene_constraint_v1 | constraint | gnomAD v4 — pLI, LOEUF, Z-scores |
| reactome_pathways_v1 | pathway | Reactome pathways |
| msigdb_hallmark_v1 | gene_set | MSigDB Hallmark (50 sets) |
| protein_abundance_v1 | protein_abundance | PaxDb v6.0 |
| protein_atlas_v1 | protein_atlas | HPA v23 |
| gene_costs_v1 | gene_cost | Akashi-Gojobori + GTEx EWGC |
| repeatmasker_v1 | repeat | RepeatMasker — 5.3M elements |
| herv_loci_v1 | herv | Telescope — 14K proviral loci |
| nonb_dna | nonb_dna | G4, Z-DNA, cruciform — 2.9M features |
| fragility_composite | fragility | Composite fragility score — 2.9M |
| breakpoints | breakpoint | COSMIC SV breakpoints |
| gwas_catalog_ebi_v1 | gwas | EBI GWAS Catalog |
| sequence_biophysics_l0 | biophysics | **64 columns** — see sublayers below |

Use `list_layers(build)` to confirm current availability and row counts.

### Biophysics Sublayers (sequence_biophysics_l0)

All sublayers returned together via `query_region` with `layers='sequence_biophysics_l0'`.

| Sublayer | Columns | Description |
|----------|---------|-------------|
| **L0 core** (7) | gc_content, stacking_dg37, melting_temp, curvature, groove_width, dipole_density, periodicity_power | Bare sequence thermodynamics + geometry |
| **L0 DNAshape** (8) | mgw_mean, prot_mean, roll_mean, helt_mean, delta_mgw, delta_prot, delta_roll, delta_helt | Minor groove width, propeller twist, roll, helix twist |
| **L0 melting** (3) | melting_cooperativity, bubble_propensity, melting_width | Melting domain properties |
| **L0 SBS** (4) | sbs_c_to_a_ddg, sbs_c_to_g_ddg, sbs_c_to_t_ddg, sbs_t_to_a_ddg | Mutation thermodynamic impact |
| **L0 extended** (6) | deformability, g4_density, g4_max_score, kmer_complexity, dinucleotide_entropy, dominant_period | Flexibility, G4, complexity |
| **L1 methylation** (10) | cpg_count, cpg_density, cpg_obs_exp, meth_delta_g, meth_delta_tm, meth_sensitivity, methylation_capacity, demethylation_cost, oxidation_depth, taut_relaxed | CpG landscape + methylation perturbation |
| **L3.5 Green's fn** (4) | correlation_length, integrated_response, perturbation_reach, response_asymmetry | Mechanical connectivity |
| **Evolutionary physics** (5) | phylop_241way_mean, phastcons_241way_mean, b_score_mean, recomb_rate_cmmb, mutation_rate_mean | Conservation, selection, recombination |

## Compute Tools (Methylation Pipeline)

Requires local R + Bioconductor OR Docker `polymerbio/methylation-toolkit`.

WORKFLOW: `load_idats` → `normalize` → `filter_probes` → `run_limma` → visualize.
Then annotate hits with reference tools: `batch_probes`, `lookup_gene_expression`, `compute_region_biophysics`.

| Task | Tool | Notes |
|------|------|-------|
| Load IDAT files | `load_idats` | Creates session; auto-detects array type |
| Normalize | `normalize` | openSesame (EPICv2), funnorm (450K/EPIC) |
| Filter probes | `filter_probes` | SNP, sex chr, cross-reactive, failed |
| Differential methylation | `run_limma` | limma eBayes on M-values |
| Get beta values | `get_betas` | Methylation levels 0–1 |
| Get M-values | `get_m_values` | Log2 ratio for statistics |
| Volcano plot | `volcano_plot` | From DMP results; base64 PNG |
| Clustering heatmap | `cluster_probes` | Top variable probes; base64 PNG |
| Check progress | `session_status` | Which steps completed |
| Remove session | `cleanup_session_tool` | Deletes all session data |

## Common Errors

| Error | Recovery |
|-------|----------|
| `REGION_TOO_LARGE` | Use `region_profile` (1 Mb max) or `aggregate_region`, then drill down |
| `BUILD_MISMATCH` | Check `list_layers` for build support |
| `LAYER_NOT_FOUND` | Check `list_layers` for valid keys |
| `status=truncated` | See Truncation Recovery above |
| Probe not found | Verify cg/ch prefix; check platform |

## Reproducibility

Every response includes `layers_resolved[].content_hash` (SHA-256), `version`, `api_version`, and `data_version`. Include these in analyses for full provenance.
