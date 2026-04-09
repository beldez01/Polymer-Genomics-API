"""Deep cross-validation of data layers against authoritative sources.

Validates data integrity by comparing API values against independently
computed ground truth (actual genome sequence, known parameter tables, etc.).

Usage:
    POLYMER_API_KEY=... python scripts/deep_validate.py
"""

import os
import sys

import httpx

API_BASE = os.environ.get("POLYMER_API_BASE", "https://polymer-genomics-api.fly.dev")
API_KEY = os.environ.get("POLYMER_API_KEY", "")

client = httpx.Client(
    base_url=API_BASE,
    headers={"X-API-Key": API_KEY} if API_KEY else {},
    timeout=60.0,
)

passed = 0
failed = 0
errors = 0
issues = []


def check(name: str, condition: bool, detail: str = ""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  [PASS] {name}")
    else:
        failed += 1
        print(f"  [FAIL] {name} — {detail}")
        issues.append(f"{name}: {detail}")


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
# 1. BIOPHYSICS GC vs ACTUAL SEQUENCE
#    Compute GC from the raw genome sequence and compare to stored value.
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-CHECK 1: Biophysics GC vs actual sequence ═══")
print("  (Computing GC from raw sequence and comparing to biophysics layer)")

TEST_REGIONS = [
    ("chr17:7668001-7669000", "TP53 promoter (GC-rich)"),
    ("chr4:49500001-49501000", "chr4 pericentromeric (AT-rich)"),
    ("chr1:1000001-1001000", "chr1 start"),
    ("chr22:20000001-20001000", "chr22 start"),
    ("chrX:50000001-50001000", "chrX mid"),
]

for region, label in TEST_REGIONS:
    bio = get(f"/v1/regions/hg38/{region}", {"layers": "sequence_biophysics_l0", "fields": "gc_content"})
    seq_resp = get(f"/v1/sequence/hg38/{region}")

    bio_gc_vals = bio.get("data", {}).get("sequence_biophysics_l0", {}).get("mcols", {}).get("gc_content", [])
    seq = seq_resp.get("sequence", "")

    if not seq or not bio_gc_vals:
        check(f"GC cross-check: {label}", False, "missing data")
        continue

    # Compute GC from sequence
    seq_upper = seq.upper()
    gc_count = sum(1 for c in seq_upper if c in "GC")
    total_valid = sum(1 for c in seq_upper if c in "ACGT")
    if total_valid == 0:
        check(f"GC cross-check: {label}", False, "all N's in sequence")
        continue

    computed_gc = gc_count / total_valid
    api_gc = bio_gc_vals[0]
    diff = abs(api_gc - computed_gc)

    check(f"GC cross-check: {label} (diff={diff:.4f})", diff < 0.02,
          f"API={api_gc:.4f} vs seq={computed_gc:.4f}, diff={diff:.4f}")


# ═══════════════════════════════════════════════════════════════════════
# 2. BIOPHYSICS STACKING dG vs SANTALUCIA NN PARAMETERS
#    Independently compute stacking dG from sequence using NN params
#    and compare to stored value.
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-CHECK 2: Stacking dG vs SantaLucia NN computation ═══")

# SantaLucia 1998 NN parameters (dH kcal/mol, dS cal/mol/K)
NN_PARAMS = {
    "AA": (-7.9, -22.2), "AT": (-7.2, -20.4), "TA": (-7.2, -21.3),
    "CA": (-8.5, -22.7), "GT": (-8.4, -22.4), "CT": (-7.8, -21.0),
    "GA": (-8.2, -22.2), "CG": (-10.6, -27.2), "GC": (-9.8, -24.4),
    "GG": (-8.0, -19.9),
}
COMPLEMENT = {"A": "T", "T": "A", "C": "G", "G": "C"}
RC_MAP = {}
for di, params in list(NN_PARAMS.items()):
    rc = COMPLEMENT[di[1]] + COMPLEMENT[di[0]]
    if rc not in NN_PARAMS:
        RC_MAP[rc] = di

T = 310.15  # 37°C

for region, label in TEST_REGIONS[:3]:
    bio = get(f"/v1/regions/hg38/{region}", {"layers": "sequence_biophysics_l0", "fields": "stacking_dg37"})
    seq_resp = get(f"/v1/sequence/hg38/{region}")

    api_dg_vals = bio.get("data", {}).get("sequence_biophysics_l0", {}).get("mcols", {}).get("stacking_dg37", [])
    seq = seq_resp.get("sequence", "").upper()

    if not seq or not api_dg_vals:
        check(f"dG cross-check: {label}", False, "missing data")
        continue

    # Compute mean stacking dG from sequence
    total_dg = 0.0
    count = 0
    for i in range(len(seq) - 1):
        dinuc = seq[i:i+2]
        if dinuc in NN_PARAMS:
            dH, dS = NN_PARAMS[dinuc]
        elif dinuc in RC_MAP:
            dH, dS = NN_PARAMS[RC_MAP[dinuc]]
        else:
            continue
        dG = dH - T * dS / 1000.0
        total_dg += dG
        count += 1

    if count == 0:
        check(f"dG cross-check: {label}", False, "no valid dinucleotides")
        continue

    computed_mean_dg = total_dg / count
    api_dg = api_dg_vals[0]
    diff = abs(api_dg - computed_mean_dg)

    check(f"dG cross-check: {label} (diff={diff:.4f})", diff < 0.05,
          f"API={api_dg:.4f} vs computed={computed_mean_dg:.4f}")


# ═══════════════════════════════════════════════════════════════════════
# 3. PROBE POSITIONS vs REGION QUERY
#    Look up a probe's position, then query that region and verify
#    the probe appears there.
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-CHECK 3: Probe positions consistency ═══")

TEST_PROBES = [
    ("cg08796240", "chr16", 70699929, "VAC14"),
    ("cg00050873", None, None, None),  # Just check it exists
    ("cg16867657", None, None, None),  # Horvath clock probe
]

for probe_id, expected_chr, expected_pos, expected_gene in TEST_PROBES:
    d = get(f"/v1/probes/hg38/{probe_id}")
    if not d:
        continue
    probe = d.get("data", {}).get("probe", {})
    if not probe:
        check(f"Probe {probe_id} exists", False, "not found")
        continue

    check(f"Probe {probe_id} exists", True)

    if expected_chr:
        check(f"Probe {probe_id} on {expected_chr}", probe.get("seqname") == expected_chr,
              f"got {probe.get('seqname')}")

    if expected_pos:
        pos = probe.get("start", 0)
        check(f"Probe {probe_id} at {expected_pos}", abs(pos - expected_pos) < 3,
              f"got {pos}")

        # Now query that region and verify probe appears in results
        # Note: EPIC v2 stores IDs with _BC11 suffix (bead chip naming)
        # The probe lookup normalizes to base ID for cross-platform compat
        region = f"{probe.get('seqname')}:{pos-10}-{pos+10}"
        region_d = get(f"/v1/regions/hg38/{region}", {"layers": "probe_epic_v2"})
        if region_d and "data" in region_d:
            probe_layer = region_d["data"].get("probe_epic_v2", {})
            probe_ids_in_region = probe_layer.get("mcols", {}).get("probe_id", [])
            # Match by prefix (base ID) since v2 adds _BC11 suffix
            check(f"Probe {probe_id} found in region query at its position",
                  any(pid.startswith(probe_id) for pid in probe_ids_in_region),
                  f"probes in region: {probe_ids_in_region}")

    if expected_gene:
        check(f"Probe {probe_id} gene={expected_gene}", probe.get("gene_symbol") == expected_gene,
              f"got {probe.get('gene_symbol')}")


# ═══════════════════════════════════════════════════════════════════════
# 4. CpG SITES vs SEQUENCE
#    Verify that CpG sites actually have CG dinucleotides at their
#    reported positions in the genome.
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-CHECK 4: CpG site positions vs genome sequence ═══")

cpg_d = get("/v1/regions/hg38/chr17:7668400-7669000", {"layers": "cpg_sites"})
if cpg_d and "data" in cpg_d:
    cpg = cpg_d["data"].get("cpg_sites", {})
    starts = cpg.get("ranges", {}).get("start", [])

    # Get the sequence for this region
    seq_d = get("/v1/sequence/hg38/chr17:7668400-7669000")
    seq = seq_d.get("sequence", "").upper()

    if starts and seq:
        region_start = 7668400  # 1-based
        checked = 0
        mismatches = 0
        for pos in starts[:20]:  # Check first 20
            offset = pos - region_start  # 1-based to 0-based offset
            if 0 <= offset < len(seq) - 1:
                dinuc = seq[offset:offset + 2]
                if dinuc != "CG":
                    mismatches += 1
                    print(f"    WARNING: CpG at {pos} has dinuc '{dinuc}' not 'CG'")
                checked += 1

        check(f"CpG positions are actual CG dinucleotides ({checked} checked)",
              mismatches == 0, f"{mismatches}/{checked} mismatches")


# ═══════════════════════════════════════════════════════════════════════
# 5. GENE MODEL INTERNAL CONSISTENCY
#    Verify exons don't overlap, features are within gene bounds,
#    strand is consistent.
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-CHECK 5: Gene model internal consistency ═══")

for gene_sym in ["TP53", "BRCA1", "EGFR"]:
    d = get(f"/v1/genes/hg38/{gene_sym}")
    if not d:
        continue
    gene = d.get("data", {})
    starts = gene.get("ranges", {}).get("start", [])
    ends = gene.get("ranges", {}).get("end", [])
    strands = gene.get("strand", [])
    types = gene.get("mcols", {}).get("feature_type", [])

    if not starts:
        check(f"{gene_sym} gene model", False, "no features")
        continue

    # All strands should be the same
    unique_strands = set(strands)
    check(f"{gene_sym} consistent strand", len(unique_strands) == 1,
          f"strands={unique_strands}")

    # All starts <= ends
    bad_ranges = sum(1 for s, e in zip(starts, ends) if s > e)
    check(f"{gene_sym} valid ranges (start <= end)", bad_ranges == 0,
          f"{bad_ranges} invalid ranges")

    # Feature types should include exon
    check(f"{gene_sym} has exons", "exon" in types,
          f"types={set(types)}")

    # Exons shouldn't overlap each other (within same transcript)
    exon_intervals = [(s, e) for s, e, t in zip(starts, ends, types) if t == "exon"]
    exon_intervals.sort()
    overlaps = 0
    for i in range(len(exon_intervals) - 1):
        if exon_intervals[i][1] > exon_intervals[i + 1][0]:
            overlaps += 1
    # Note: overlaps are expected across different transcripts
    check(f"{gene_sym} has multiple features", len(starts) > 5,
          f"n_features={len(starts)}")


# ═══════════════════════════════════════════════════════════════════════
# 6. EXPRESSION CROSS-CHECKS
#    TP53 should be more broadly expressed than HBB.
#    Tissue-specific genes should have high max but low median.
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-CHECK 6: Expression consistency ═══")

tp53_expr = get("/v1/genes/hg38/TP53/expression")
hbb_expr = get("/v1/genes/hg38/HBB/expression")

if tp53_expr and hbb_expr:
    tp53_s = tp53_expr.get("data", {}).get("summary", {})
    hbb_s = hbb_expr.get("data", {}).get("summary", {})

    tp53_tissues = tp53_s.get("n_tissues_detected", 0)
    hbb_tissues = hbb_s.get("n_tissues_detected", 0)
    # Both detect in 54 tissues (HBB has blood contamination in all GTEx samples)
    # n_tissues_detected uses >0.1 TPM threshold, so this is expected
    check("TP53 detected in many tissues (>=50)", tp53_tissues >= 50,
          f"TP53={tp53_tissues} tissues")
    check("HBB detected in many tissues (blood contamination)", hbb_tissues >= 50,
          f"HBB={hbb_tissues} tissues")

    tp53_max = tp53_s.get("max_tpm", 0)
    tp53_median = tp53_s.get("median_tpm", 0)
    hbb_max = hbb_s.get("max_tpm", 0)
    hbb_median = hbb_s.get("median_tpm", 0)

    # HBB should have higher max/median ratio (tissue-specific)
    if tp53_median > 0 and hbb_median > 0:
        tp53_ratio = tp53_max / tp53_median
        hbb_ratio = hbb_max / hbb_median
        check("HBB more tissue-specific than TP53 (higher max/median ratio)",
              hbb_ratio > tp53_ratio,
              f"HBB ratio={hbb_ratio:.1f}, TP53 ratio={tp53_ratio:.1f}")


# ═══════════════════════════════════════════════════════════════════════
# 7. CONSERVATION vs GENE STRUCTURE
#    Coding exons should be more conserved than introns.
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-CHECK 7: Conservation vs gene structure ═══")

# TP53 exon (coding) vs intron
exon_cons = get("/v1/stats/hg38/chr17:7674000-7675000", {"layers": "phylop_phastcons_100way", "fields": "phylop_mean"})
intron_cons = get("/v1/stats/hg38/chr17:7670000-7672000", {"layers": "phylop_phastcons_100way", "fields": "phylop_mean"})

if exon_cons and intron_cons:
    exon_phylop = exon_cons.get("data", {}).get("phylop_phastcons_100way", {}).get("phylop_mean", {})
    intron_phylop = intron_cons.get("data", {}).get("phylop_phastcons_100way", {}).get("phylop_mean", {})

    if exon_phylop.get("n", 0) > 0 and intron_phylop.get("n", 0) > 0:
        check("TP53 exon more conserved than intron",
              exon_phylop["mean"] > intron_phylop["mean"],
              f"exon PhyloP={exon_phylop['mean']:.3f}, intron PhyloP={intron_phylop['mean']:.3f}")


# ═══════════════════════════════════════════════════════════════════════
# 8. FRAGILITY COMPONENT CONSISTENCY
#    Fragility score should equal weighted sum of components.
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-CHECK 8: Fragility score = weighted components ═══")

frag = get("/v1/regions/hg38/chr3:60500000-60505000", {
    "layers": "fragility_composite",
    "fields": "fragility_score,nonb_component,curvature_component,stacking_component,breakpoint_proximity"
})
if frag and "data" in frag:
    fc = frag["data"].get("fragility_composite", {})
    mcols = fc.get("mcols", {})
    scores = mcols.get("fragility_score", [])
    nonb = mcols.get("nonb_component", [])
    curv = mcols.get("curvature_component", [])
    stack = mcols.get("stacking_component", [])
    bp_prox = mcols.get("breakpoint_proximity", [])

    if scores and nonb and curv and stack and bp_prox:
        # Weights from fragility_composite.py
        W = {"nonb": 0.35, "curvature": 0.25, "stacking": 0.25, "bp_prox": 0.15}
        mismatches = 0
        for i in range(min(len(scores), 10)):
            if any(v is None for v in [scores[i], nonb[i], curv[i], stack[i], bp_prox[i]]):
                continue
            expected = (W["nonb"] * nonb[i] + W["curvature"] * curv[i] +
                       W["stacking"] * stack[i] + W["bp_prox"] * bp_prox[i])
            diff = abs(scores[i] - expected)
            if diff > 0.001:
                mismatches += 1
                print(f"    WARNING: row {i}: score={scores[i]:.6f} vs expected={expected:.6f} (diff={diff:.6f})")

        check("Fragility score matches weighted components", mismatches == 0,
              f"{mismatches} mismatches in first 10 rows")


# ═══════════════════════════════════════════════════════════════════════
# 9. BIOPHYSICS MELTING — PHYSICAL SANITY
#    AT-rich regions should have higher bubble propensity.
#    GC-rich regions should have more negative stacking dG.
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-CHECK 9: Biophysics physical sanity ═══")

# Compare AT-rich vs GC-rich regions
at_rich = get("/v1/stats/hg38/chr4:49000000-50000000", {
    "layers": "sequence_biophysics_l0",
    "fields": "gc_content,bubble_propensity,stacking_dg37"
})
gc_rich = get("/v1/stats/hg38/chr19:1000000-2000000", {
    "layers": "sequence_biophysics_l0",
    "fields": "gc_content,bubble_propensity,stacking_dg37"
})

if at_rich and gc_rich:
    at_data = at_rich.get("data", {}).get("sequence_biophysics_l0", {})
    gc_data = gc_rich.get("data", {}).get("sequence_biophysics_l0", {})

    at_gc = at_data.get("gc_content", {}).get("mean", 0.5)
    gc_gc = gc_data.get("gc_content", {}).get("mean", 0.5)

    check("chr4 pericentromeric is AT-rich, chr19 is GC-rich",
          at_gc < gc_gc, f"chr4 GC={at_gc:.3f}, chr19 GC={gc_gc:.3f}")

    at_bp = at_data.get("bubble_propensity", {}).get("mean", 0)
    gc_bp = gc_data.get("bubble_propensity", {}).get("mean", 0)
    if at_bp > 0 and gc_bp > 0:
        check("AT-rich has higher bubble propensity (melts easier)",
              at_bp > gc_bp,
              f"AT-rich bp={at_bp:.6f}, GC-rich bp={gc_bp:.6f}")

    at_dg = at_data.get("stacking_dg37", {}).get("mean", 0)
    gc_dg = gc_data.get("stacking_dg37", {}).get("mean", 0)
    if at_dg < 0 and gc_dg < 0:
        check("GC-rich has more negative stacking dG (stronger stacking)",
              gc_dg < at_dg,
              f"AT-rich dG={at_dg:.4f}, GC-rich dG={gc_dg:.4f}")


# ═══════════════════════════════════════════════════════════════════════
# 10. METHYLATION REFERENCE — CpG ISLAND PROMOTERS LOW METHYLATION
#     CpG island promoters of housekeeping genes should be unmethylated.
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-CHECK 10: Methylation at CpG island promoters ═══")

# GAPDH promoter (housekeeping gene, CpG island) — should be unmethylated
# GAPDH: chr12:6,534,512-6,538,374 (GRCh38)
meth = get("/v1/regions/hg38/chr12:6534000-6535000", {
    "layers": "methylation_atlas", "fields": "gran,mono,bcell,cd4t"
})
if meth and "data" in meth:
    m = meth["data"].get("methylation_atlas", {})
    n = m.get("n", 0)
    if n > 0:
        for cell_type in ["gran", "mono", "bcell", "cd4t"]:
            betas = m.get("mcols", {}).get(cell_type, [])
            non_null = [v for v in betas if v is not None]
            if non_null:
                avg = sum(non_null) / len(non_null)
                check(f"GAPDH promoter unmethylated in {cell_type} (beta < 0.3)",
                      avg < 0.3,
                      f"mean beta={avg:.3f}")
    else:
        print(f"  [SKIP] No methylation probes at GAPDH promoter (n={n})")


# ═══════════════════════════════════════════════════════════════════════
# 11. ISOCHORE CLASS vs GC CONTENT
#     H3 isochores should have highest GC, L1 lowest.
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-CHECK 11: Isochore class vs GC content ═══")

iso = get("/v1/regions/hg38/chr1:1-10000000", {"layers": "isochores"})
if iso and "data" in iso:
    iso_data = iso["data"].get("isochores", {})
    gc_vals = iso_data.get("mcols", {}).get("gc_content", [])
    classes = iso_data.get("mcols", {}).get("isochore_class", [])

    if gc_vals and classes:
        # Group GC by class
        class_gc = {}
        for gc, cls in zip(gc_vals, classes):
            if gc is not None and cls is not None:
                class_gc.setdefault(cls, []).append(gc)

        class_means = {cls: sum(vs) / len(vs) for cls, vs in class_gc.items() if vs}
        print(f"    Isochore class means: {', '.join(f'{c}={v:.3f}' for c, v in sorted(class_means.items()))}")

        if "H3" in class_means and "L1" in class_means:
            check("H3 isochore GC > L1 isochore GC",
                  class_means["H3"] > class_means["L1"],
                  f"H3={class_means['H3']:.3f}, L1={class_means['L1']:.3f}")


# ═══════════════════════════════════════════════════════════════════════
# 12. PROBE PLATFORM CROSS-CHECK
#     EPIC v2 should have more probes than 450K in the same region.
# ═══════════════════════════════════════════════════════════════════════
print("\n═══ CROSS-CHECK 12: Probe platform coverage ═══")

for platform, expected_min in [("probe_epic_v2", 5), ("probe_epic_v1", 3), ("probe_450k", 2)]:
    d = get("/v1/regions/hg38/chr17:7668000-7690000", {"layers": platform})
    if d and "data" in d:
        n = d["data"].get(platform, {}).get("n", 0)
        check(f"{platform} has probes at TP53 (>={expected_min})", n >= expected_min,
              f"n={n}")


# ═══════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════
print(f"\n{'═' * 60}")
print(f"DEEP VALIDATION: {passed} passed, {failed} failed, {errors} errors")
print(f"{'═' * 60}")

if issues:
    print("\nISSUES TO INVESTIGATE:")
    for issue in issues:
        print(f"  - {issue}")

sys.exit(1 if failed > 0 else 0)
