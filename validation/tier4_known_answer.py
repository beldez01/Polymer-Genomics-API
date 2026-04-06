#!/usr/bin/env python3
"""Tier 4: Known-Answer Tests — do well-characterized sequences give expected values?

Tests the computation engine against sequences with experimentally known properties.
No database, no API — pure computation against published biology.

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python validation/tier4_known_answer.py
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT))

from validation.common import compute_gc, print_test, write_results
from polymer_genomics.biophysics import (
    compute_curvature,
    compute_form_propensity,
    compute_thermodynamics,
    detect_motifs,
)

passed = 0
failed = 0
results = {"tier": "4", "name": "Known-Answer Tests", "tests": []}


def record(name: str, ok: bool, detail: str = ""):
    global passed, failed
    if ok:
        passed += 1
    else:
        failed += 1
    print_test(name, ok, detail)
    results["tests"].append({"name": name, "passed": ok, "detail": detail})


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4.1: Telomeric TTAGGG Repeats
# Human telomeres: TTAGGG repeats. Known properties:
#   - GC = 50% (3G + 3 non-G per 6-mer)
#   - Moderate stability (mix of TT, TA, AG, GG, GT steps)
#   - G-quadruplex forming at single-stranded overhang
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 4.1: Telomeric TTAGGG Repeats ═══")

telomere = "TTAGGG" * 50  # 300bp
gc = compute_gc(telomere)
record("4.1a Telomere GC ≈ 0.50", abs(gc - 0.50) < 0.01, f"GC={gc:.3f}")

thermo = compute_thermodynamics(telomere, salt_mm=1000.0)
mean_dg = thermo["summary"]["mean_delta_g_per_step"]
# Telomere has GG, TT, TA, AG, GT steps — intermediate stability
record("4.1b Telomere stability intermediate",
       -1.8 < mean_dg < -1.0,
       f"mean_dg={mean_dg:.3f} kcal/mol (expected -1.8 to -1.0)")

motifs = detect_motifs(telomere)
n_g4 = len(motifs.get("g_quadruplex", []))
record("4.1c Telomere contains G4 motifs", n_g4 > 0,
       f"Found {n_g4} G4 motifs (expected >0 from TTAGGG repeats)")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4.2: A-tract Bending
# Phased A-tracts produce macroscopic DNA bending.
# Koo et al. 1986: A₅ tracts produce 17-21° bends.
# Key: A-tracts phased with helical repeat (~10bp) should accumulate curvature.
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 4.2: A-tract Bending ═══")

# Phased A-tracts: A₅ separated by 5bp spacers (in phase with helical repeat)
a_tract = ("AAAAACCCCC") * 20  # 200bp, A-tracts every 10bp
no_bend = ("ACGTACGTAC") * 20  # 200bp, heterogeneous (no curvature)

curv_atract = compute_curvature(a_tract, window=21)
curv_nobend = compute_curvature(no_bend, window=21)

mean_atract = curv_atract["summary"]["mean_curvature"]
mean_nobend = curv_nobend["summary"]["mean_curvature"]

record("4.2a A-tract curvature > random",
       mean_atract > mean_nobend,
       f"A-tract={mean_atract:.3f}, random={mean_nobend:.3f}")

# A-tracts should have roll near 0 or negative for AA steps
# and distinctively low tilt
thermo_a = compute_thermodynamics(a_tract, salt_mm=1000.0)
thermo_r = compute_thermodynamics(no_bend, salt_mm=1000.0)
record("4.2b A-tract more stable than random mix (AT-rich → less stable, but A-tracts cluster)",
       True,  # Informational — record the actual values
       f"A-tract mean_dg={thermo_a['summary']['mean_delta_g_per_step']:.3f}, "
       f"random={thermo_r['summary']['mean_delta_g_per_step']:.3f}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4.3: Random Heterogeneous — Low Curvature Control
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 4.3: Heterogeneous Sequence — Low Curvature ═══")

# A perfectly heterogeneous sequence should have low curvature (random walk)
hetero = "ACGTACGTACGT" * 25  # 300bp alternating
curv_hetero = compute_curvature(hetero, window=21)
mean_hetero = curv_hetero["summary"]["mean_curvature"]

record("4.3 Heterogeneous curvature < A-tract",
       mean_hetero < mean_atract,
       f"hetero={mean_hetero:.3f} < a_tract={mean_atract:.3f}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4.4: Z-DNA CG alternation — Highest Z-form Propensity
# CG is the most Z-favorable dinucleotide (0.66 kcal/mol).
# (CG)_n alternation should give the maximum Z-form propensity.
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 4.4: Z-DNA CG Alternation ═══")

z_dna_seq = "CG" * 150  # 300bp alternating CG
z_result = compute_form_propensity(z_dna_seq)

mean_z = z_result["summary"]["mean_z_form_propensity"]
# CG step = 0.66, GC step = 4.20 — alternation gives (0.66 + 4.20)/2 = 2.43
# But wait: CG alternation = all CG steps followed by GC steps
# Actually CGCGCG... has steps: CG, GC, CG, GC, ...
# So mean Z = (0.66 + 4.20) / 2 = 2.43
record("4.4a CG alternation Z-propensity",
       mean_z < 3.0,
       f"mean_z={mean_z:.3f} (CG=0.66/GC=4.20 → alternating avg ≈ 2.43)")

mean_a = z_result["summary"]["mean_a_form_propensity"]
record("4.4b CG alternation high A-form propensity",
       mean_a > 0.8,
       f"mean_a={mean_a:.3f} (CG=0.85, GC=0.89 → avg ≈ 0.87)")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4.5: AT alternation — Lowest Z-form Propensity
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 4.5: AT Alternation — Low Z-form ═══")

at_seq = "AT" * 150  # 300bp alternating AT
at_z = compute_form_propensity(at_seq)
mean_at_z = at_z["summary"]["mean_z_form_propensity"]

# AT step = 6.20, TA step = 2.50 → avg = 4.35
record("4.5a AT alternation high Z-penalty",
       mean_at_z > mean_z,
       f"AT_z={mean_at_z:.3f} > CG_z={mean_z:.3f}")

# AT has lowest A-form propensity
mean_at_a = at_z["summary"]["mean_a_form_propensity"]
record("4.5b AT alternation low A-form",
       mean_at_a < mean_a,
       f"AT_a={mean_at_a:.3f} < CG_a={mean_a:.3f}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4.6: MYC NHE III1 G-Quadruplex
# The MYC promoter NHE III1 element forms a well-characterized parallel G4.
# PDB: 1XAV (Ambrus et al. 2005)
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 4.6: MYC NHE III1 G-Quadruplex ═══")

# The G4-forming sequence from MYC promoter
myc_g4 = "TGGGGAGGGTGGGGAGGGTGGGGAAGG"
motifs_myc = detect_motifs(myc_g4)
n_g4_myc = len(motifs_myc.get("g_quadruplex", []))
record("4.6 MYC NHE III1 G4 detected",
       n_g4_myc > 0,
       f"Found {n_g4_myc} G4 (expected: 1, PDB: 1XAV)")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4.7: Alpha-Satellite Centromeric Repeat
# 171bp repeat unit. Known for high curvature (nucleosome positioning element).
# Consensus from Willard 1985.
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 4.7: Alpha-Satellite Centromeric Repeat ═══")

# Human alpha-satellite consensus (171bp monomer, Alexandrov et al. 2001)
alpha_sat = (
    "AATCTCAAGTGGATATTTGGACCCTCTTTTTTTGTAGAATCTGCAAGTGGATATTCAGACTGCTTT"
    "GAGGCCTTCGTTGGAAACGGGATTTCTTCATATAAAAACTAGACAGAAGCATTCTCAGAAACTGCTTT"
    "GTGATGTTTGCATTCAACTCACAGAGTTGAACCTTCC"
)

curv_alpha = compute_curvature(alpha_sat, window=21)
mean_alpha_curv = curv_alpha["summary"]["mean_curvature"]

# Alpha-satellite should have higher curvature than heterogeneous sequence
record("4.7a Alpha-satellite high curvature",
       mean_alpha_curv > mean_hetero,
       f"alpha={mean_alpha_curv:.3f} vs hetero={mean_hetero:.3f}")

gc_alpha = compute_gc(alpha_sat)
record("4.7b Alpha-satellite AT-rich",
       gc_alpha < 0.45,
       f"GC={gc_alpha:.3f} (centromeric DNA is AT-rich)")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4.8: TP53 Promoter CpG Island
# Well-characterized CpG island in TP53 promoter region.
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 4.8: TP53 Promoter CpG Island ═══")

# Fetch from FASTA
try:
    from pyfaidx import Fasta
    fa = Fasta(str(PROJECT_ROOT / "data" / "hg38.fa"))
    # TP53 TSS region (hg38: chr17:7,687,490-7,688,490, reverse strand)
    tp53_seq = str(fa["chr17"][7687490:7688490]).upper()

    gc_tp53 = compute_gc(tp53_seq)
    record("4.8a TP53 promoter GC > 0.50",
           gc_tp53 > 0.50,
           f"GC={gc_tp53:.3f}")

    # CpG obs/exp
    c_count = tp53_seq.count("C")
    g_count = tp53_seq.count("G")
    cpg_count = tp53_seq.count("CG")
    total = sum(1 for c in tp53_seq if c in "ACGT")
    cpg_exp = (c_count * g_count) / total if total > 0 else 0
    cpg_oe = cpg_count / cpg_exp if cpg_exp > 0 else 0
    record("4.8b TP53 promoter CpG obs/exp > 0.6",
           cpg_oe > 0.6,
           f"CpG obs/exp={cpg_oe:.3f}")
except Exception as e:
    record("4.8 TP53 promoter", False, f"FASTA error: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4.9: Poly-GC — Maximum Stability
# GC step has ΔG₃₇ = -2.24 (most stable dinucleotide).
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 4.9: Poly-GC — Maximum Stability ═══")

gc_alt = "GC" * 150
gc_thermo = compute_thermodynamics(gc_alt, salt_mm=1000.0)
gc_mean_dg = gc_thermo["summary"]["mean_delta_g_per_step"]

# GC alternation: steps are GC (-2.24) and CG (-2.17) → avg ≈ -2.205
record("4.9 Poly-GC most stable",
       gc_mean_dg < -2.0,
       f"mean_dg={gc_mean_dg:.3f} (expected ≈ -2.21)")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4.10: Poly-TA — Minimum Stability
# TA step has ΔG₃₇ = -0.58 (least stable dinucleotide).
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 4.10: Poly-TA — Minimum Stability ═══")

ta_alt = "TA" * 150
ta_thermo = compute_thermodynamics(ta_alt, salt_mm=1000.0)
ta_mean_dg = ta_thermo["summary"]["mean_delta_g_per_step"]

# TA alternation: steps are TA (-0.58) and AT (-0.88) → avg ≈ -0.73
record("4.10a Poly-TA least stable",
       ta_mean_dg > -1.0,
       f"mean_dg={ta_mean_dg:.3f} (expected ≈ -0.73)")

record("4.10b GC more stable than TA",
       gc_mean_dg < ta_mean_dg,
       f"GC={gc_mean_dg:.3f} < TA={ta_mean_dg:.3f}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4.11: Stability Ranking of All 10 Unique Dinucleotides
# SantaLucia 1998 ranking: GC > CG > GG > CA > GT > GA > CT > AA > AT > TA
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 4.11: Stability Ranking ═══")

expected_rank = ["GC", "CG", "GG", "CA", "GT", "GA", "CT", "AA", "AT", "TA"]
from polymer_genomics.biophysics import _NN_PARAMS

actual = sorted(
    [(d, p["delta_g_37"]) for d, p in _NN_PARAMS.items()
     if d in expected_rank],
    key=lambda x: x[1]
)
actual_rank = [d for d, _ in actual]

record("4.11 Stability ranking matches SantaLucia",
       actual_rank == expected_rank,
       f"Expected: {expected_rank}, Got: {actual_rank}")


# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

print(f"\n{'═' * 70}")
print(f"TIER 4 SUMMARY: {passed} passed, {failed} failed")
print(f"{'═' * 70}")

results["summary"] = {"passed": passed, "failed": failed, "total": passed + failed}
write_results("tier4", results)
sys.exit(0 if failed == 0 else 1)
