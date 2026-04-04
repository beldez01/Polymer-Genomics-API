# PolymerBench v3 Strategy
## Anti-Hallucination Benchmark for Genomic AI Agents
**Date: 2026-04-04**

---

## Executive Summary

PolymerBench is a benchmark proving that AI agents grounded with curated genomic reference data (Polymer Genomics) outperform ungrounded LLMs on genomics tasks. The benchmark targets the gap between GeneGPT (which proved generic NCBI APIs >> raw LLMs) and what nobody has shown: **curated biophysical computation >> generic database access**.

---

## The Pitch Numbers (Published, Citable)

| Stat | Source | Year |
|------|--------|------|
| <2% accuracy on random ClinVar variants | Microsoft Research / Bioinformatics Advances | 2024 |
| 23% hallucination rate in oncology (n=6,523) | ASCO meta-analysis | 2025 |
| 47% of LLM medical references fabricated | JMIR | 2024 |
| 1% accuracy on gene name conversion (no tools) | GeneTuring | 2025 |
| 62% best score (GPT-5) across 540K gene questions | SciHorizon-Gene | 2026 |
| 0.12 -> 0.83 with NCBI API tools | GeneGPT (Bioinformatics) | 2024 |
| 0.04 -> 0.98 with tools on small models | Nano Bio-Agents | 2025 |
| 73% best accuracy on cancer variant classification | npj Precision Oncology | 2025 |
| Up to 83% of adversarial fake lab values repeated | Communications Medicine | 2025 |

---

## Prior Art & Positioning

### Existing Genomics AI Benchmarks

| Benchmark | Size | Key Finding | Our Relation |
|-----------|------|-------------|-------------|
| **GeneTuring** (2025) | 1,600 Qs, 16 tasks | Tool-augmented GPT-4o (SeqSnap) scored 0.83 vs vanilla 0.12 | Direct template |
| **GeneGPT** (2024) | GeneTuring subset | LLM + NCBI APIs = 0.83 avg | Proves tool-augmented >> raw LLM |
| **BixBench** (2025) | 296 Qs, 53 scenarios | Frontier models only 17% | Hardest benchmark; Kepler SOTA 33.4% |
| **SciHorizon-Gene** (2026) | 540K Qs, 190K genes | GPT-5 best at 62% | Largest scale |
| **Genome-Bench** (2025) | 3,332 CRISPR Qs | Expert forum difficulty | Domain-specific model |
| **BioAgent Bench** (2026) | Agent-specific | Bioinformatics agent eval | Newest framing |
| **GAIA** | 466 Qs, 3 levels | General agent benchmark | Structural model for leaderboard |

### What Nobody Has Done
GeneGPT proved NCBI APIs >> nothing. Nobody has benchmarked **curated biophysical computation layers** against generic database access. Polymer's 49 biophysics columns (stacking energy, curvature, melting temp, etc.) don't exist in any training corpus or competing database. Questions about these properties are **inherently contamination-proof**.

---

## Competitive Landscape

| Company | Valuation/Funding | What | Our Differentiation |
|---------|-------------------|------|---------------------|
| **OpenEvidence** | $3.5B | Clinical literature grounding | We ground in structured genomic data, not papers |
| **Hippocratic AI** | $3.5B | Clinical safety agents | Different market (patient-facing) |
| **Genomenon** | Private | 27M variants, article-based KB | We have biophysical computation they don't |
| **Kepler AI** | Private | BixBench SOTA (33.4%) | We have unique IP (biophysics layer) |
| **FutureHouse** | $70M | Chemistry/drug discovery | Different domain |
| **ScienceMachine** | $3.5M | BixBench co-creator | 2-person team, broader assay coverage |

**Unoccupied niche:** Curated biophysical genomic reference + MCP server + benchmark-proven hallucination reduction.

---

## v2 Benchmark Results (What We Learned)

