# External Benchmarking Study Design: Polymer Genomics Platform Truthfulness

**Purpose**: Demonstrate to AI companies (FutureHouse, Asimov, Ginkgo, etc.) that using Polymer Genomics as a tool produces verifiably correct genomic reasoning — and that NOT having it produces hallucinations.

---

## The Core Question

AI companies care about one thing: **does this tool make my agent more accurate?**

Internal validation (our SantaLucia/gnomAD/GTEx checks) proves the data is correct. But that's necessary, not sufficient. The benchmark needs to answer: **When an AI agent uses Polymer Genomics to answer genomic questions, how often is the answer correct, and how does that compare to the agent without the tool?**

---

## Study Design: Three Tiers

### Tier 1: Factual Retrieval Accuracy (Ground Truth Check)

**Question format**: Questions with known, verifiable answers from authoritative sources.

**Protocol**:
1. Construct 200 questions spanning all layer types
2. Each question has a single correct answer extractable from the authoritative source
3. Run each question through:
   - **Condition A**: Claude/GPT with Polymer Genomics MCP tools (our API)
   - **Condition B**: Claude/GPT with no tools (parametric knowledge only)
   - **Condition C**: Claude/GPT with generic web search only
4. Score: correct/incorrect/hallucinated, with severity

**Example questions by domain**:

| # | Question | Authoritative Answer | Source |
|---|----------|---------------------|--------|
| 1 | What is the stacking free energy (ΔG₃₇) of the CG dinucleotide in DNA? | -2.17 kcal/mol | SantaLucia 1998 Table 2 |
| 2 | On which chromosome is TP53 located in hg38, and what strand? | chr17, minus strand | GENCODE v44 |
| 3 | What is the gnomAD pLI score for SCN1A? | 1.0 | gnomAD v2.1.1 |
| 4 | What tissue has the highest expression of ALB in GTEx? | Liver (~25,201 TPM) | GTEx v10 |
| 5 | How many CpG probes are in the Horvath 2013 epigenetic clock? | 353 | Horvath 2013 Table S3 |
| 6 | What is the persistence length of bare B-DNA at physiological salt? | 50 nm | Hagerman 1988 |
| 7 | What is the LOEUF score for TTN? | 0.354 (v2.1.1) | gnomAD |
| 8 | Is VEGFA in the HALLMARK_ANGIOGENESIS gene set? | Yes | MSigDB v2024.1 |
| 9 | What CpG context is probe cg00000029 in? | N_Shore | Illumina manifest |
| 10 | What is the biosynthetic cost (ECPA) of tryptophan? | 74.3 ATP equivalents | Akashi-Gojobori 2002 |

**Categories** (20 questions each, 200 total):
- Thermodynamic constants (NN params, Tm, ΔG)
- Gene coordinates and structure
- Gene expression (tissue specificity)
- Gene constraint (pLI, LOEUF)
- Methylation probes (coordinates, context, clocks)
- Physical constants (Lp, forces, rates)
- Protein data (abundance, localization)
- Pathway/gene set membership
- Biophysics computation (CpG islands, flags)
- Cross-layer queries (correlations, intersections)

**Key metric**: % correct, % hallucinated, mean confidence when wrong

---

### Tier 2: Reasoning Tasks (Applied Genomics)

**Question format**: Multi-step genomic reasoning that requires combining information from multiple sources.

**Protocol**: Same 3 conditions. Answers scored by domain expert (you) on a 0-5 rubric.

**Example tasks**:

1. **"Is the TP53 promoter region likely to form Z-DNA under torsional stress? Provide evidence."**
   - Requires: sequence retrieval → biophysics computation → Z-form propensity → CpG density → interpretation
   - Good answer cites specific dinucleotide steps, Z-form penalty values, CpG alternation

2. **"Which gene between BRCA1 and BRCA2 is more constrained against loss-of-function mutations, and why?"**
   - Requires: gnomAD constraint lookup × 2 → comparison → biological interpretation (AD vs AR)

3. **"Design a 500bp promoter fragment for high expression in liver. What biophysical properties should it have?"**
   - Requires: evaluate_design → GC optimization → CpG island avoidance → codon context

4. **"A methylation array experiment found cg16867657 (ELOVL2) hypermethylated. What biological process is this most likely associated with?"**
   - Requires: probe lookup → clock membership → aging literature

5. **"Compare the thermodynamic stability of an AT-rich vs GC-rich region. Which is harder to melt? Which wraps nucleosomes more easily?"**
   - Requires: NN params → Tm comparison → persistence length → nucleosome wrapping energy

6. **"Identify genomic regions near TP53 that are both conserved and have high fragility scores. What structural features explain the fragility?"**
   - Requires: cross-layer query (conservation × fragility) → non-B DNA analysis → interpretation

**Categories** (5 tasks each, 30 total):
- Construct design evaluation
- Variant interpretation
- Cross-layer discovery
- Biological mechanism reasoning
- Clinical/translational genomics
- Evolutionary/comparative analysis

**Scoring rubric (0-5)**:
- 0: Completely wrong or refuses to answer
- 1: Attempts answer but major factual errors
- 2: Partially correct but missing key information
- 3: Mostly correct, some imprecision
- 4: Correct and well-reasoned
- 5: Correct, well-reasoned, cites specific values, acknowledges limitations

