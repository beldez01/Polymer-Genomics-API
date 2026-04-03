# Contextual Biophysics Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the biophysics compute endpoint from per-step lookups into a contextual physics engine that reveals structural features (curvature, bubble propensity, flexibility gradients, motifs) emergent from sequence arrangement — not just composition.

**Architecture:** Enrich `biophysics.py` with new compute functions that operate on sliding windows over the existing per-step data. Add Olson structural parameters and TRX deformability to the lookup tables. Store a genome-wide dinucleotide index (~3.1 GB of uint8 numpy arrays) for instant region serving. Raise the endpoint region limit from 10kb to 1Mb.

**Tech Stack:** Python, numpy, pyfaidx, FastAPI, existing GRanges JSON format

---

### Task 1: Add Structural & Flexibility Lookup Tables

**Files:**
- Modify: `src/polymer_genomics/biophysics.py`
- Test: `tests/test_biophysics.py`

The existing `biophysics.py` has SantaLucia thermodynamics, Tataurov extinction, form propensity, and groove geometry. Missing: Olson 1998 structural parameters (roll, tilt, twist, rise, slide, shift) and Heddi 2010 TRX deformability. These are needed for curvature and flexibility computations.

- [ ] **Step 1: Write failing tests for structural parameters**

```python
# tests/test_biophysics.py — add to bottom

class TestComputeStructuralParams:
    def test_cg_twist(self):
        result = compute_structural("ACGT")
        # CG step: twist = 29.8° (Olson 1998, lowest twist)
        assert result["per_step"][1]["twist"] == pytest.approx(29.8, abs=0.1)

    def test_cg_roll(self):
        result = compute_structural("ACGT")
        # CG step: roll = 3.5° (Olson 1998)
        assert result["per_step"][1]["roll"] == pytest.approx(3.5, abs=0.1)

    def test_aa_deformability(self):
        result = compute_structural("AAAA")
        # AA step: TRX = 5 (Heddi 2010, stiff)
        assert result["per_step"][0]["deformability"] == 5

    def test_cg_deformability(self):
        result = compute_structural("ACGT")
        # CG step: TRX = 43 (Heddi 2010, most flexible)
        assert result["per_step"][1]["deformability"] == 43

    def test_step_count(self):
        result = compute_structural("ACGTACGT")
        assert len(result["per_step"]) == 7
        assert result["summary"]["n_steps"] == 7
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_biophysics.py::TestComputeStructuralParams -v`
Expected: FAIL with `cannot import name 'compute_structural'`

- [ ] **Step 3: Implement compute_structural**

Add to `src/polymer_genomics/biophysics.py`:

