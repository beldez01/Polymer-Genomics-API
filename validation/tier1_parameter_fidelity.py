#!/usr/bin/env python3
"""Tier 1: Parameter Fidelity — verify all hardcoded constants against published values.

Every number in the API must trace back to a published paper. This script checks
each parameter table against independently transcribed values from the original
publications. No database access, no API calls — pure arithmetic.

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python validation/tier1_parameter_fidelity.py
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT))

from validation.common import print_test, write_results

# ═══════════════════════════════════════════════════════════════════════════════
# Import the API's parameter tables
# ═══════════════════════════════════════════════════════════════════════════════

from polymer_genomics.ingest.reference_constants import (
    _A_FORM_PROPENSITY,
    _GROOVE_GEOMETRY,
    _SANTALUCIA_1998_DNA_DNA,
    _SUGIMOTO_1995_RNA_DNA,
    _TATAUROV_EXTINCTION,
    _XIA_TURNER_1998_RNA_RNA,
    _Z_FORM_PROPENSITY,
)
from polymer_genomics.biophysics import (
    _NN_PARAMS,
    _OLSON_STRUCTURAL,
    _TRX_DEFORMABILITY,
    compute_thermodynamics,
)

passed = 0
failed = 0
results = {"tier": "1", "name": "Parameter Fidelity", "tests": []}


def record(name: str, ok: bool, detail: str = ""):
    global passed, failed
    if ok:
        passed += 1
    else:
        failed += 1
    print_test(name, ok, detail)
    results["tests"].append({"name": name, "passed": ok, "detail": detail})


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.1: SantaLucia 1998 DNA/DNA — Table 2 of PNAS 95:1460-1465
# Independently transcribed from the paper. 10 unique dinucleotides
# (the other 6 are reverse complements with identical parameters).
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.1: SantaLucia 1998 DNA/DNA (10 unique dinuc) ═══")

# Ground truth from SantaLucia 1998, Table 2
# Format: (dinucleotide_5to3, ΔH° kcal/mol, ΔS° cal/mol·K, ΔG°₃₇ kcal/mol)
SANTALUCIA_GROUND_TRUTH = {
    "AA": (-7.9, -22.2, -1.0),
    "AT": (-7.2, -20.4, -0.88),
    "TA": (-7.2, -21.3, -0.58),
    "CA": (-8.5, -22.7, -1.45),
    "GT": (-8.4, -22.4, -1.44),
    "CT": (-7.8, -21.0, -1.28),
    "GA": (-8.2, -22.2, -1.30),
    "CG": (-10.6, -27.2, -2.17),
    "GC": (-9.8, -24.4, -2.24),
    "GG": (-8.0, -19.9, -1.84),
}

# Build lookup from API's list
api_sl = {}
for dinuc, dh, ds, dg in _SANTALUCIA_1998_DNA_DNA:
    api_sl[dinuc] = (dh, ds, dg)

for dinuc, (gt_dh, gt_ds, gt_dg) in SANTALUCIA_GROUND_TRUTH.items():
    api_vals = api_sl.get(dinuc)
    if api_vals is None:
        record(f"1.1 SantaLucia {dinuc}", False, "missing from API")
        continue
    api_dh, api_ds, api_dg = api_vals
    ok_dh = abs(api_dh - gt_dh) < 0.01
    ok_ds = abs(api_ds - gt_ds) < 0.01
    ok_dg = abs(api_dg - gt_dg) < 0.01
    all_ok = ok_dh and ok_ds and ok_dg
    detail = f"ΔH={api_dh}({gt_dh}) ΔS={api_ds}({gt_ds}) ΔG={api_dg}({gt_dg})"
    record(f"1.1 SantaLucia DNA/DNA {dinuc}", all_ok, detail if not all_ok else "")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.2: Xia/Turner 1998 RNA/RNA — Biochemistry 37:14719-14735
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.2: Xia/Turner 1998 RNA/RNA (16 dinuc) ═══")

# Ground truth from Xia & Turner 1998, Table 2
XIA_GROUND_TRUTH = {
    "AA": (-6.82, -19.0, -0.93),
    "AC": (-11.40, -29.5, -2.24),
    "AG": (-10.48, -27.1, -2.08),
    "AU": (-9.38, -26.7, -1.10),
    "CA": (-10.44, -26.9, -2.11),
    "CC": (-13.39, -32.7, -3.26),
    "CG": (-10.64, -26.7, -2.36),
    "CU": (-10.48, -27.1, -2.08),
    "GA": (-12.44, -32.5, -2.35),
    "GC": (-14.88, -36.9, -3.42),
    "GG": (-13.39, -32.7, -3.26),
    "GU": (-11.40, -29.5, -2.24),
    "UA": (-7.69, -20.5, -1.33),
    "UC": (-12.44, -32.5, -2.35),
    "UG": (-10.44, -26.9, -2.11),
    "UU": (-6.82, -19.0, -0.93),
}

api_xia = {}
for dinuc, dh, ds, dg in _XIA_TURNER_1998_RNA_RNA:
    api_xia[dinuc] = (dh, ds, dg)

for dinuc, (gt_dh, gt_ds, gt_dg) in XIA_GROUND_TRUTH.items():
    api_vals = api_xia.get(dinuc)
    if api_vals is None:
        record(f"1.2 Xia RNA/RNA {dinuc}", False, "missing from API")
        continue
    ok = (abs(api_vals[0] - gt_dh) < 0.01 and
          abs(api_vals[1] - gt_ds) < 0.01 and
          abs(api_vals[2] - gt_dg) < 0.01)
    record(f"1.2 Xia RNA/RNA {dinuc}", ok,
           f"API={api_vals} GT={gt_dh},{gt_ds},{gt_dg}" if not ok else "")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.3: Sugimoto 1995 RNA/DNA — Biochemistry 34:11211-11216
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.3: Sugimoto 1995 RNA/DNA (16 dinuc) ═══")

SUGIMOTO_GROUND_TRUTH = {
    "AA": (-7.8, -21.9, -1.0),
    "AC": (-5.9, -12.3, -2.1),
    "AG": (-9.1, -23.5, -1.8),
    "AU": (-8.3, -23.9, -0.9),
    "CA": (-9.0, -26.1, -0.9),
    "CC": (-9.3, -23.2, -2.1),
    "CG": (-16.3, -47.1, -1.7),
    "CU": (-7.0, -19.7, -0.9),
    "GA": (-5.5, -13.5, -1.3),
    "GC": (-8.0, -17.1, -2.7),
    "GG": (-12.8, -31.9, -2.9),
    "GU": (-7.8, -21.6, -1.1),
    "UA": (-7.8, -23.2, -0.6),
    "UC": (-8.6, -22.9, -1.5),
    "UG": (-10.4, -28.4, -1.6),
    "UU": (-11.5, -36.4, -0.2),
}

api_sug = {}
for dinuc, dh, ds, dg in _SUGIMOTO_1995_RNA_DNA:
    api_sug[dinuc] = (dh, ds, dg)

for dinuc, (gt_dh, gt_ds, gt_dg) in SUGIMOTO_GROUND_TRUTH.items():
    api_vals = api_sug.get(dinuc)
    if api_vals is None:
        record(f"1.3 Sugimoto RNA/DNA {dinuc}", False, "missing from API")
        continue
    ok = (abs(api_vals[0] - gt_dh) < 0.01 and
          abs(api_vals[1] - gt_ds) < 0.01 and
          abs(api_vals[2] - gt_dg) < 0.01)
    record(f"1.3 Sugimoto RNA/DNA {dinuc}", ok,
           f"API={api_vals} GT={gt_dh},{gt_ds},{gt_dg}" if not ok else "")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.4: Olson 1998 Structural Parameters
# J Mol Biol 1998;313:229-257, Table 2
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.4: Olson 1998 Structural Parameters (16 dinuc) ═══")

# Ground truth from Olson et al. 1998
# (roll°, tilt°, twist°, rise Å, slide Å, shift Å)
OLSON_GROUND_TRUTH = {
    "AA": (0.7, -1.0, 35.6, 3.33, -0.08, 0.00),
    "AC": (4.8, 0.1, 34.4, 3.38, -0.06, 0.43),
    "AG": (2.5, -0.1, 27.7, 3.38, 0.27, -0.04),
    "AT": (-2.4, 0.0, 31.5, 3.34, -0.55, 0.00),
    "CA": (6.5, 0.5, 34.5, 3.35, 0.49, 0.46),
    "CC": (1.6, -0.1, 33.7, 3.38, 0.17, 0.10),
    "CG": (3.5, 0.0, 29.8, 3.42, 0.26, 0.00),
    "CT": (2.5, -0.1, 27.7, 3.38, 0.27, 0.04),
    "GA": (0.7, 0.7, 36.9, 3.38, -0.01, -0.03),
    "GC": (-6.2, 0.0, 40.0, 3.36, -0.46, 0.00),
    "GG": (1.6, 0.1, 33.7, 3.38, 0.17, -0.10),
    "GT": (4.8, -0.1, 34.4, 3.38, -0.06, -0.43),
    "TA": (1.4, 0.0, 36.0, 3.37, 0.19, 0.00),
    "TC": (0.7, -0.7, 36.9, 3.38, -0.01, 0.03),
    "TG": (6.5, -0.5, 34.5, 3.35, 0.49, -0.46),
    "TT": (0.7, 1.0, 35.6, 3.33, -0.08, 0.00),
}

keys = ["roll", "tilt", "twist", "rise", "slide", "shift"]
for dinuc, gt_vals in OLSON_GROUND_TRUTH.items():
    api_struct = _OLSON_STRUCTURAL.get(dinuc)
    if api_struct is None:
        record(f"1.4 Olson {dinuc}", False, "missing from API")
        continue
    all_ok = True
    mismatches = []
    for i, key in enumerate(keys):
        api_val = api_struct[key]
        gt_val = gt_vals[i]
        if abs(api_val - gt_val) > 0.05:
            all_ok = False
            mismatches.append(f"{key}: API={api_val} GT={gt_val}")
    record(f"1.4 Olson structural {dinuc}", all_ok,
           "; ".join(mismatches) if mismatches else "")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.5: Heddi 2010 TRX Deformability (%BII)
# NAR 2010;38:6001-6012
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.5: Heddi TRX Deformability (16 dinuc) ═══")

# Ground truth: %BII backbone conformer population
# Heddi et al. 2010, NMR + MD simulations
HEDDI_GROUND_TRUTH = {
    "AA": 5,  "AC": 10, "AG": 10, "AT": 0,
    "CA": 42, "CC": 42, "CG": 43, "CT": 10,
    "GA": 22, "GC": 10, "GG": 42, "GT": 10,
    "TA": 14, "TC": 22, "TG": 42, "TT": 5,
}

for dinuc, gt_val in HEDDI_GROUND_TRUTH.items():
    api_val = _TRX_DEFORMABILITY.get(dinuc)
    if api_val is None:
        record(f"1.5 Heddi TRX {dinuc}", False, "missing from API")
        continue
    ok = api_val == gt_val
    record(f"1.5 Heddi TRX {dinuc}", ok,
           f"API={api_val} GT={gt_val}" if not ok else "")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.6: Tataurov 2008 Extinction Coefficients
# Biophys Chem 2008;133:66-70
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.6: Tataurov Extinction ε260 (16 dinuc) ═══")

TATAUROV_GROUND_TRUTH = {
    "AA": 27400, "AC": 21200, "AG": 25000, "AT": 22800,
    "CA": 21200, "CC": 14600, "CG": 18000, "CT": 15200,
    "GA": 25200, "GC": 17600, "GG": 21600, "GT": 20000,
    "TA": 23400, "TC": 19000, "TG": 19000, "TT": 16800,
}

for dinuc, gt_val in TATAUROV_GROUND_TRUTH.items():
    api_val = _TATAUROV_EXTINCTION.get(dinuc)
    if api_val is None:
        record(f"1.6 Tataurov ε260 {dinuc}", False, "missing from API")
        continue
    ok = api_val == gt_val
    record(f"1.6 Tataurov ε260 {dinuc}", ok,
           f"API={api_val} GT={gt_val}" if not ok else "")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.7: Z-form Propensity (Ho 1986 / Ellison 1985 / Z-Hunt)
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.7: Z-form Propensity (16 dinuc) ═══")

ZFORM_GROUND_TRUTH = {
    "CG": 0.66, "CA": 1.40, "TG": 1.40, "CC": 2.40,
    "GG": 2.40, "TA": 2.50, "GA": 3.30, "TC": 3.30,
    "AG": 3.40, "CT": 3.40, "GC": 4.20, "AA": 4.40,
    "TT": 4.40, "AC": 5.20, "GT": 5.20, "AT": 6.20,
}

for dinuc, gt_val in ZFORM_GROUND_TRUTH.items():
    api_val = _Z_FORM_PROPENSITY.get(dinuc)
    if api_val is None:
        record(f"1.7 Z-form {dinuc}", False, "missing from API")
        continue
    ok = abs(api_val - gt_val) < 0.01
    record(f"1.7 Z-form propensity {dinuc}", ok,
           f"API={api_val} GT={gt_val}" if not ok else "")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.8: A-form Propensity (El Hassan & Calladine 1996)
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.8: A-form Propensity (16 dinuc) ═══")

AFORM_GROUND_TRUTH = {
    "GG": 0.92, "GC": 0.89, "CC": 0.88, "CG": 0.85,
    "GA": 0.74, "TC": 0.74, "AG": 0.68, "CT": 0.68,
    "AC": 0.60, "GT": 0.60, "CA": 0.52, "TG": 0.52,
    "AT": 0.42, "TA": 0.34, "AA": 0.28, "TT": 0.28,
}

for dinuc, gt_val in AFORM_GROUND_TRUTH.items():
    api_val = _A_FORM_PROPENSITY.get(dinuc)
    if api_val is None:
        record(f"1.8 A-form {dinuc}", False, "missing from API")
        continue
    ok = abs(api_val - gt_val) < 0.01
    record(f"1.8 A-form propensity {dinuc}", ok,
           f"API={api_val} GT={gt_val}" if not ok else "")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.9: Groove Geometry — spot-check 5 dinucleotides
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.9: Groove Geometry (spot-check) ═══")

# (major_w, major_d, minor_w, minor_d) in Angstroms
GROOVE_GROUND_TRUTH = {
    "AT": (11.6, 8.5, 4.8, 8.0),
    "CG": (11.2, 8.5, 5.5, 7.5),
    "TA": (12.0, 8.0, 6.2, 7.0),
    "GC": (11.0, 8.5, 5.0, 7.5),
    "AA": (11.7, 8.5, 5.7, 7.5),
}

for dinuc, gt_vals in GROOVE_GROUND_TRUTH.items():
    api_vals = _GROOVE_GEOMETRY.get(dinuc)
    if api_vals is None:
        record(f"1.9 Groove {dinuc}", False, "missing from API")
        continue
    ok = all(abs(a - g) < 0.2 for a, g in zip(api_vals, gt_vals))
    record(f"1.9 Groove geometry {dinuc}", ok,
           f"API={api_vals} GT={gt_vals}" if not ok else "")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.10: Reverse Complement Symmetry
# ΔG(seq) should equal ΔG(revcomp) for any sequence.
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.10: Reverse Complement Symmetry (100 random seqs) ═══")

COMP = str.maketrans("ACGT", "TGCA")
rng = random.Random(42)

max_diff = 0.0
n_sym_fail = 0
for i in range(100):
    length = rng.randint(50, 1000)
    seq = "".join(rng.choice("ACGT") for _ in range(length))
    revcomp = seq[::-1].translate(COMP)

    r_fwd = compute_thermodynamics(seq, salt_mm=1000.0)
    r_rev = compute_thermodynamics(revcomp, salt_mm=1000.0)

    dg_fwd = r_fwd["summary"]["total_delta_g_37"]
    dg_rev = r_rev["summary"]["total_delta_g_37"]
    diff = abs(dg_fwd - dg_rev)
    max_diff = max(max_diff, diff)
    if diff > 0.001:
        n_sym_fail += 1

record("1.10 RC symmetry (100 seqs)", n_sym_fail == 0,
       f"max |ΔΔG|={max_diff:.6f}, failures={n_sym_fail}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.11: Tm Benchmark — Owczarzy 2004/2008 measured oligonucleotide Tm
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.11: Tm Benchmark (Owczarzy oligos) ═══")

# Oligonucleotides with experimentally measured Tm (1M NaCl, self-complementary
# or non-self-complementary at known concentration).
# Source: SantaLucia 1998 Table 3 + Owczarzy 2004 Table 1
# The SantaLucia Tm formula for non-self-complementary:
#   Tm = ΔH / (ΔS + R × ln(Ct/4)) - 273.15
# where R = 1.987 cal/mol·K, Ct = total strand concentration (typically 100 µM)
# For self-complementary:
#   Tm = ΔH / (ΔS + R × ln(Ct)) - 273.15

R_CAL = 1.987  # cal/mol·K
CT = 100e-6    # 100 µM total strand concentration (standard)

# Initiation parameters (SantaLucia 1998, Table 4)
# For sequences with at least one GC terminus:
INIT_GC = {"dh": 0.1, "ds": -2.8}   # kcal/mol, cal/mol·K
INIT_AT = {"dh": 2.3, "ds": 4.1}


def predict_tm(seq: str, self_comp: bool = False) -> float:
    """Predict Tm using full SantaLucia 1998 model with initiation parameters."""
    result = compute_thermodynamics(seq.upper(), salt_mm=1000.0)
    s = result["summary"]
    if s["n_steps"] == 0:
        return 0.0

    total_dh = s["total_delta_h"]  # kcal/mol
    total_ds = s["total_delta_s"]  # cal/mol·K

    # Add initiation parameters
    seq_upper = seq.upper()
    # Check terminal base pairs
    first_bp = seq_upper[0]
    last_bp = seq_upper[-1]

    # Each end contributes one initiation term
    for bp in (first_bp, last_bp):
        if bp in "GC":
            total_dh += INIT_GC["dh"]
            total_ds += INIT_GC["ds"]
        else:
            total_dh += INIT_AT["dh"]
            total_ds += INIT_AT["ds"]

    # Convert ΔH to cal/mol for consistent units with ΔS
    dh_cal = total_dh * 1000.0

    if self_comp:
        tm = dh_cal / (total_ds + R_CAL * math.log(CT)) - 273.15
    else:
        tm = dh_cal / (total_ds + R_CAL * math.log(CT / 4.0)) - 273.15

    return tm


# Benchmark oligonucleotides with measured Tm at 1M NaCl
# Sources: SantaLucia 1998 Table 3 (compilation of published data),
#          Allawi & SantaLucia 1997 Biochemistry 36:10581 (original measurements)
# All at ~100 µM strand concentration, 1M NaCl
TM_BENCHMARK = [
    # (sequence, measured_Tm_°C, self_complementary, source_note)
    ("CGCATGCTAC", 44.2, False, "SL98 Table 3"),
    ("GCATGC", 36.0, True, "SL98 Table 3"),
    ("CCAACTTGAT", 30.2, False, "SL98 Table 3"),
    ("AGAAAGAGAGG", 34.0, False, "SL98 Table 3"),
    ("GACGACAAGC", 42.6, False, "SL98 Table 3"),
    ("CTCGGATCCA", 42.0, False, "SL98 Table 3"),
    ("ATGCTGATGC", 38.5, False, "SL98 Table 3"),
    ("GGCAGGCC", 54.0, True, "SL98 Table 3"),
    ("AGCGCT", 40.0, True, "SL98 Table 3"),
    ("CCATCGCTACC", 46.0, False, "SL98 Table 3"),
    ("CGATCG", 42.0, True, "SL98 Table 3"),
    ("TAAATATA", 8.0, False, "SL98 Table 3"),
    ("GCGCGC", 56.0, True, "SL98 Table 3"),
    ("AATATAAT", 5.0, True, "SL98 Table 3"),
    ("GCGATCGC", 56.0, True, "SL98 Table 3"),
    ("CAAAGAAAG", 20.0, False, "SL98 Table 3"),
    ("TGAGCTTGA", 28.8, False, "SL98 Table 3"),
    ("GGACTCCTG", 38.0, False, "SL98 Table 3"),
    ("ACGTACGT", 30.0, True, "SL98 Table 3"),
    ("GCCAGTTAA", 27.0, False, "SL98 Table 3"),
]

errors_sq = []
for seq, measured_tm, self_comp, source in TM_BENCHMARK:
    predicted = predict_tm(seq, self_comp)
    error = predicted - measured_tm
    errors_sq.append(error ** 2)
    ok = abs(error) < 5.0  # individual tolerance: 5°C
    record(f"1.11 Tm {seq[:12]}... measured={measured_tm:.1f}°C pred={predicted:.1f}°C",
           ok, f"error={error:+.1f}°C" if not ok else f"Δ={error:+.1f}°C")

rmse = math.sqrt(sum(errors_sq) / len(errors_sq)) if errors_sq else float("inf")
record(f"1.11 OVERALL Tm RMSE", rmse < 5.0,
       f"RMSE={rmse:.2f}°C (target <5.0°C, ideal <2.0°C)")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.12: Salt Correction Monotonicity
# Lower salt → less negative ΔG (less stable) for any sequence.
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.12: Salt Correction Monotonicity ═══")

SALT_TEST_SEQS = [
    "GCGCGCGCGCGCGCGCGCGC",   # GC-rich
    "ATATATATATATATATATATAT",   # AT-rich
    "ACGTACGTACGTACGTACGT",     # Mixed
    "CGATCGATCGATCGATCGAT",     # Another mixed
    "TTTTTTTTTTTTTTTTTTTTT",    # Poly-T (homopolymer)
]

SALTS = [50.0, 150.0, 500.0, 1000.0]

for seq in SALT_TEST_SEQS:
    dgs = []
    for salt in SALTS:
        r = compute_thermodynamics(seq, salt_mm=salt)
        dgs.append(r["summary"]["total_delta_g_salt"])
    # ΔG should become more negative (more stable) with increasing salt
    monotonic = all(dgs[i] >= dgs[i + 1] for i in range(len(dgs) - 1))
    record(f"1.12 Salt monotonicity {seq[:15]}...",
           monotonic,
           f"ΔGs at {SALTS}: {[round(x, 2) for x in dgs]}" if not monotonic else "")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.13: Internal Consistency — ΔG₃₇ = ΔH - 310.15 × ΔS/1000
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.13: ΔG = ΔH - TΔS Internal Consistency (all 48 entries) ═══")

T = 310.15  # 37°C in Kelvin

all_params = [
    ("DNA/DNA", _SANTALUCIA_1998_DNA_DNA),
    ("RNA/RNA", _XIA_TURNER_1998_RNA_RNA),
    ("RNA/DNA", _SUGIMOTO_1995_RNA_DNA),
]

max_inconsistency = 0.0
n_inconsistent = 0
for duplex_type, params in all_params:
    for dinuc, dh, ds, dg in params:
        # ΔG = ΔH (kcal/mol) - T × ΔS (cal/mol·K) / 1000
        computed_dg = dh - T * ds / 1000.0
        diff = abs(computed_dg - dg)
        max_inconsistency = max(max_inconsistency, diff)
        if diff > 0.02:  # allow small rounding
            n_inconsistent += 1
            record(f"1.13 ΔG consistency {duplex_type} {dinuc}", False,
                   f"stored={dg} computed={computed_dg:.3f} diff={diff:.4f}")

record(f"1.13 OVERALL ΔG=ΔH-TΔS consistency ({48 - n_inconsistent}/48)",
       n_inconsistent == 0,
       f"max inconsistency={max_inconsistency:.4f} kcal/mol")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1.14: Complement pair consistency
# RC pairs should have identical ΔH, ΔS, ΔG (by symmetry of Watson-Crick)
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 1.14: Complement Pair Consistency ═══")

RC_PAIRS = [("AA", "TT"), ("CA", "TG"), ("GT", "AC"),
            ("CT", "AG"), ("GA", "TC"), ("GG", "CC")]

for d1, d2 in RC_PAIRS:
    v1 = api_sl.get(d1)
    v2 = api_sl.get(d2)
    if v1 is None or v2 is None:
        record(f"1.14 RC pair {d1}/{d2}", False, "missing")
        continue
    ok = all(abs(a - b) < 0.01 for a, b in zip(v1, v2))
    record(f"1.14 RC pair {d1}/{d2}", ok,
           f"{d1}={v1} {d2}={v2}" if not ok else "")


# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

print("\n" + "═" * 70)
print(f"TIER 1 SUMMARY: {passed} passed, {failed} failed")
print("═" * 70)

results["summary"] = {
    "passed": passed,
    "failed": failed,
    "total": passed + failed,
    "tm_rmse": round(rmse, 2),
    "rc_symmetry_max_diff": round(max_diff, 6),
    "dg_consistency_max": round(max_inconsistency, 4),
}

write_results("tier1", results)
sys.exit(0 if failed == 0 else 1)