---

### Tier 3: Hallucination Detection (Anti-Hallucination Benchmark)

**Question format**: Trick questions and edge cases designed to elicit hallucinations.

**Protocol**: Same 3 conditions. Score: did the agent hallucinate? Did it correctly say "I don't know"?

**Example trick questions**:

1. **"What is the stacking free energy of the UG dinucleotide in DNA?"**
   - Correct: UG doesn't exist in DNA (U is RNA). Should flag this.

2. **"What is the gnomAD pLI score for GAPDH on chromosome 13?"**
   - Correct: GAPDH is on chr12, not chr13. Should catch the error.

3. **"Look up probe cg99999999."**
   - Correct: This probe doesn't exist. Should return "not found."

4. **"What is the expression of TP53 in the uvula tissue in GTEx?"**
   - Correct: GTEx doesn't include uvula as a tissue. Should say so.

5. **"What pathway is TP53 in according to the KEGG_APOPTOSIS gene set?"**
   - Correct: The API has MSigDB Hallmark, not KEGG. Should distinguish.

6. **"What is the melting temperature of chr17:1-1000000000?"**
   - Correct: chr17 is only ~83M bp. Should reject the coordinates.

7. **"What is the GC content of the TP53 protein?"**
   - Correct: GC content applies to DNA, not proteins. Category error.

8. **"Does BRCA1 have a pLI of 0.999?"**
   - Correct: No, pLI ≈ 0. Should correct the claim, not confirm it.

**Categories** (5 questions each, 50 total):
- Invalid inputs (wrong base, wrong chromosome, nonexistent probe)
- Category errors (protein vs DNA, RNA vs DNA)
- Boundary violations (coordinates out of range)
- Confirmation bias traps (stating wrong values, asking agent to confirm)
- Missing data (querying layers/tissues/genes that don't exist)
- Source confusion (asking about data from sources not in the platform)
- Precision traps (asking for more decimal places than the data supports)
- Temporal traps (asking about "latest" when data has a fixed version)
- Ambiguity traps (gene symbols that are also common words)
- Scale traps (confusing bp with kb, kcal with kJ)

**Key metric**: Hallucination rate (% of trick questions where the agent fabricates an answer instead of correctly identifying the problem)

---

## Implementation Plan

### Phase 1: Question Construction (2-3 days)
- Write all 280 questions (200 + 30 + 50) with authoritative answers
- Store in a structured format (JSON/YAML) for automated evaluation
- Peer review: have the questions reviewed for correctness

### Phase 2: Automated Evaluation Harness (1-2 days)
- Build a script that:
  1. Sends each question to Claude via API with/without MCP tools
  2. Captures the response
  3. Compares against ground truth (automated for Tier 1, manual for Tier 2)
  4. Computes accuracy, hallucination rate, confidence metrics
- Run with: `claude-opus-4-6` (with MCP), `claude-opus-4-6` (no tools), `claude-opus-4-6` (web only)

### Phase 3: Run & Analyze (1-2 days)
- Run all 280 questions × 3 conditions = 840 evaluations
- Compute:
  - Overall accuracy by condition
  - Per-domain accuracy breakdown
  - Hallucination rates
  - Latency comparison
  - Confidence-accuracy calibration

### Phase 4: Write Up (1-2 days)
- NAR paper supplementary table: Tier 1 results
- Main paper figure: accuracy comparison bar chart
- Key statistic: "With Polymer Genomics tools, the agent achieved X% accuracy on factual genomic questions vs Y% without tools (Z% hallucination reduction)"

---

## Expected Results (Hypothesis)

| Metric | With API (A) | No Tools (B) | Web Only (C) |
|--------|-------------|--------------|--------------|
| Tier 1 accuracy | >95% | 60-75% | 70-85% |
| Tier 1 hallucination rate | <2% | 15-25% | 10-15% |
| Tier 2 mean score (0-5) | >4.0 | 2.5-3.5 | 3.0-3.5 |
| Tier 3 hallucination rate | <5% | 30-50% | 20-30% |

The key selling point: **specific numerical values** (ΔG₃₇, pLI, TPM, probe coordinates) are where LLMs hallucinate most, and where a verified database eliminates the problem entirely.

---

## Why This Matters for AI Companies

1. **FutureHouse**: Building autonomous research agents. They need tools that return correct data, not hallucinated values. This benchmark proves our API is a reliable tool.

2. **Asimov**: Designing biological systems. Their agents need correct thermodynamic parameters for construct design. One wrong ΔG₃₇ value could invalidate a $100K synthesis run.

3. **Ginkgo**: Scaling biological engineering. Cross-layer queries (e.g., "find CpG islands with high conservation AND low fragility") enable discovery workflows that don't exist elsewhere.

4. **General**: Any AI company building genomics agents needs a benchmark showing their tool use actually improves accuracy. We provide both the tool AND the benchmark.

---

## Differentiator from Internal Validation

| Internal Validation (done) | External Benchmark (proposed) |
|---------------------------|-------------------------------|
| "Our data matches the source" | "Using our data makes AI agents more accurate" |
| Data quality proof | Tool utility proof |
| NAR Database Issue requirement | Commercial adoption driver |
| Static (run once) | Reproducible (anyone can run) |
| Validates values | Validates workflows |