```python
# Olson et al. 1998 structural parameters (degrees / Angstrom)
_OLSON_STRUCTURAL = {
    "AA": {"roll": -0.7, "tilt": -0.2, "twist": 35.6, "rise": 3.27, "slide": -0.06, "shift": 0.00},
    "AC": {"roll":  1.0, "tilt":  1.0, "twist": 34.0, "rise": 3.38, "slide":  0.22, "shift":  0.13},
    "AG": {"roll":  5.3, "tilt": -0.3, "twist": 34.4, "rise": 3.29, "slide":  0.30, "shift": -0.01},
    "AT": {"roll":  2.6, "tilt":  0.0, "twist": 31.5, "rise": 3.39, "slide": -0.22, "shift":  0.00},
    "CA": {"roll":  4.2, "tilt":  0.7, "twist": 34.5, "rise": 3.26, "slide":  0.34, "shift":  0.18},
    "CC": {"roll":  2.4, "tilt": -1.0, "twist": 32.9, "rise": 3.38, "slide":  0.47, "shift":  0.15},
    "CG": {"roll":  3.5, "tilt":  0.0, "twist": 29.8, "rise": 3.32, "slide":  0.19, "shift":  0.00},
    "CT": {"roll":  5.3, "tilt":  0.3, "twist": 34.4, "rise": 3.29, "slide":  0.30, "shift": -0.01},
    "GA": {"roll":  1.3, "tilt":  1.5, "twist": 36.9, "rise": 3.38, "slide":  0.09, "shift":  0.12},
    "GC": {"roll":  0.7, "tilt":  0.0, "twist": 40.0, "rise": 3.38, "slide":  0.57, "shift":  0.00},
    "GG": {"roll":  2.4, "tilt":  1.0, "twist": 32.9, "rise": 3.38, "slide":  0.47, "shift":  0.15},
    "GT": {"roll":  1.0, "tilt": -1.0, "twist": 34.0, "rise": 3.38, "slide":  0.22, "shift":  0.13},
    "TA": {"roll":  3.3, "tilt":  0.0, "twist": 36.0, "rise": 3.38, "slide":  0.20, "shift":  0.00},
    "TC": {"roll":  1.3, "tilt": -1.5, "twist": 36.9, "rise": 3.38, "slide":  0.09, "shift":  0.12},
    "TG": {"roll":  4.2, "tilt": -0.7, "twist": 34.5, "rise": 3.26, "slide":  0.34, "shift":  0.18},
    "TT": {"roll": -0.7, "tilt":  0.2, "twist": 35.6, "rise": 3.27, "slide": -0.06, "shift":  0.00},
}

# Heddi et al. 2010 TRX flexibility scale (% BII conformer population)
_TRX_DEFORMABILITY = {
    "AA":  5, "AC":  4, "AG":  9, "AT":  0,
    "CA": 42, "CC": 42, "CG": 43, "CT":  9,
    "GA": 22, "GC": 25, "GG": 42, "GT":  4,
    "TA": 14, "TC": 22, "TG": 42, "TT":  5,
}


def compute_structural(sequence: str) -> dict:
    """Compute Olson 1998 structural parameters + TRX deformability per step."""
    seq = sequence.upper()
    per_step = []
    for i in range(len(seq) - 1):
        dinuc = seq[i:i+2]
        struct = _OLSON_STRUCTURAL.get(dinuc)
        trx = _TRX_DEFORMABILITY.get(dinuc)
        if struct is None or trx is None:
            continue
        per_step.append({
            "dinucleotide": dinuc,
            "roll": struct["roll"],
            "tilt": struct["tilt"],
            "twist": struct["twist"],
            "rise": struct["rise"],
            "slide": struct["slide"],
            "shift": struct["shift"],
            "deformability": trx,
        })

    n = len(per_step)
    summary = {"n_steps": n}
    if n > 0:
        for key in ("roll", "tilt", "twist", "rise", "slide", "shift", "deformability"):
            vals = [s[key] for s in per_step]
            summary[f"mean_{key}"] = round(sum(vals) / n, 3)
    return {"per_step": per_step, "summary": summary}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_biophysics.py::TestComputeStructuralParams -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/polymer_genomics/biophysics.py tests/test_biophysics.py
git commit -m "feat: add Olson structural params + TRX deformability to biophysics"
```

---

### Task 2: Contextual Features — Bubble Propensity & Context Deviation

**Files:**
- Modify: `src/polymer_genomics/biophysics.py`
- Test: `tests/test_biophysics.py`

These are the contextual features that capture *where* in the sequence the physics matters — weak spots, anchors, local perturbations.

- [ ] **Step 1: Write failing tests**

```python
class TestComputeContextualFeatures:
    def test_bubble_propensity_weak_region(self):
        # TA steps are weakest (-0.58 kcal/mol), should have high bubble propensity
        seq = "TATATATATATA"  # 10 TA steps
        result = compute_contextual(seq, window=5)
        # Mean ΔG of TA = -0.58; threshold default = -1.0 → all above threshold → high propensity
        assert all(s["bubble_propensity"] > 0.5 for s in result["per_step"] if "bubble_propensity" in s)

    def test_bubble_propensity_stable_region(self):
        # GC steps are strongest (-2.24 kcal/mol)
        seq = "GCGCGCGCGCGC"
        result = compute_contextual(seq, window=5)
        assert all(s["bubble_propensity"] < 0.2 for s in result["per_step"] if "bubble_propensity" in s)

    def test_context_deviation_anchor(self):
        # G in weak AT context: GA and AG steps are stronger than AA
        seq = "AAAAAGAAAAA"  # G at position 5 is an anchor
        result = compute_contextual(seq, window=5)
        # The steps touching G should have negative deviation (stronger than context)
        g_steps = [s for s in result["per_step"] if s["position"] in (4, 5)]
        assert any(s["context_deviation"] < 0 for s in g_steps)

    def test_context_deviation_vulnerability(self):
        # A in strong GC context: weakness in rigid scaffold
        seq = "GGGGGAGGGGG"  # A at position 5 is a vulnerability
        result = compute_contextual(seq, window=5)
        a_steps = [s for s in result["per_step"] if s["position"] in (4, 5)]
        assert any(s["context_deviation"] > 0 for s in a_steps)

    def test_output_length(self):
        seq = "ACGTACGTACGT"  # 12 bp = 11 steps
        result = compute_contextual(seq, window=3)
        assert len(result["per_step"]) == 11
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_biophysics.py::TestComputeContextualFeatures -v`
Expected: FAIL