### 100-Question Benchmark (archived in v2_archive/)
- **Overall: 28% accuracy (27.98/100 points)**
- Factual: 32% pass, 14% API errors
- Hallucination traps: 8% pass, 84% had data available but extraction failed
- Reasoning: 0% (never scored, marked "manual")

### Critical Finding: API Made Performance WORSE
- **With API: 40.1%**
- **Without API: 46.5%**
- **81 of 100 questions degraded by API**
- Root causes: API errors, verbose responses confusing extraction, tool selection issues

### 15 MCP Harness Cases (CASES.md)
- Framework defined, never executed on real transcripts

### BixBench Analysis
- 44 questions native, 47 capable, 74 out of scope
- Win target: >38% on 91 winnable questions
- Never actually run

---

## BLOCKER: Extraction/Parsing Fix Required

Before building v3, the API integration must be fixed so it HELPS rather than hurts. The diagnosis:

1. **API errors (10/50 factual):** Reliability issues — timeouts, malformed responses
2. **Extraction failure (84% of hallucination traps):** API returns correct data but agent can't parse verbose JSON responses into clean answers
3. **Tool selection:** Agent sometimes picks wrong tool or overthinks with too many options

### Fix Strategy
- Audit MCP tool descriptions for clarity and disambiguation
- Simplify response formatting (structured, less verbose)
- Add extraction hints to tool responses
- Re-run v2 questions to validate improvement before building v3

---

## PolymerBench v3 Design

### Structure
- **500-800 questions** across 3 difficulty levels, 6 categories
- **3 evaluation conditions:** Base LLM / LLM + NCBI APIs / LLM + Polymer MCP
- **40/60 public/private split** with canary strings for contamination detection
- **Biophysics questions are inherently contamination-proof**

### Difficulty Levels (following GAIA/Genome-Bench model)

**Level 1 — Retrieval (single lookup):**
- Gene coordinates, probe annotations, CpG context
- Variant position, constraint scores, expression levels
- Expected: <2% ungrounded -> ~100% grounded

**Level 2 — Integration (2-3 lookups combined):**
- "What's the biophysical stability of the region flanking gene X vs genomic average?"
- "Is this probe in a CpG island AND overlapping a TE AND in a constrained gene?"
- Expected: ~50% ungrounded -> ~90% grounded

**Level 3 — Reasoning (inference over retrieved data):**
- "Given stacking energy profile of this TE insertion site, predict silencing mechanism"
- "Which of these CRISPR guides targets a more thermodynamically accessible region?"
- "Why might this CpG island resist age-related methylation drift?"
- Expected: ~30% ungrounded -> ~85% grounded

### Categories (6 domains)

1. **Gene/Region Lookup** — coordinates, exons, constraint, expression
2. **Probe Annotation** — CpG context, platform crossmaps, clock coefficients
3. **Biophysical Properties** — stacking energy, curvature, melting temp, deformability (UNIQUE TO POLYMER)
4. **Cross-Layer Integration** — combining biophysics + methylation + TEs + expression
5. **Epigenetic Mechanism** — silencing prediction, clock biology, CGI protection
6. **Anti-Hallucination Traps** — fabricated genes, non-existent probes, impossible properties

### Metrics (from RAGAS + genomics-specific)

- **Factual Accuracy:** exact match against curated reference
- **Faithfulness:** all claims traceable to retrieved context (RAGAS)
- **Hallucination Rate:** confident wrong answers / total answers
- **Refusal Rate:** correctly declining when data doesn't exist
- **Cost:** total API calls + tokens per question
- **Latency:** time to answer

### Hosting
- **HuggingFace Dataset** with Croissant metadata
- **HuggingFace Leaderboard** (Gradio Space + private evaluator)
- **40/60 split:** 200 public validation, 300-500 private test

---

## Publication Strategy

