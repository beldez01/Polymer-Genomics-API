# Hardening & Tasteful Expansion Roadmap

**Current state**: 28 layers, 46M features, 18/20 GB used, API live, MCP working, SDK on PyPI, validated.

**Goal**: Go from "works" to "trusted infrastructure" that AI companies and researchers rely on.

---

## The Remaining 10%

### A. Infrastructure Hardening (reliability)

| Priority | Item | Current State | Fix | Impact |
|----------|------|--------------|-----|--------|
| **P0** | Volume headroom | 18/20 GB (90%) | `fly volumes extend` to 40 GB before new layers fill it | **Blocking** — 9 new layers need space |
| **P0** | Cold start latency | ~290ms ping, fine | Monitor — but shared-cpu-2x could spike under load | |
| **P1** | Query timeouts | probe_biophysics took 6.8s for 3 probes | Add GiST index on `(build, chr_id, coord)` for biophysics if missing; consider materialized view for probe→biophysics JOIN | Performance |
| **P1** | Error monitoring | No alerting | Add Fly metrics + Sentry or simple uptime check (uptimerobot.com, free) | Trust |
| **P2** | Rate limiting | None — anyone with API key has unlimited access | Add per-key rate limit (100 req/min) via FastAPI middleware | Protection |
| **P2** | Response caching | None — every query hits DB | Cache reference constants (NN params, AA props, physical constants) in-memory — they never change | Performance |
| **P2** | Connection pool tuning | min=2, max=10 | May need adjustment as traffic grows | Scalability |

### B. Data Quality Hardening (correctness)

| Priority | Item | Current State | Fix |
|----------|------|--------------|-----|
| **P0** | All layers have evidence class | 2 layers have null evidence class | Assign M/K/D/S/H to all |
| **P0** | All layers have content_hash | Some null | Compute SHA-256 for all layers |
| **P1** | GENCODE version documented in API responses | Implicit (v44) | Add gencode_version to /layers and response metadata |
| **P1** | Data freshness policy | No update schedule | Document: "GENCODE updated annually, gnomAD on new release, GTEx stable" |
| **P1** | hg37 coverage | hg38 only (despite hg37 advertised) | Either build hg37 or clearly mark as hg38-only |
| **P2** | Automated validation on deploy | Manual validation only | CI step that runs validate_layer on deploy |

### C. Tasteful Expansion (what to add next)

**Guiding principle**: Add data that creates CROSS-LAYER value, not just more rows. Each new layer should enable queries that weren't possible before.

#### Tier 1: High value, low effort (this month)
| Layer | Source | Why | Rows | Storage |
|-------|--------|-----|------|---------|
| **WGBS hematopoietic** | Blueprint/Roadmap | Cell-type methylation × biophysics = the snap-band story | ~3M | ~1 GB |
| **TF binding signal** | ENCODE ChIP-seq | Which TFs bind where × biophysics = structure→function | ~3M | ~1 GB |
| **Accessibility** | ENCODE ATAC/DNase | Open chromatin × biophysics = the predictive model | ~3M | ~0.5 GB |
| **Replication timing** | Repli-seq | Early/late × fragility × biophysics = replication stress | ~3M | ~0.5 GB |

*These are the 9 layers being ingested in the other instance.*

#### Tier 2: High value, moderate effort (next month)
| Layer | Source | Why |
|-------|--------|-----|
| **ClinVar variants** | ClinVar | Pathogenic vs benign × biophysical context → novel variant prioritization |
| **GWAS summary stats** | GWAS Catalog (expanded) | Trait-associated loci × biophysics → material basis of disease risk |
| **Single-cell expression** | Tabula Sapiens / HCA | Cell-type resolution expression → more precise EWGC calculations |
| **3D genome compartments** | Hi-C (Rao 2014) | A/B compartments × biophysics → the polymer folding story |

#### Tier 3: Differentiating but speculative (future)
| Layer | Source | Why |
|-------|--------|-----|
| **Ancient DNA preservation** | Published aDNA datasets | Predicted degradation maps from stacking energy |
| **CRISPR efficiency** | Published guide libraries | Guide efficiency × target biophysics → design tool |
| **Pan-genome variation** | HPRC | Structural variation × biophysical context |

### D. What NOT to add

- **More organisms** (not yet) — get human gold-standard first, then mouse/zebrafish
- **Protein structure** — out of scope, AlphaFold owns this
- **Single-cell epigenomics** — too fragmented, no consensus atlas
- **Whole-genome sequencing** — we're annotation, not variant calling
- **Clinical phenotype data** — licensing nightmare, stay RUO

---

## The Cross-Correlation Story (the 10x multiplier)

The single most valuable thing that's NOT done yet is the **cross-layer correlation matrix**. This is what transforms the platform from "a database" to "a discovery engine."

When you can show:
- r(stacking_dG37, replication_timing) = -0.45 (thermodynamically unstable regions replicate late)
- r(curvature, CTCF_binding) = 0.35 (curved DNA attracts CTCF)
- r(meth_sensitivity, clock_probe_enrichment) = 0.62 (clock probes cluster where methylation has maximal mechanical impact)

...that's a NAR paper figure AND a FutureHouse demo in one.

**This requires the GPU run.** The export script and GPU analysis script are written. Blocked on:
1. New layer ingestion completing
2. Volume expansion (need space for export)
3. GPU access (Colab Pro+ or Lambda)

---

## Recommended Sequence

1. **Today**: Expand volume to 40 GB (`fly volumes extend`)
2. **This week**: Finish 9-layer ingestion (other instance) → export correlation matrix → GPU run
3. **This week**: Add uptime monitoring, assign evidence classes, compute content hashes
4. **Next week**: Cross-correlation heatmaps → NAR paper figures
5. **Next week**: Clean benchmark with proper MCP tool calling
6. **Next 2 weeks**: Email FutureHouse with demo + correlation results
7. **Month**: AnnotationHub package, ClinVar layer, NAR submission

---

## The "Ship It" Threshold

The platform is ready to ship when:
- [x] All core data validated against authoritative sources
- [x] All identified bugs fixed and deployed
- [x] MCP server working with 46 tools
- [x] SDK on PyPI
- [x] Probe biophysics endpoint live
- [ ] Volume expanded (P0 — blocking)
- [ ] Cross-correlation matrix computed (the differentiator)
- [ ] Evidence classes assigned to all layers
- [ ] Uptime monitoring active
- [ ] NAR paper preprint on bioRxiv

You're at 7/10. The remaining 3 are all achievable this week.