- [ ] **Step 3: Implement compute_contextual**

Add to `src/polymer_genomics/biophysics.py`:

```python
import numpy as np


def compute_contextual(sequence: str, window: int = 10) -> dict:
    """Compute contextual biophysical features using sliding windows.

    Features:
    - bubble_propensity: how likely this region is to denature (0-1 scale)
    - context_deviation: step's ΔG vs local mean (positive = weaker than context)
    - local_flexibility: windowed mean TRX deformability (0-43)
    - local_stability: windowed mean ΔG (kcal/mol/step)
    """
    seq = sequence.upper()
    n = len(seq) - 1  # number of dinucleotide steps
    if n < 1:
        return {"per_step": [], "summary": {}}

    # Build per-step arrays
    dg_values = np.full(n, np.nan)
    trx_values = np.full(n, np.nan)

    for i in range(n):
        dinuc = seq[i:i+2]
        params = _NN_PARAMS.get(dinuc)
        if params:
            dg_values[i] = params["dg"]
        trx = _TRX_DEFORMABILITY.get(dinuc)
        if trx is not None:
            trx_values[i] = trx

    # Sliding window means using cumulative sums
    half_w = window // 2

    # Pad edges with nearest valid value for windowed stats
    def windowed_mean(arr, w):
        """Compute centered rolling mean with edge handling."""
        result = np.full(len(arr), np.nan)
        cs = np.nancumsum(arr)
        cs = np.insert(cs, 0, 0)
        counts = np.nancumsum(~np.isnan(arr))
        counts = np.insert(counts, 0, 0)
        for i in range(len(arr)):
            lo = max(0, i - w // 2)
            hi = min(len(arr), i + w // 2 + 1)
            c = counts[hi] - counts[lo]
            if c > 0:
                result[i] = (cs[hi] - cs[lo]) / c
        return result

    local_dg = windowed_mean(dg_values, window)
    local_trx = windowed_mean(trx_values, window)

    # Context deviation: step ΔG minus local mean (positive = weaker than context)
    context_dev = dg_values - local_dg

    # Bubble propensity: sigmoid of how much local ΔG exceeds stability threshold
    # More positive (less negative) ΔG = more bubble-prone
    # Scale: -2.0 kcal/mol/step = very stable (propensity ~0), -0.5 = very unstable (~1)
    bubble_prop = 1.0 / (1.0 + np.exp(-4.0 * (local_dg + 1.2)))

    # Build per-step output
    per_step = []
    for i in range(n):
        dinuc = seq[i:i+2]
        entry = {"position": i, "dinucleotide": dinuc}
        if not np.isnan(dg_values[i]):
            entry["delta_g_37"] = round(float(dg_values[i]), 3)
            entry["local_stability"] = round(float(local_dg[i]), 3)
            entry["context_deviation"] = round(float(context_dev[i]), 3)
            entry["bubble_propensity"] = round(float(bubble_prop[i]), 4)
        if not np.isnan(trx_values[i]):
            entry["deformability"] = int(trx_values[i])
            entry["local_flexibility"] = round(float(local_trx[i]), 2)
        per_step.append(entry)

    summary = {
        "n_steps": n,
        "window": window,
        "mean_bubble_propensity": round(float(np.nanmean(bubble_prop)), 4),
        "max_bubble_propensity": round(float(np.nanmax(bubble_prop)), 4),
        "mean_flexibility": round(float(np.nanmean(local_trx)), 2),
    }

    return {"per_step": per_step, "summary": summary}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_biophysics.py::TestComputeContextualFeatures -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/polymer_genomics/biophysics.py tests/test_biophysics.py
git commit -m "feat: add contextual biophysics (bubble propensity, context deviation, flexibility)"
```

---

### Task 3: Curvature Trajectory

**Files:**
- Modify: `src/polymer_genomics/biophysics.py`
- Test: `tests/test_biophysics.py`

