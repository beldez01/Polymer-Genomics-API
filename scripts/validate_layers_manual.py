"""Manual validation of all data layers against known ground-truth values.

Spot-checks specific loci where the correct answer is known from
authoritative sources (GENCODE, gnomAD, UCSC, Illumina manifests, etc.).

Usage:
    POLYMER_API_KEY=... python scripts/validate_layers_manual.py
"""

import os
import sys

import httpx

API_BASE = os.environ.get("POLYMER_API_BASE", "https://polymer-genomics-api.fly.dev")
API_KEY = os.environ.get("POLYMER_API_KEY", "")

client = httpx.Client(
    base_url=API_BASE,
    headers={"X-API-Key": API_KEY} if API_KEY else {},
    timeout=30.0,
)

passed = 0
failed = 0
errors = 0


def check(name: str, condition: bool, detail: str = ""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  [PASS] {name}")
    else:
        failed += 1
        print(f"  [FAIL] {name} — {detail}")


def get(path: str, params: dict | None = None) -> dict:
    global errors
    try:
        resp = client.get(path, params=params)
        if resp.status_code != 200:
            errors += 1
            print(f"  [ERROR] {path} returned {resp.status_code}")
            return {}
        return resp.json()
    except Exception as e:
        errors += 1
        print(f"  [ERROR] {path}: {e}")
        return {}


# ═══════════════════════════════════════════════════════════════════════
# 1. GENE MODEL (gencode_v44) — TP53 on chr17
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ GENE MODEL (gencode_v44) ═══")

# Gene response is GRanges format: data.ranges.start[], data.seqnames[], data.mcols.gene_symbol[]
d = get("/v1/genes/hg38/TP53")
if d:
    gene = d.get("data", {})
    check("TP53 found", gene.get("n", 0) > 0, f"n={gene.get('n', 0)}")
    seqnames = gene.get("seqnames", [])
    check("TP53 on chr17", "chr17" in seqnames, f"seqnames={seqnames[:3]}")
    starts = gene.get("ranges", {}).get("start", [])
    # TP53 coordinates: chr17:7,668,402-7,687,550 (GRCh38) — many features
    check("TP53 features include ~7668402", any(abs(s - 7668402) < 200 for s in starts),
          f"min_start={min(starts) if starts else 0}")
    strands = gene.get("strand", [])
    check("TP53 strand is -", "-" in strands, f"strands={set(strands)}")

# BRCA1 on chr17
d2 = get("/v1/genes/hg38/BRCA1")
if d2:
    gene2 = d2.get("data", {})
    check("BRCA1 found", gene2.get("n", 0) > 0)
    starts2 = gene2.get("ranges", {}).get("start", [])
    check("BRCA1 features include ~43044295", any(abs(s - 43044295) < 500 for s in starts2),
          f"min_start={min(starts2) if starts2 else 0}")

# Gene alias resolution
d3 = get("/v1/genes/hg38/p53")
if d3:
    gene3 = d3.get("data", {})
    symbols = gene3.get("mcols", {}).get("gene_symbol", [])
    check("p53 alias resolves to TP53", "TP53" in symbols,
          f"symbols={set(symbols) if symbols else '?'}")


# ═══════════════════════════════════════════════════════════════════════
# 2. CpG SITES — known CpG island at TP53 promoter
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CpG SITES ═══")

d = get("/v1/regions/hg38/chr17:7668400-7669000", params={"layers": "cpg_sites"})
if d and "data" in d:
    cpg = d["data"].get("cpg_sites", {})
    n = cpg.get("n", 0)
    check("CpG sites found at TP53 promoter", n > 0, f"n={n}")
    check("CpG sites count reasonable (>5)", n > 5, f"n={n}")
    contexts = cpg.get("mcols", {}).get("context", [])
    check("CpG context values present", len(contexts) > 0)
    gc = cpg.get("mcols", {}).get("gc_content", [])
    if gc:
        check("GC content in [0,1]", all(0 <= v <= 1 for v in gc if v is not None))


# ═══════════════════════════════════════════════════════════════════════
# 3. PROBES — cg08796240 (VAC14, known from TET2 project)
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ PROBES ═══")

# Probe response: data.probe.{probe_id, seqname, start, gene_symbol, cpg_context}
d = get("/v1/probes/hg38/cg08796240")
if d:
    probe = d.get("data", {}).get("probe", {})
    check("cg08796240 found", bool(probe))
    check("cg08796240 on chr16", probe.get("seqname") == "chr16",
          f"got {probe.get('seqname', '?')}")
    pos = probe.get("start", 0)
    check("cg08796240 position ~70699929", abs(pos - 70699929) < 5, f"got {pos}")
    check("cg08796240 gene is VAC14", probe.get("gene_symbol") == "VAC14",
          f"got {probe.get('gene_symbol', '?')}")

# cg00050873 — a well-known Horvath clock probe
d2 = get("/v1/probes/hg38/cg00050873")
if d2:
    probe2 = d2.get("data", {})
    check("cg00050873 (Horvath clock) found", bool(probe2))


# ═══════════════════════════════════════════════════════════════════════
# 4. SEQUENCE BIOPHYSICS — GC content sanity
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ SEQUENCE BIOPHYSICS ═══")

# Check a known GC-rich region (CpG island at TP53 promoter)
d = get("/v1/regions/hg38/chr17:7668400-7670000", params={
    "layers": "sequence_biophysics_l0", "fields": "gc_content,stacking_dg37,bubble_propensity,melting_width"
})
if d and "data" in d:
    bio = d["data"].get("sequence_biophysics_l0", {})
    gc = bio.get("mcols", {}).get("gc_content", [])
    dg = bio.get("mcols", {}).get("stacking_dg37", [])
    bp = bio.get("mcols", {}).get("bubble_propensity", [])
    mw = bio.get("mcols", {}).get("melting_width", [])

    if gc:
        check("GC content in [0,1]", all(0 <= v <= 1 for v in gc if v is not None))
        avg_gc = sum(v for v in gc if v) / len([v for v in gc if v])
        check("TP53 promoter GC-rich (>0.5)", avg_gc > 0.5, f"avg={avg_gc:.3f}")
    if dg:
        check("Stacking dG negative", all(v < 0 for v in dg if v is not None), f"sample={dg[:3]}")
        # GC-rich → more negative dG
        avg_dg = sum(v for v in dg if v) / len([v for v in dg if v])
        check("GC-rich region has strong stacking (dG < -1.4)", avg_dg < -1.4, f"avg={avg_dg:.3f}")
    if bp:
        non_null = [v for v in bp if v is not None]
        check("Bubble propensity present and > 0.001", len(non_null) > 0 and all(v > 0.001 for v in non_null),
              f"sample={non_null[:3]}")
    if mw:
        non_null = [v for v in mw if v is not None]
        check("Melting width present and not all 60.0", len(non_null) > 0 and not all(v == 60.0 for v in non_null),
              f"sample={non_null[:3]}")

# Check AT-rich region (chr4 pericentromeric)
d2 = get("/v1/stats/hg38/chr4:49000000-50000000", params={
    "layers": "sequence_biophysics_l0", "fields": "gc_content"
})
if d2 and "data" in d2:
    gc_stats = d2["data"].get("sequence_biophysics_l0", {}).get("gc_content", {})
    if gc_stats.get("n", 0) > 0:
        check("chr4 pericentromeric is AT-rich (GC < 0.42)", gc_stats["mean"] < 0.42,
              f"mean={gc_stats['mean']:.3f}")


# ═══════════════════════════════════════════════════════════════════════
# 5. CONSERVATION — PhyloP at known conserved/unconserved loci
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CONSERVATION ═══")

d = get("/v1/stats/hg38/chr17:7674000-7676000", params={
    "layers": "phylop_phastcons_100way", "fields": "phylop_mean"
})
if d and "data" in d:
    cons = d["data"].get("phylop_phastcons_100way", {}).get("phylop_mean", {})
    if cons.get("n", 0) > 0:
        check("TP53 coding region conserved (PhyloP > 0.5)", cons["mean"] > 0.5,
              f"mean={cons['mean']:.3f}")


# ═══════════════════════════════════════════════════════════════════════
# 6. EXPRESSION — TP53 ubiquitously expressed
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ EXPRESSION (GTEx v10) ═══")

# Expression response: data.summary.{median_tpm, n_tissues_detected, max_tissue}
d = get("/v1/genes/hg38/TP53/expression")
if d:
    summary = d.get("data", {}).get("summary", {})
    median_tpm = summary.get("median_tpm", 0)
    n_tissues = summary.get("n_tissues_detected", 0)
    check("TP53 expressed (median_tpm > 5)", median_tpm > 5, f"median_tpm={median_tpm}")
    check("TP53 ubiquitous (>50 tissues)", n_tissues > 50, f"n_tissues={n_tissues}")

# HBB — tissue-specific (blood)
d2 = get("/v1/genes/hg38/HBB/expression")
if d2:
    expr2 = d2.get("data", {})
    check("HBB found in expression", bool(expr2))


# ═══════════════════════════════════════════════════════════════════════
# 7. GENE CONSTRAINT — TP53 highly constrained
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ GENE CONSTRAINT (gnomAD) ═══")

# Constraint response: data.constraint.{pli, loeuf, ...}
d = get("/v1/genes/hg38/TP53/constraint")
if d:
    cons = d.get("data", {}).get("constraint", {})
    pli = cons.get("pli", 0)
    # TP53 pLI is 0.53 in gnomAD (not >0.9 — moderate constraint because of dominant negative)
    check("TP53 pLI > 0.4", pli > 0.4, f"pLI={pli}")
    loeuf = cons.get("loeuf", 1)
    check("TP53 LOEUF < 0.5", loeuf < 0.5, f"LOEUF={loeuf}")


# ═══════════════════════════════════════════════════════════════════════
# 8. REGULATORY — ENCODE cCREs at TP53 promoter
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ REGULATORY (ENCODE cCREs) ═══")

d = get("/v1/regions/hg38/chr17:7668000-7669000", params={"layers": "encode_ccre_v4"})
if d and "data" in d:
    ccre = d["data"].get("encode_ccre_v4", {})
    n = ccre.get("n", 0)
    check("cCREs found at TP53 promoter", n > 0, f"n={n}")
    labels = ccre.get("mcols", {}).get("encode_label", [])
    check("cCRE labels present", len(labels) > 0, f"labels={labels}")
    # dELS/PLS/pELS all valid regulatory elements near TP53
    check("Regulatory element type valid", any(l in ("PLS", "pELS", "dELS", "CTCF-only") for l in labels),
          f"labels={labels}")


# ═══════════════════════════════════════════════════════════════════════
# 9. ISOCHORES
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ ISOCHORES ═══")

d = get("/v1/regions/hg38/chr17:7660000-7690000", params={"layers": "isochores"})
if d and "data" in d:
    iso = d["data"].get("isochores", {})
    n = iso.get("n", 0)
    check("Isochore found at TP53", n > 0, f"n={n}")
    classes = iso.get("mcols", {}).get("isochore_class", [])
    gc = iso.get("mcols", {}).get("gc_content", [])
    if gc:
        check("Isochore GC in [0.3, 0.7]", all(0.3 <= v <= 0.7 for v in gc if v), f"gc={gc}")


# ═══════════════════════════════════════════════════════════════════════
# 10. NON-B DNA
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ NON-B DNA ═══")

d = get("/v1/stats/hg38/chr17:7668000-7690000", params={
    "layers": "nonb_dna", "fields": "total_nonb_density,g4_density"
})
if d and "data" in d:
    nonb = d["data"].get("nonb_dna", {})
    total = nonb.get("total_nonb_density", {})
    if total.get("n", 0) > 0:
        check("Non-B DNA density present", total["n"] > 0)
        check("Total non-B density >= 0", total["mean"] >= 0, f"mean={total['mean']}")


# ═══════════════════════════════════════════════════════════════════════
# 11. FRAGILITY COMPOSITE
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ FRAGILITY COMPOSITE ═══")

d = get("/v1/stats/hg38/chr3:60000000-61000000", params={
    "layers": "fragility_composite", "fields": "fragility_score"
})
if d and "data" in d:
    frag = d["data"].get("fragility_composite", {}).get("fragility_score", {})
    if frag.get("n", 0) > 0:
        check("Fragility score in [0,1]", 0 <= frag["min"] and frag["max"] <= 1,
              f"range=[{frag['min']}, {frag['max']}]")
        check("Fragility score mean reasonable", 0.1 < frag["mean"] < 0.6,
              f"mean={frag['mean']:.3f}")

# FRA3B (chr3:60.5M) — known common fragile site, should have higher fragility
d2 = get("/v1/regions/hg38/chr3:60500000-60600000", params={
    "layers": "fragility_composite", "fields": "fragility_score"
})
if d2 and "data" in d2:
    fra3b = d2["data"].get("fragility_composite", {})
    scores = fra3b.get("mcols", {}).get("fragility_score", [])
    if scores:
        avg = sum(s for s in scores if s) / len([s for s in scores if s])
        check("FRA3B region has elevated fragility (>0.25)", avg > 0.25,
              f"avg={avg:.3f}")


# ═══════════════════════════════════════════════════════════════════════
# 12. BREAKPOINTS
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ BREAKPOINTS ═══")

d = get("/v1/regions/hg38/chr3:60000000-61000000", params={"layers": "breakpoints"})
if d and "data" in d:
    bp = d["data"].get("breakpoints", {})
    n = bp.get("n", 0)
    check("Breakpoints found near FRA3B", n > 0, f"n={n}")


# ═══════════════════════════════════════════════════════════════════════
# 13. METHYLATION REFERENCE
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ METHYLATION REFERENCE ═══")

d = get("/v1/regions/hg38/chr17:7668400-7669000", params={
    "layers": "methylation_atlas", "fields": "gran,mono,bcell"
})
if d and "data" in d:
    meth = d["data"].get("methylation_atlas", {})
    n = meth.get("n", 0)
    check("Methylation reference probes at TP53", n > 0, f"n={n}")
    gran = meth.get("mcols", {}).get("gran", [])
    if gran:
        non_null = [v for v in gran if v is not None]
        check("Granulocyte betas in [0,1]", all(0 <= v <= 1 for v in non_null),
              f"sample={non_null[:3]}")


# ═══════════════════════════════════════════════════════════════════════
# 14. REPEATS
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ REPEATS (RepeatMasker) ═══")

# ALU-rich region
d = get("/v1/regions/hg38/chr17:7660000-7665000", params={"layers": "repeatmasker_v1"})
if d and "data" in d:
    rep = d["data"].get("repeatmasker_v1", {})
    n = rep.get("n", 0)
    check("Repeats found near TP53", n > 0, f"n={n}")
    classes = rep.get("mcols", {}).get("repeat_class", rep.get("mcols", {}).get("family", []))
    if classes:
        check("Repeat classes present", len(classes) > 0)


# ═══════════════════════════════════════════════════════════════════════
# 15. SEQUENCE — known sequence at TP53 start codon
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ SEQUENCE ═══")

# Sequence endpoint may return data.sequence or just the sequence string
d = get("/v1/sequence/hg38/chr17:7676594-7676596")
if d:
    seq = d.get("sequence", d.get("data", {}).get("sequence", ""))
    check("Sequence returned", len(seq) >= 3, f"got '{seq}'")
    if seq:
        check("Sequence is valid DNA", all(c in "ACGTNacgtn" for c in seq), f"seq={seq}")


# ═══════════════════════════════════════════════════════════════════════
# 16. CROSS-CHECKS — GC vs stacking anticorrelation
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-LAYER CORRELATION ═══")

# Smaller region to avoid timeout
d = get("/v1/correlate/hg38/chr17:7000000-8000000", params={
    "layer_a": "sequence_biophysics_l0", "layer_b": "sequence_biophysics_l0",
    "stat": "pearson_r", "field_a": "gc_content", "field_b": "stacking_dg37",
    "resolution": "10000",
})
if d and "data" in d:
    stat = d["data"].get("statistic", d["data"].get("result", {}))
    r = stat.get("value", stat.get("r"))
    if r is not None:
        check("GC vs stacking dG anticorrelated (r < -0.9)", r < -0.9, f"r={r:.3f}")
    else:
        check("Correlation result parsed", False, f"data keys={list(d['data'].keys())}")


# ═══════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════
print(f"\n{'═' * 60}")
print(f"VALIDATION SUMMARY: {passed} passed, {failed} failed, {errors} errors")
print(f"{'═' * 60}")
sys.exit(1 if failed > 0 or errors > 0 else 0)