| Target | Deadline | Format |
|--------|----------|--------|
| HuggingFace Dataset | Week 3 (April 2026) | Dataset card + leaderboard |
| bioRxiv preprint | Week 4 (April 2026) | Immediate visibility |
| NAR Database Issue | Aug 15, 2026 | 4-5 page resource paper with benchmark results |
| NeurIPS Eval & Datasets Track | ~Sep 2026 | Formal benchmark paper |
| Bioconductor AnnotationHub | Q3 2026 | Package biophysics as community resource |

---

## Parallel Track: EWAS Interpretation Report

**Status:** Implementation plan complete, all APIs exist, ~12 new files needed.
**Route:** `/ewas-report` on polymerbio.org
**Purpose:** First external-facing product that generates demand signal.
**Spec:** Upload CSV of probe IDs + delta-betas -> get HTML report with biophysical context, TE overlap, clustering, silencing risk, gene constraint.

---

## 30-Day Execution Plan

**Week 1-2:**
- [ ] Fix extraction/parsing blocker (MCP tool descriptions + response formatting)
- [ ] Re-run v2 100 questions to validate API now helps
- [ ] Build EWAS report page (parallel)

**Week 3:**
- [ ] Design 500 questions across 3 levels, 6 categories
- [ ] Run benchmark: Base LLM / LLM + NCBI / LLM + Polymer
- [ ] Host on HuggingFace with leaderboard

**Week 4:**
- [ ] EWAS report live on polymerbio.org
- [ ] PolymerBench results published (blog + HF + bioRxiv preprint)
- [ ] Record 3 demo videos (TET2, region interrogation, hypothesis generation)
- [ ] Send first EWAS report to a colleague's DMP list
- [ ] Email Anthropic dev rel with benchmark number

---

## Key References

### Benchmarking Methodology
- Weber et al. 2019, "Essential guidelines for computational method benchmarking" (Genome Biology) — THE reference
- Genome Biology 2017, "Benchmarking: contexts and details matter"

### Genomics AI Evaluation
- GeneGPT: https://arxiv.org/abs/2304.09667
- GeneTuring: https://academic.oup.com/bib/article/26/5/bbaf492/8261762
- BixBench: https://arxiv.org/abs/2503.00096
- SciHorizon-Gene: https://arxiv.org/html/2601.12805v2
- Genome-Bench: https://arxiv.org/abs/2505.19501
- BioAgent Bench: https://arxiv.org/html/2601.21800v1
- Nano Bio-Agents: https://arxiv.org/abs/2509.19566

### Hallucination Studies
- Microsoft/ClinVar (<2%): https://academic.oup.com/bioinformaticsadvances/article/5/1/vbaf019/8002096
- ASCO 2025 (23%): https://ascopubs.org/doi/10.1200/JCO.2025.43.16_suppl.e13686
- Cancer variants (73%): https://www.nature.com/articles/s41698-025-00935-4
- Medical refs (47% fabricated): https://www.jmir.org/2024/1/e53164
- GeneAgent: https://www.nature.com/articles/s41592-025-02748-6

### RAG Evaluation
- RAGAS: https://arxiv.org/abs/2309.15217
- MedHallu: https://aclanthology.org/2025.emnlp-main.143/
- MIRAGE: https://arxiv.org/abs/2402.13178

### MCP Agent Evaluation
- MCP-Bench: https://arxiv.org/abs/2508.20453
- MCPAgentBench: https://arxiv.org/abs/2512.24565

### Community Standards
- Bioconductor: pipeComp, iCOBRA packages
- DREAM Challenges, Genome in a Bottle (NIST), precisionFDA, OpenEBench (ELIXIR)
- FAIR Principles: https://pmc.ncbi.nlm.nih.gov/articles/PMC4792175/

---

## The One Slide

> "Ungrounded LLMs get <2% of genomic variant annotations correct (Microsoft 2024). In oncology, 1 in 4 LLM answers is hallucinated (ASCO 2025). But tool-augmented agents score 0.98 vs 0.04 ungrounded. Polymer provides the grounding infrastructure -- 22GB of curated, cross-referenced genomic data with unique biophysical computation -- and PolymerBench proves it works."