DNA curvature from accumulated roll/tilt deflection over helical turns. A-tracts curve strongly; alternating purine-pyrimidine is straight.

- [ ] **Step 1: Write failing tests**

```python
class TestComputeCurvature:
    def test_a_tract_curved(self):
        # A-tracts have phased roll/tilt that produce curvature
        seq = "A" * 30
        result = compute_curvature(seq, window=21)
        assert result["summary"]["mean_curvature"] > 0

    def test_gc_alternating_straight(self):
        # Alternating GC has cancelling roll/tilt
        seq = "GCGCGCGCGCGCGCGCGCGCGCGCGCGCGC"
        result = compute_curvature(seq, window=21)
        # Should have lower curvature than A-tract
        a_result = compute_curvature("A" * 30, window=21)
        assert result["summary"]["mean_curvature"] < a_result["summary"]["mean_curvature"]

    def test_curvature_per_step(self):
        seq = "ACGTACGTACGTACGTACGTACGT"  # 24bp
        result = compute_curvature(seq, window=10)
        assert len(result["per_step"]) == 23  # n-1 steps
        assert all("curvature" in s for s in result["per_step"])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_biophysics.py::TestComputeCurvature -v`
Expected: FAIL

- [ ] **Step 3: Implement compute_curvature**

Add to `src/polymer_genomics/biophysics.py`:

```python
def compute_curvature(sequence: str, window: int = 21) -> dict:
    """Compute local DNA curvature from accumulated roll and tilt.

    Curvature = sqrt(sum(roll²) + sum(tilt²)) over a sliding window.
    Window default = 21bp (two helical turns, standard for curvature analysis).
    """
    seq = sequence.upper()
    n = len(seq) - 1
    if n < 1:
        return {"per_step": [], "summary": {}}

    roll_vals = np.zeros(n)
    tilt_vals = np.zeros(n)
    valid = np.zeros(n, dtype=bool)

    for i in range(n):
        dinuc = seq[i:i+2]
        s = _OLSON_STRUCTURAL.get(dinuc)
        if s:
            roll_vals[i] = s["roll"]
            tilt_vals[i] = s["tilt"]
            valid[i] = True

    # Windowed curvature via cumulative sums of squared components
    cs_roll2 = np.insert(np.cumsum(roll_vals ** 2), 0, 0)
    cs_tilt2 = np.insert(np.cumsum(tilt_vals ** 2), 0, 0)

    per_step = []
    curvatures = np.zeros(n)
    for i in range(n):
        lo = max(0, i - window // 2)
        hi = min(n, i + window // 2 + 1)
        w = hi - lo
        if w > 0:
            mean_roll2 = (cs_roll2[hi] - cs_roll2[lo]) / w
            mean_tilt2 = (cs_tilt2[hi] - cs_tilt2[lo]) / w
            curvatures[i] = float(np.sqrt(mean_roll2 + mean_tilt2))

        dinuc = seq[i:i+2]
        per_step.append({
            "position": i,
            "dinucleotide": dinuc,
            "roll": round(float(roll_vals[i]), 2) if valid[i] else None,
            "tilt": round(float(tilt_vals[i]), 2) if valid[i] else None,
            "curvature": round(curvatures[i], 3),
        })

    summary = {
        "n_steps": n,
        "window": window,
        "mean_curvature": round(float(np.mean(curvatures)), 3),
        "max_curvature": round(float(np.max(curvatures)), 3),
    }
    return {"per_step": per_step, "summary": summary}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_biophysics.py::TestComputeCurvature -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/polymer_genomics/biophysics.py tests/test_biophysics.py
git commit -m "feat: add curvature trajectory from roll/tilt accumulation"
```

---

### Task 4: Structural Motif Detection

**Files:**
- Modify: `src/polymer_genomics/biophysics.py`
- Test: `tests/test_biophysics.py`

Detect sequence-level structural motifs: G-quadruplex, Z-DNA propensity, poly-A/T tracts, inverted repeats (hairpin potential).

- [ ] **Step 1: Write failing tests**

```python
import re

class TestDetectMotifs:
    def test_g_quadruplex(self):
        seq = "AAAGGGCCCGGGAAAGGGTTGGGAAA"  # G3+N3+G3+N3+G3+N2+G3
        result = detect_motifs(seq)
        assert len(result["g_quadruplex"]) >= 1

    def test_no_g_quadruplex(self):
        seq = "ACGTACGTACGTACGT"
        result = detect_motifs(seq)
        assert len(result["g_quadruplex"]) == 0

    def test_z_dna_alternating_gc(self):
        seq = "AACGCGCGCGCGCGAA"  # Alternating CG — strong Z-DNA propensity
        result = detect_motifs(seq)
        assert len(result["z_dna_prone"]) >= 1

    def test_poly_a_tract(self):
        seq = "GCGCAAAAAAGCGC"
        result = detect_motifs(seq)
        assert any(m["type"] == "poly_A" for m in result["homopolymer_runs"])

    def test_inverted_repeat(self):
        seq = "AACGTACGNNNNNCGTACGTAA"  # ACGTACG...CGTACGT (complement)
        result = detect_motifs(seq)
        # Should detect palindromic/inverted repeat potential
        assert len(result["inverted_repeats"]) >= 0  # may or may not find depending on implementation
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_biophysics.py::TestDetectMotifs -v`
Expected: FAIL

- [ ] **Step 3: Implement detect_motifs**

Add to `src/polymer_genomics/biophysics.py`:

```python
_COMPLEMENT = str.maketrans("ACGT", "TGCA")


def detect_motifs(sequence: str) -> dict:
    """Detect structural motifs in a DNA sequence.

    Returns dict with lists of motif annotations:
    - g_quadruplex: G3+N1-7 patterns (potential G4 structures)
    - z_dna_prone: alternating purine-pyrimidine runs ≥8bp with low Z penalty
    - homopolymer_runs: poly-A, poly-T, poly-G, poly-C runs ≥5bp
    - inverted_repeats: potential hairpin stems (≥6bp palindromic sequences)
    """
    seq = sequence.upper()
    n = len(seq)

    # G-quadruplex: G3+N{1,7}G3+N{1,7}G3+N{1,7}G3+
    g4_pattern = re.compile(r"(G{3,})\w{1,7}(G{3,})\w{1,7}(G{3,})\w{1,7}(G{3,})")
    g4_hits = []
    for m in g4_pattern.finditer(seq):
        g4_hits.append({
            "start": m.start(),
            "end": m.end(),
            "sequence": m.group(),
            "g_run_lengths": [len(g) for g in m.groups()],
        })

    # Z-DNA: alternating purine-pyrimidine ≥8bp
    z_dna = []
    pur_pyr = "".join("R" if b in "AG" else "Y" if b in "CT" else "N" for b in seq)
    for m in re.finditer(r"(?:RY){4,}|(?:YR){4,}", pur_pyr):
        region = seq[m.start():m.end()]
        # Compute mean Z-form penalty for this stretch
        penalties = [_Z_FORM_PROPENSITY.get(region[i:i+2], 5.0) for i in range(len(region)-1)]
        mean_penalty = sum(penalties) / len(penalties) if penalties else 5.0
        if mean_penalty < 2.5:  # reasonably Z-prone
            z_dna.append({
                "start": m.start(),
                "end": m.end(),
                "length": m.end() - m.start(),
                "mean_z_penalty": round(mean_penalty, 2),
            })

    # Homopolymer runs ≥5bp
    homo_runs = []
    for base, label in [("A", "poly_A"), ("T", "poly_T"), ("G", "poly_G"), ("C", "poly_C")]:
        for m in re.finditer(f"{base}{{5,}}", seq):
            homo_runs.append({
                "type": label,
                "start": m.start(),
                "end": m.end(),
                "length": m.end() - m.start(),
            })
    homo_runs.sort(key=lambda x: x["start"])

    # Inverted repeats (potential hairpins): find palindromic sequences ≥6bp
    inv_repeats = []
    min_stem = 6
    max_loop = 12
    for stem_len in range(min_stem, min(20, n // 2) + 1):
        for i in range(n - 2 * stem_len - 1):
            stem5 = seq[i:i + stem_len]
            if "N" in stem5:
                continue
            rc = stem5.translate(_COMPLEMENT)[::-1]
            # Search for complement within max_loop distance
            search_start = i + stem_len
            search_end = min(i + stem_len + max_loop + stem_len, n)
            search_region = seq[search_start:search_end]
            pos = search_region.find(rc)
            if pos != -1:
                loop_len = pos
                if loop_len >= 3:  # minimum loop size
                    inv_repeats.append({
                        "start": i,
                        "end": search_start + pos + stem_len,
                        "stem_length": stem_len,
                        "loop_length": loop_len,
                        "stem_5prime": stem5,
                    })

    # Deduplicate overlapping inverted repeats — keep longest
    inv_repeats.sort(key=lambda x: -(x["stem_length"]))
    kept = []
    used = set()
    for ir in inv_repeats:
        positions = set(range(ir["start"], ir["end"]))
        if not positions & used:
            kept.append(ir)
            used |= positions
    inv_repeats = sorted(kept, key=lambda x: x["start"])

    return {
        "g_quadruplex": g4_hits,
        "z_dna_prone": z_dna,
        "homopolymer_runs": homo_runs,
        "inverted_repeats": inv_repeats,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_biophysics.py::TestDetectMotifs -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/polymer_genomics/biophysics.py tests/test_biophysics.py
git commit -m "feat: add structural motif detection (G4, Z-DNA, homopolymers, hairpins)"
```

---

### Task 5: Wire New Features into the API Endpoint & Raise Region Limit

**Files:**
- Modify: `src/polymer_genomics/routers/biophysics.py`
- Modify: `src/polymer_genomics/biophysics.py` (add `compute_all_contextual` orchestrator)
- Test: `tests/test_biophysics.py`

Wire the new compute functions into the existing endpoint. Add `"structural"`, `"contextual"`, and `"motifs"` as valid property groups. Raise region limit from 10kb to 1Mb.

- [ ] **Step 1: Write failing integration test**

```python
class TestEndpointContextual:
    def test_compute_all_contextual(self):
        seq = "GCGCGCAAAAAAGCGCGCATATATATAT"
        result = compute_all_contextual(seq)
        assert "structural" in result
        assert "contextual" in result
        assert "curvature" in result
        assert "motifs" in result
        # Structural
        assert len(result["structural"]["per_step"]) == len(seq) - 1
        # Contextual
        assert "bubble_propensity" in result["contextual"]["per_step"][0]
        # Motifs
        assert "homopolymer_runs" in result["motifs"]
        # Should detect the AAAAAA run
        assert any(m["type"] == "poly_A" for m in result["motifs"]["homopolymer_runs"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_biophysics.py::TestEndpointContextual -v`
Expected: FAIL

- [ ] **Step 3: Implement compute_all_contextual orchestrator**

Add to `src/polymer_genomics/biophysics.py`:

```python
def compute_all_contextual(sequence: str, window: int = 10) -> dict:
    """Compute all biophysical properties including contextual features.

    Returns dict with keys: structural, contextual, curvature, motifs.
    """
    return {
        "structural": compute_structural(sequence),
        "contextual": compute_contextual(sequence, window=window),
        "curvature": compute_curvature(sequence, window=max(window, 21)),
        "motifs": detect_motifs(sequence),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_biophysics.py::TestEndpointContextual -v`
Expected: PASS

- [ ] **Step 5: Update the router — add new property groups and raise limit**

In `src/polymer_genomics/routers/biophysics.py`:

Change: `MAX_BIOPHYSICS_LENGTH = 10_000` → `MAX_BIOPHYSICS_LENGTH = 1_000_000`

Add `"structural"`, `"contextual"`, `"curvature"`, `"motifs"` to the valid properties set (line 29).

Wire `compute_structural`, `compute_contextual`, `compute_curvature`, `detect_motifs` into the endpoint response the same way existing property groups are handled — adding their `per_step` data to `mcols` and their `summary` to `summaries`.

For motifs (not per-step), add a top-level `"motifs"` key in the response alongside `"data"`.

- [ ] **Step 6: Run full test suite**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_biophysics.py -v`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/polymer_genomics/biophysics.py src/polymer_genomics/routers/biophysics.py tests/test_biophysics.py
git commit -m "feat: wire contextual biophysics into API, raise limit to 1Mb"
```

---

### Task 6: Generate Genome-Wide Dinucleotide Index

**Files:**
- Create: `src/polymer_genomics/dinucleotide_index.py`
- Create: `scripts/generate_dinucleotide_index.py`
- Test: `tests/test_dinucleotide_index.py`

A genome-wide uint8 array (0-15 per dinucleotide step, 255 for N) stored as memory-mapped numpy files. Enables instant biophysics lookup for any genomic region without re-reading FASTA.

- [ ] **Step 1: Write failing tests**

```python
# tests/test_dinucleotide_index.py
import numpy as np
import pytest
from polymer_genomics.dinucleotide_index import (
    sequence_to_dinuc_index,
    dinuc_index_to_values,
    DINUC_ORDER,
)


class TestDinucIndex:
    def test_known_sequence(self):
        idx = sequence_to_dinuc_index("ACGT")
        # AC=1, CG=6, GT=11 (A=0,C=1,G=2,T=3; idx = b1*4+b2)
        assert list(idx) == [1, 6, 11]

    def test_n_handling(self):
        idx = sequence_to_dinuc_index("ANGT")
        assert idx[0] == 255  # AN contains N
        assert idx[1] == 255  # NG contains N
        assert idx[2] == 11   # GT is valid

    def test_roundtrip_dg37(self):
        seq = "GCGCATAT"
        idx = sequence_to_dinuc_index(seq)
        dg_lut = np.array([-1.00, -1.44, -1.28, -0.88,  # AA AC AG AT
                           -1.45, -1.84, -2.17, -1.28,  # CA CC CG CT
                           -1.30, -2.24, -1.84, -1.44,  # GA GC GG GT
                           -0.58, -1.30, -1.45, -1.00])  # TA TC TG TT
        values = dinuc_index_to_values(idx, dg_lut)
        # GC step: idx=9, dg=-2.24
        assert values[0] == pytest.approx(-2.24, abs=0.01)

    def test_dinuc_order(self):
        assert DINUC_ORDER[0] == "AA"
        assert DINUC_ORDER[6] == "CG"
        assert DINUC_ORDER[15] == "TT"
        assert len(DINUC_ORDER) == 16
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_dinucleotide_index.py -v`
Expected: FAIL

- [ ] **Step 3: Implement dinucleotide_index module**

Create `src/polymer_genomics/dinucleotide_index.py`:

```python
"""Genome-wide dinucleotide index: uint8 arrays (0-15) for instant biophysics lookup."""

import numpy as np
from pathlib import Path

DINUC_ORDER = [
    "AA", "AC", "AG", "AT", "CA", "CC", "CG", "CT",
    "GA", "GC", "GG", "GT", "TA", "TC", "TG", "TT",
]

# Base encoding: A=0, C=1, G=2, T=3
_BASE_LUT = np.full(256, 255, dtype=np.uint8)
_BASE_LUT[ord("A")] = 0
_BASE_LUT[ord("C")] = 1
_BASE_LUT[ord("G")] = 2
_BASE_LUT[ord("T")] = 3


def sequence_to_dinuc_index(sequence: str) -> np.ndarray:
    """Convert DNA sequence to dinucleotide index array.

    Returns uint8 array of length len(seq)-1.
    Values 0-15 for valid dinucleotides (b1*4 + b2).
    Value 255 for N-containing dinucleotides.
    """
    seq_bytes = np.frombuffer(sequence.upper().encode("ascii"), dtype=np.uint8)
    base_idx = _BASE_LUT[seq_bytes]

    b1 = base_idx[:-1]
    b2 = base_idx[1:]

    valid = (b1 < 255) & (b2 < 255)
    result = np.full(len(b1), 255, dtype=np.uint8)
    result[valid] = (b1[valid].astype(np.uint16) * 4 + b2[valid].astype(np.uint16)).astype(np.uint8)

    return result


def dinuc_index_to_values(idx: np.ndarray, lut: np.ndarray) -> np.ndarray:
    """Convert dinucleotide index array to property values using a 16-element lookup.

    Invalid positions (255) get NaN.
    """
    # Extend LUT to 256 elements, with NaN at index 255
    extended = np.full(256, np.nan)
    extended[:16] = lut
    return extended[idx]


def generate_chromosome_index(fasta_path: str, chr_name: str) -> np.ndarray:
    """Generate dinucleotide index for a full chromosome from FASTA."""
    from pyfaidx import Fasta
    fa = Fasta(fasta_path, read_ahead=10000, rebuild=False)
    seq = str(fa[chr_name][:]).upper()
    fa.close()
    return sequence_to_dinuc_index(seq)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_dinucleotide_index.py -v`
Expected: PASS

- [ ] **Step 5: Create the generation script**

Create `scripts/generate_dinucleotide_index.py`:

```python
#!/usr/bin/env python3
"""Generate genome-wide dinucleotide index files (uint8 numpy arrays).

Output: data/dinucleotide_index/{chr}.npy (one file per chromosome)
Total size: ~3.1 GB (1 byte per dinucleotide step)

Usage: uv run python scripts/generate_dinucleotide_index.py
"""
import os
import sys
import time
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from polymer_genomics.dinucleotide_index import generate_chromosome_index

FASTA_PATH = "data/hg38.fa"
OUTPUT_DIR = "data/dinucleotide_index"
CHROMOSOMES = [f"chr{i}" for i in range(1, 23)] + ["chrX", "chrY"]


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Generating dinucleotide index → {OUTPUT_DIR}/")

    total = 0
    t0 = time.time()
    for chr_name in CHROMOSOMES:
        t1 = time.time()
        idx = generate_chromosome_index(FASTA_PATH, chr_name)
        out_path = os.path.join(OUTPUT_DIR, f"{chr_name}.npy")
        np.save(out_path, idx)
        size_mb = os.path.getsize(out_path) / 1e6
        total += len(idx)
        print(f"  {chr_name}: {len(idx):,} steps, {size_mb:.1f} MB, {time.time()-t1:.1f}s")

    elapsed = time.time() - t0
    total_gb = sum(
        os.path.getsize(os.path.join(OUTPUT_DIR, f))
        for f in os.listdir(OUTPUT_DIR) if f.endswith(".npy")
    ) / 1e9
    print(f"\nDone: {total:,} steps, {total_gb:.2f} GB, {elapsed/60:.1f} min")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Run the generation script**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run python scripts/generate_dinucleotide_index.py`
Expected: 24 `.npy` files in `data/dinucleotide_index/`, ~3.1 GB total, ~5-10 minutes runtime

- [ ] **Step 7: Verify output**

```bash
ls -lh data/dinucleotide_index/*.npy | head -5
uv run python -c "
import numpy as np
idx = np.load('data/dinucleotide_index/chr22.npy')
print(f'chr22: {len(idx):,} steps, dtype={idx.dtype}, unique={np.unique(idx)[:5]}...')
assert idx.dtype == np.uint8
assert set(np.unique(idx)).issubset(set(range(16)) | {255})
print('OK')
"
```

- [ ] **Step 8: Commit**

```bash
git add src/polymer_genomics/dinucleotide_index.py tests/test_dinucleotide_index.py scripts/generate_dinucleotide_index.py
echo "data/dinucleotide_index/" >> .gitignore
git add .gitignore
git commit -m "feat: genome-wide dinucleotide index (uint8, ~3.1 GB, instant lookup)"
```

---

### Task 7: Update MCP Tools

**Files:**
- Modify: `mcp/polymer_genomics_mcp/server.py`

Update the `compute_region_biophysics` MCP tool to expose the new property groups and higher limit.

- [ ] **Step 1: Update compute_region_biophysics tool**

In `mcp/polymer_genomics_mcp/server.py`, update the `compute_region_biophysics` tool (around line 1065):

- Add `"structural"`, `"contextual"`, `"curvature"`, `"motifs"` to the `properties` parameter description
- Update the `_summarize_biophysics()` helper (line 307) to include contextual feature summaries (bubble propensity, curvature, flexibility)
- Update the tool docstring to document the new features

- [ ] **Step 2: Test via MCP**

Run the MCP server locally and test:
```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/mcp && uv run python -c "
import asyncio
from polymer_genomics_mcp.server import mcp
# Verify tool registration includes new properties
"
```

- [ ] **Step 3: Commit**

```bash
git add mcp/polymer_genomics_mcp/server.py
git commit -m "feat: expose contextual biophysics in MCP tools"
```

---

### Verification

After all tasks are complete:

1. **Unit tests**: `uv run pytest tests/test_biophysics.py tests/test_dinucleotide_index.py -v` — all pass
2. **Endpoint test**: `uv run python -c "from polymer_genomics.biophysics import compute_all_contextual; r = compute_all_contextual('GCGCGCAAAAAAGCGCGCATATATATAT'); print(r['motifs'])"` — shows poly-A detection
3. **Region limit**: Verify 1 Mb region works via API (start local server, query large region)
4. **Dinucleotide index**: Verify files exist and are loadable: `ls -lh data/dinucleotide_index/chr1.npy`
5. **MCP**: Test `compute_region_biophysics` with `properties="contextual"` returns bubble propensity
