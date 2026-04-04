# Competitive Intelligence: AI Bioinformatics Platforms

**Date**: January 2026
**Last Updated**: January 22, 2026

---

## Executive Summary

The AI bioinformatics agent space has three major players, plus several emerging competitors:

| Platform | BixBench Accuracy | Funding | Focus | Threat Level |
|----------|-------------------|---------|-------|--------------|
| **Kepler** | **33.4%** (SOTA) | Unknown | Bioinformatics | **HIGH** |
| **ScienceMachine** | Co-created benchmark | $3.5M pre-seed | Bioinformatics + Lab Assays | **HIGH** |
| **FutureHouse/Edison** | Co-created benchmark | $70M seed | Chemistry/Drug Discovery | Medium (not direct competitor) |
| Drylab | 30.0% | Unknown | Unknown | Medium |
| K-dense Analyst | 29.3% | Unknown | Unknown | Medium |
| GPT-4o | 9-22.9% | N/A | General-purpose | Baseline |
| Claude 3.5 Sonnet | 17.0% | N/A | General-purpose | Baseline |

**Key insight:** FutureHouse/Edison co-created BixBench but focuses on chemistry/pharma, NOT bioinformatics. Direct competitors are **Kepler** and **ScienceMachine**.

**Polymer's win condition: >34% accuracy AND differentiated value proposition**

---

## Critical Insight: BixBench Creators

**ScienceMachine and FutureHouse co-created BixBench.** This means:
1. They have deep domain expertise in what makes bioinformatics analysis hard
2. They likely have insider knowledge of benchmark structure
3. ScienceMachine's Sam agent is designed specifically for these tasks
4. **However:** FutureHouse/Edison focuses on chemistry/drug discovery, NOT bioinformatics

---

## Competitive Landscape Summary

### Direct Competitors (Bioinformatics Focus)

| Platform | BixBench | Product | Threat | Key Strength |
|----------|----------|---------|--------|--------------|
| **Kepler** | 33.4% SOTA | Interactive sandbox | **HIGH** | Pre-loaded datasets, broad tool coverage |
| **ScienceMachine** | Co-created benchmark | "Sam" autonomous agent | **HIGH** | Benchmark insider, broader assay types |

### Adjacent Players (Not Direct Competitors)

| Platform | BixBench | Product | Focus | Why Not Direct Threat |
|----------|----------|---------|-------|----------------------|
| **FutureHouse/Edison** | Co-created benchmark | Kosmos, ether0 | Chemistry/Pharma | Focus is molecular design & drug discovery, not bioinformatics pipelines |

### Evidence: FutureHouse Focus is Chemistry

| Signal | Evidence |
|--------|----------|
| Co-founder background | Andrew White: ML in chemistry, chemical engineering |
| Flagship model | ether0: 24B reasoning model **for chemistry** |
| First product | ChemCrow: First LLM agents **in chemistry** |
| Training data | Robin: Scientific reasoning dataset **for chemistry** |
| Customers | 6 of top 10 **pharma** companies (VP/C-level interest) |
| Use cases | Molecular design, synthesis planning, drug discovery |

**Bottom line:** FutureHouse created BixBench as a research contribution but their commercial focus (Edison) is chemistry/pharma. Polymer's real competition is **Kepler** and **ScienceMachine**.

---

## Competitor #1: ScienceMachine

**Website**: https://www.sciencemachine.ai/
**Funding**: $3.5M pre-seed (Revent, Nucleus Capital, Juniper, Opal Ventures)
**Team**: 2 people (Lorenzo Sani - CEO, Benjamin Tenmann - CTO)
**Location**: London, UK + San Francisco office

### Founders

| Founder | Role | Background |
|---------|------|------------|
| **Lorenzo Sani** | CEO | Imperial College London, Y Combinator alum, serial entrepreneur |
| **Benjamin Tenmann** | CTO | Cambridge, Computational Biologist → ML Engineer |

Both co-authored the BixBench paper with FutureHouse researchers.

### Product: "Sam" - AI Bioinformatician

Sam is an autonomous AI agent that acts as a "24/7 AI bioinformatician":
- Processes experimental data without human intervention
- Handles cleaning, structuring, statistical analysis, and visualization
- Integrates directly with existing databases and lab workflows
- Continuously processes data to find patterns and insights
- Described as a "reflexive interactive dashboard"

### Technical Approach (Limited Public Details)

| Aspect | What We Know |
|--------|--------------|
| Architecture | Autonomous agent, likely single-agent |
| Integration | Direct database/workflow integration |
| Operation | 24/7 continuous processing |
| Interface | "Reflexive interactive dashboard" |
| Transparency | Full code/decision transparency claimed |

**Note:** ScienceMachine has not published detailed technical architecture. Their competitive advantage may be in execution rather than novel architecture.

### Capabilities

| Use Case | Description |
|----------|-------------|
| Flow Cytometry | Identifies cell populations from cytometry data |
| Mass Spectrometry | Identifies key peptides from MS data |
| RNA-seq | Identifies differentially expressed genes |
| Image Segmentation | Identifies cell densities through automated segmentation |
| Report Generation | Auto-generates documentation from data |

### Competitive Position

**Strengths:**
- Co-created BixBench (intimate knowledge of benchmark)
- Broader assay coverage than Polymer (flow cytometry, mass spec, imaging)
- Production customers claiming 3x faster results at fraction of cost
- Enterprise security focus (data stays in user environment)
- Lean 2-person team shipping production software

**Potential Weaknesses:**
- 2-person team (capacity constraints for enterprise support)
- Less focus on statistical validation/review
- Unknown multi-omic integration story
- Limited public technical documentation

---

## Competitor #2: FutureHouse / Edison Scientific

**Website**: https://www.futurehouse.org/
**Structure**: Non-profit (FutureHouse) + For-profit spinout (Edison Scientific)
**Funding**: Philanthropic (Eric Schmidt) + $70M seed for Edison at $250M valuation
**Investors**: Spark Capital, Triatomic Capital, Jeff Dean (Google), Dmitri Alperovitch (CrowdStrike)
**Team**: Well-funded research organization

### Primary Focus: CHEMISTRY, NOT BIOINFORMATICS

**Important:** FutureHouse/Edison co-created BixBench but their **product focus is chemistry and drug discovery**, not bioinformatics.

| Evidence | Details |
|----------|---------|
| Co-founder | Andrew White: ML in chemistry, chemical engineering background |
| Flagship model | ether0: 24B reasoning model **for chemistry** |
| Key product | ChemCrow: First LLM agents **in chemistry** |
| Dataset | Robin: Scientific reasoning dataset **for chemistry** |
| Customers | 6 of top 10 **pharma** companies (VP/C-level interest) |

**Implication:** They are NOT a direct bioinformatics competitor. BixBench was a research contribution, not their commercial focus.

### Products: Multiple Specialized Agents

| Agent | Purpose | Domain |
|-------|---------|--------|
| **Crow** (formerly Paper QA) | Literature search and synthesis | General |
| **Owl** (formerly Has Anyone) | Prior work discovery | General |
| **Falcon** | Expanded source compilation | General |
| **Phoenix** | Chemistry experiment planning | **Chemistry** |
| **Finch** | Data-driven discovery in biology | Biology |
| **Kosmos** | Full "AI scientist" | **Chemistry/Pharma** |
| **ether0** | 24B open-weights reasoning model | **Chemistry** |

### Kosmos: The AI Scientist

Kosmos is their flagship product:
- Given a goal and datasets, iterates among data analysis, literature search, and hypothesis generation
- Returns fully cited research reports
- Users report it "compresses months of work into a single day"
- **Primary use case**: Drug discovery, molecular design (pharma customers)

### Scientific Achievements

**Real Discovery**: In May 2025, FutureHouse's Robin system identified ripasudil as a potential treatment for dry age-related macular degeneration (dAMD) - demonstrating AI can make genuine scientific discoveries.

### Competitive Position

**Why they're NOT a direct threat to Polymer:**
- Focus on chemistry/drug discovery, not bioinformatics pipelines
- BixBench was research output, not product direction
- Pharma customers want molecular design, not RNA-seq analysis
- Their agents (Phoenix, ether0) are chemistry-specialized

**Why to watch them anyway:**
- Massive funding ($70M+) could pivot anywhere
- Literature agents (Crow, Owl) overlap with research automation
- Finch (biology agent) could expand into bioinformatics
- Open-weights model release shows technical depth
- Eric Schmidt backing attracts talent

---

## Competitor #3: Kepler AI

**Website**: https://www.getkepler.ai/
**BixBench Score**: 33.4% (current SOTA)
**Funding**: PearX S25 (Pear VC accelerator)
**Location**: San Francisco

### Founders

| Founder | Role | Background |
|---------|------|------------|
| **Ashton Teng** | CEO | GRAIL, Foresite Labs, Xaira Therapeutics; Stanford MS Informatics, Berkeley Neuroscience/CS |
| **Quinn Leng** | CTO | Databricks (led compute/storage team 100→10K employees); CMU MS Distributed Systems |
| **John Kim** | CSO | Xaira Therapeutics, Foresite Labs (led bioinformatics) |

**Advisor**: Hans Bishop (President/Co-Chair Altos Labs, former CEO of GRAIL, former CEO Juno Therapeutics)

### Technical Architecture (DETAILED)

#### Infrastructure: Firecracker MicroVMs

Kepler uses **E2B's open-source sandbox framework** built on **Firecracker microVMs** (same technology as AWS Lambda/Fargate):

| Feature | Specification |
|---------|---------------|
| Isolation | Hardware-enforced VM boundaries (not containers) |
| Security | Separate kernel, memory, virtualized hardware per task |
| Concurrency | 1,000+ concurrent agent tasks |
| Escape protection | Eliminates container escape vulnerability class |

#### Pause-and-Resume Workflows

| Capability | Details |
|------------|---------|
| State captured | Filesystem, memory, running processes, loaded variables |
| Pause time | ~4 seconds per GB RAM |
| Resume time | ~1 second |
| Persistence | Up to 30 days paused |

**Implication:** Researchers can pause expensive analyses overnight and resume without losing state.

#### Versioned Data Storage

- Agents can "branch, mutate, and experiment without touching primary data"
- Full audit trail with time-travel across changes
- Supports both tabular and unstructured data

#### Agent Architecture Philosophy

**Key insight from Quinn Leng:** Kepler used a **simple single-agent architecture** for BixBench, beating multi-agent approaches like K-Dense Analyst (which used 10 specialized agents).

Three core technical challenges they solve:

| Challenge | Kepler's Approach |
|-----------|-------------------|
| **Alignment & Integration** | Domain-specific workflows with 100s of GB multi-modal biological data |
| **Verifiability** | Results trace to specific experiments/database rows, not hallucinated |
| **Interaction Model** | Transparent agent reasoning for experimental scientists (not bioinformaticians) |

### Kepler Platform Overview

Kepler is a direct competitor offering an agentic bioinformatics research platform. Key architecture:

- **Kepler Agent Runtime**: Specialized containerized bioinformatics environment with curated tools
- **Kepler Agent**: LLM-based agent designed to interact with the runtime
- **Architecture**: Single-agent (notably NOT multi-agent like Polymer's PI/Pipeline/Review hierarchy)
- **Value Prop**: "Interactive analysis" with step-by-step execution, transparent reasoning, user conferral at decision points

---

## Kepler Technical Capabilities

### Compute Environment
- **OS**: Ubuntu 24.04 sandbox
- **RAM**: 32 GiB
- **Storage**: `/workspace` directory (limited space)

### Pre-installed Bioinformatics Tools
| Category | Tools |
|----------|-------|
| QC | FastQC, MultiQC |
| Alignment | BWA, Bowtie2 |
| Post-alignment | Picard, GATK |
| Variant Calling | GATK HaplotypeCaller, bcftools |
| Utilities | samtools, bedtools |

### Bioconductor Packages
| Category | Packages |
|----------|----------|
| Data Structures | SingleCellExperiment |
| Differential Expression | DESeq2, limma, edgeR |
| ChIP-seq/Epigenomics | DiffBind, ChIPpeakAnno, ChIPseeker, Signac, MotifDb |

### Pre-attached Datasets (7)
| Dataset | Description |
|---------|-------------|
| Pseudobulk Tahoe-100M | Single-cell perturbation atlas (gene expression) |
| Single Cell Tahoe-100M | TileDB-SOMA single-cell perturbation data |
| DepMap | Comprehensive cancer genomics (Broad Institute) |
| GTEx | Genotype-Tissue Expression (public resource) |
| CZI CELLxGENE | Single-cell genomics census |
| OpenTargets GraphQL | Target-disease associations, genetic evidence |
| HPO Terms API | 15,000+ standardized phenotype terms |

---

## Kepler Stated Limitations

### What Kepler CANNOT Handle
- **Full WGS**: FASTQ files 50-200+ GB per sample
- **Large cohorts**: Multiple samples exhaust storage/RAM
- **Human genome alignment**: Requires ~30+ GB RAM, hours of compute per sample
- **Large GEO downloads**: Bandwidth and storage limitations

### What Kepler CAN Handle
- Small targeted sequencing (exome, amplicon, gene panels)
- Small datasets (few samples, limited coverage)
- Subset/downsampled data (demos, testing)
- Already-processed data (BAM, VCF files)
- Methylation analysis (450K, EPIC arrays, WGBS, RRBS)

---

## Gap Analysis: Polymer vs Kepler

### Kepler Advantages (Polymer Gaps)
| Feature | Kepler | Polymer |
|---------|--------|---------|
| Pre-attached datasets | 7 major sources | None (must load via GEO/TCGA) |
| ChIP-seq tools | DiffBind, ChIPseeker, Signac | Not implemented |
| Interactive conferral | Built-in decision checkpoints | Limited |
| NGS alignment | BWA, Bowtie2, GATK pipeline | Not implemented |

### Polymer Advantages
| Feature | Polymer | Kepler |
|---------|---------|--------|
| Multi-agent review | Statistical + Methodological + Clinician | Single agent |
| Provenance tracking | Full RuntimeTracker | Unknown |
| MAE/Multi-omic | Native MAE contract | Unknown |
| Scalability | BPCells for 40M+ cells | 32 GiB RAM limit |
| Methods Observatory | PMC literature mining | No equivalent |

---

## Deep Dive: Competitor Technical Approaches

### Kepler's Winning Formula

**Why did Kepler beat multi-agent systems with a single agent?**

Quinn Leng (CTO) identified three factors:

| Factor | Implementation | Polymer Implication |
|--------|----------------|---------------------|
| **Verifiability** | Results trace to specific database rows/experiments | Polymer's RuntimeTracker already does this |
| **Domain alignment** | Workflows handle 100s GB multi-modal biological data | SE Contract ensures dimensional integrity |
| **Transparent reasoning** | Agent reasoning visible to scientists | Consider exposing agent thought process |

**Infrastructure advantages:**

| Kepler Feature | How It Helps | Polymer Gap? |
|----------------|--------------|--------------|
| MicroVM isolation | Security + multi-tenancy | Polymer uses containers (less isolated) |
| Pause/resume (30 days) | Cost optimization, long analyses | Not implemented |
| Versioned data storage | Branch/experiment without affecting source | ObjectStore has tiers but not branching |
| 1000+ concurrent tasks | Scale for enterprise | Unknown Polymer concurrency limits |

**Key insight:** Kepler's SOTA came from **infrastructure excellence**, not agent complexity. Simple agent + robust execution environment.

### ScienceMachine's Approach

**What we know (limited public detail):**

| Aspect | ScienceMachine | Implication |
|--------|----------------|-------------|
| Team | 2 people shipping production software | Extreme automation/efficiency |
| Architecture | Likely single autonomous agent | Matches Kepler's single-agent success |
| Differentiation | Broader assay coverage | Flow cytometry, mass spec, imaging |
| Integration | Direct database/workflow connection | Minimal friction for wet-lab scientists |
| Transparency | "Every line of code and decision visible" | Trust through explainability |

**Benchmark insider advantage:** As BixBench co-creators, ScienceMachine knows:
- What types of questions are asked
- What tools are needed to answer them
- What makes answers correct vs incorrect
- Edge cases and failure modes

### What Polymer Can Learn

#### From Kepler:

2. **Infrastructure matters as much as agent design**
   - Consider MicroVM isolation (E2B framework is open source)
   - Implement pause/resume for long analyses
   - Add versioned data branching
3. **Verifiability is key differentiator**
   - Every result must trace to source data
   - RuntimeTracker is an advantage - make it visible to users

#### From ScienceMachine:
1. **Broader assay coverage wins customers**
   - Flow cytometry, mass spectrometry are gaps
   - Consider partnerships vs building in-house
2. **Wet-lab scientist UX matters**
   - They don't want to think about bioinformatics
   - Natural language interface is table stakes
3. **Benchmark creation = domain authority**
   - Polymer's Methods Observatory could become a benchmark
   - Publishing benchmarks establishes credibility

### Technical Approach Comparison Matrix

| Dimension | Kepler | ScienceMachine | Polymer |
|-----------|--------|----------------|---------|
| Agent architecture | Single agent | Single agent (likely) | Multi-agent hierarchy |
| Execution environment | MicroVM (Firecracker) | Unknown | Containers + R-Plumber |
| State management | Pause/resume (30 days) | Unknown | Session-based |
| Data versioning | Branch/experiment | Unknown | Medallion tiers |
| Concurrency | 1000+ tasks | Unknown | Unknown |
| Verifiability | Traces to DB rows | "Every decision visible" | RuntimeTracker |
| Security model | Hardware VM isolation | "Data stays in your environment" | Standard cloud |

---

## Raw Data Processing & Storage Comparison

### Architectural Philosophy

| Aspect | Kepler | Polymer |
|--------|--------|---------|
| **Model** | Interactive Sandbox | Cloud-Native Streaming |
| **Resources** | Fixed (32 GiB RAM, limited disk) | Dynamic (S3-backed, no ceiling) |
| **Target** | Session-based analysis | Pipeline-scale processing |

### Kepler: Fixed Sandbox Approach

**Resources:**
- 32 GiB RAM (hard ceiling)
- Ubuntu 24.04 containerized environment
- `/workspace` directory with limited storage
- All tools pre-installed in container

**Raw Data Capabilities:**
- Full NGS alignment pipeline (BWA, Bowtie2, GATK)
- Variant calling (HaplotypeCaller, bcftools)
- QC tools (FastQC, MultiQC, Picard)

**Hard Limits (from Kepler's own documentation):**
- WGS FASTQ files (50-200GB): **Cannot process**
- Human genome alignment (~30GB RAM): **At ceiling**
- Large cohorts: **Storage/RAM exhaustion**
- Large GEO downloads: **Bandwidth/storage constraints**

**Sweet Spot:** Pre-processed data, small targeted panels, methylation arrays

### Polymer: Cloud-Native Streaming Approach

**Resources:**
- No fixed RAM ceiling (streaming ingestion)
- S3-backed object storage (unlimited)
- Pay-per-use cost model
- Tools deployed via R-Plumber microservice

**Raw Data Capabilities:**
- **NO alignment tools** (no BWA, Bowtie2, GATK)
- Expects pre-processed inputs (count matrices, beta values)
- GEO/TCGA fetching with automatic SE Contract conversion

**Scalability Features:**
| Feature | Specification |
|---------|---------------|
| Max file upload | 5TB (multipart) |
| Streaming buffer | 50K rows (~40MB RAM) |
| Sparse matrix | 64-bit (>2.14B elements) |
| Single-cell | BPCells: 40M cells @ ~50MB RAM |
| Storage tiers | HOT/WARM/COLD + Medallion layers |

**Storage Formats:**
- **Zarr**: Cloud-native chunked arrays (S3 default)
- **HDF5**: Local/Bioconductor-compatible (local default)
- **Parquet**: Tabular metadata (colData, rowData)

### Head-to-Head Comparison

| Dimension | Kepler | Polymer | Winner |
|-----------|--------|---------|--------|
| RAM ceiling | 32 GiB fixed | Unlimited (streaming) | **Polymer** |
| Raw FASTQ alignment | BWA, Bowtie2, GATK | None | **Kepler** |
| Variant calling | HaplotypeCaller, bcftools | None | **Kepler** |
| Max file size | ~50GB (workspace limit) | 5TB (multipart S3) | **Polymer** |
| Single-cell scale | ~100K cells (RAM bound) | 40M+ cells (BPCells) | **Polymer** |
| Pre-loaded datasets | 7 major sources | Must fetch (GEO/TCGA) | **Kepler** |
| Session startup | Instant (pre-loaded) | Fetch required | **Kepler** |
| Cost model | Fixed sandbox | Pay-per-use | Context-dependent |
| Multi-omic integration | Unknown | Native MAE contract | **Polymer** |

### BixBench Implications

**Critical insight:** BixBench uses **pre-processed data**, not raw FASTQ files.

- Kepler's alignment tools (BWA/GATK): **Likely NOT a BixBench advantage**
- Kepler's pre-attached datasets: **MAY speed up some tasks** (GTEx, DepMap questions)
- Polymer's scale advantage: **Irrelevant for benchmark-sized datasets**

**Where Kepler wins on BixBench:**
1. Pre-loaded GTEx, DepMap, CELLxGENE data = faster context retrieval
2. Interactive sandbox = no data loading latency
3. Broader tool coverage (ChIP-seq, variant analysis)

**Where Polymer could win:**
1. Validated statistical accuracy (DESeq2, limma correlation 0.999+)
2. Multi-agent review catches errors Kepler's single agent misses
3. Native SE Contract ensures dimensional integrity

---

## Strategic Recommendations

### Competitive Reality Check

**Direct competitors (bioinformatics focus):**
1. **Kepler** - Current SOTA (33.4%), strong interactive UX, pre-loaded datasets
2. **ScienceMachine** - BixBench co-creator, broader assay coverage (flow cytometry, MS, imaging)

**Adjacent players (not direct competitors):**
3. **FutureHouse/Edison** - Chemistry/drug discovery focus, not bioinformatics

**The bar is high.** Beating BixBench SOTA is necessary but not sufficient.

### Immediate (BixBench Focus)
1. **Target 35%+ accuracy** - Must beat Kepler's 33.4%
2. **Pre-load datasets**: Add Tahoe-100M, DepMap, GTEx connectors (Kepler's advantage)
3. **Answer formatting**: Exact-match precision is critical
4. **Study BixBench structure**: ScienceMachine/FutureHouse created it - understand their design choices

### Medium-term (Feature Parity with ScienceMachine)
1. **Broader assay coverage**: Flow cytometry, mass spectrometry (Sam's differentiators)
2. **ChIP-seq pipeline**: Add DiffBind, ChIPseeker to Tool Registry
3. **Autonomous operation**: Sam runs "24/7 without intervention" - match this
4. **Interactive checkpoints**: Agent-user conferral at analytical decision points

### Long-term (Differentiation vs FutureHouse/Edison)
1. **Multi-agent review advantage**: Statistical + Methodological + Clinician review
   - FutureHouse has specialized agents but unclear if they have a review layer
   - Position Polymer as "publication-quality findings" vs "fast insights"
2. **Learning system**: Implement agent learning (see Research-Backed Implementation)
   - None of the competitors have documented learning systems
   - This could be Polymer's moat
3. **Scale**: BPCells for 40M+ cells - beyond Kepler's 32GB ceiling
4. **Methods Observatory**: Competitive intelligence on emerging tools
5. **Open science**: Consider open-sourcing components (FutureHouse released ether0)

### Positioning Matrix (Direct Competitors Only)

| Attribute | Kepler | ScienceMachine | **Polymer Current** |
|-----------|--------|----------------|-------------------|
| BixBench | 33.4% SOTA | Unknown (co-creators) | Target: **>35%** |
| Architecture | Single-agent sandbox | Autonomous agent (Sam) | **Multi-agent hierarchy** |
| Review layer | None apparent | Unknown | **Statistical + Methodological + Clinician** |
| Learning system | None documented | Unknown | **✅ Implemented (Path 5)** |
| Precision matching | Unknown | Unknown | **✅ Implemented (Path 6)** |
| Assay coverage | NGS, methylation, ChIP | Flow cytometry, MS, imaging, RNA-seq | RNA-seq, methylation (expand) |
| Scale | 32GB RAM ceiling | Unknown | **40M+ cells (BPCells)** |
| Pre-loaded data | 7 datasets | Unknown | Must fetch (gap to close) |
| Provenance | Unknown | Unknown | **Full RuntimeTracker** |
| Validation | Unknown | Unknown | **0.999 correlation with Bioconductor** |

---

## BixBench Recalibration

### Previous Target (vs Claude 17%)
From CAPSULE_ANALYSIS.md:
- POLYMER_NATIVE: 44 questions @ 65% = 28 correct
- POLYMER_CAPABLE: 47 questions @ 35% = 16 correct
- **Total: ~49 correct (23.9%)**

### New Target (vs Kepler 33.4%)
To beat 33.4% (69 correct out of 205):
- POLYMER_NATIVE: 44 questions @ **80%** = 35 correct
- POLYMER_CAPABLE: 47 questions @ **55%** = 26 correct
- PARTIAL: 22 questions @ **30%** = 7 correct
- **Total: 68 correct (33.2%)** - Still not enough

**Required adjustment**: Either expand capability coverage OR achieve near-perfect accuracy on native questions.

---

## Proposed: Agent Learning System

### Concept: Continuous Improvement Through Explicit Learning Directives

**Key differentiator from Kepler:** While Kepler uses a stateless single-agent architecture, Polymer agents will have explicit directives to learn and improve with each experiment.

---

### Research Foundation

#### Key Papers & Techniques

| Source | Technique | Key Finding |
|--------|-----------|-------------|
| [Reflexion (arXiv 2303.11366)](https://arxiv.org/abs/2303.11366) | Verbal RL with episodic memory | 91% pass@1 on HumanEval (vs GPT-4's 80%) |
| [MAR (arXiv 2512.20845)](https://arxiv.org/abs/2512.20845) | Multi-agent debate for reflection | Avoids "degeneration of thought" in single-agent reflection |
| [SEAL (NeurIPS 2025)](https://yoheinakajima.com/better-ways-to-build-self-improving-ai-agents/) | Self-edit instructions | Factual QA: 33.5% → 47%; few-shot: 0% → 72.5% |
| [Ralph Wiggum](https://github.com/ghuntley/how-to-ralph-wiggum) | File-based persistent state | Learning survives context resets via markdown files |
| [DORA (COLING 2025)](https://aclanthology.org/2025.coling-main.504.pdf) | Bayesian optimization for reflection prompts | Auto-optimizes reflection prompt effectiveness |

#### Critical Research Insights

**1. Degeneration of Thought Problem**
> "Continual reflections of the same LLM onto itself exhibit degeneration of thought, where the LLM continues to repeat the same errors." — MAR Paper

**Solution:** Use multi-agent debate (Polymer's Review Agents) instead of single-agent self-reflection.

**2. External Verification > Self-Correction**
> "LLMs may produce stubborn (46.7%) or highly random (45.7%) self-evaluations in the absence of external feedback." — Self-Evaluation Research

**Solution:** Review Agents provide external verification; don't rely on Pipeline Agents to self-correct.

**3. File-Based Persistence (Ralph Wiggum Pattern)**
> "Fresh context per task prevents token bloat; persistent files transfer learning." — Ralph Wiggum Methodology

**Key files that survive context resets:**
```
/learnings/
├── DOMAIN_INSIGHTS.md       # Biological knowledge (like AGENTS.md)
├── PARAMETER_PATTERNS.md    # What works for what data types
├── FAILURE_PATTERNS.md      # Anti-patterns to avoid
└── IMPLEMENTATION_PLAN.md   # Current task state + discoveries
```

**4. Experience Replay for Prompting**
> "Store successful trajectory from each solved task. Future attempts prompted with past successful traces as in-context examples." — Yohei Nakajima

**Result:** ALFWorld improved from 73% → 89-93% without gradient updates.

---

### Research-Backed Implementation Tiers

#### Tier 1: Reflexion with Multi-Agent Debate (No Retraining)

```
┌─────────────────────────────────────────────────────────────┐
│                    REFLEXION LOOP                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PI Agent proposes hypothesis                                │
│       ↓                                                      │
│  Pipeline Agent executes analysis                            │
│       ↓                                                      │
│  Review Agents DEBATE findings (MAR-style multi-persona)     │
│       ↓                                                      │
│  Reflection extracted and stored to EPISODIC MEMORY          │
│       ↓                                                      │
│  Future analyses QUERY relevant reflections                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Why multi-agent debate matters:**
- Statistical Reviewer challenges methodological assumptions
- Methodological Reviewer challenges statistical interpretations
- Clinician Reviewer challenges biological plausibility
- Debate prevents single-agent "degeneration of thought"

#### Tier 2: Ralph-Style Persistent Files

**DOMAIN_INSIGHTS.md** (survives all sessions)
```markdown
## AML (Acute Myeloid Leukemia)
- FLT3-ITD mutations associated with poor prognosis [exp_001, exp_047]
- NPM1 mutations often co-occur with DNMT3A [exp_023]
- Confidence: 0.85

## Methylation Normalization
- Funnorm works best for EPIC arrays with batch effects [exp_012, exp_089]
- Quantile normalization can overcorrect biological signal [exp_034]
- Confidence: 0.72
```

**PARAMETER_PATTERNS.md** (survives all sessions)
```markdown
## DESeq2 Filtering
| Dataset Size | Min Count | Min Samples | Success Rate |
|--------------|-----------|-------------|--------------|
| < 50 samples | 10        | 3           | 0.89         |
| 50-200       | 10        | 5           | 0.92         |
| > 200        | 5         | 10          | 0.94         |

## Enrichment Databases
| Question Type | Best Database | Reason |
|---------------|---------------|--------|
| Cancer pathways | KEGG + Hallmark | Curated cancer sets |
| Immune response | GO:BP + Reactome | Detailed immune ontology |
| Drug targets | MSigDB C2 | Pharmacogenomic relevance |
```

**FAILURE_PATTERNS.md** (anti-patterns to avoid)
```markdown
## Statistical Anti-Patterns
- NEVER use unadjusted p-values for multiple comparisons [exp_007, exp_041]
- NEVER run DESeq2 on pre-normalized data [exp_015]
- NEVER interpret fold-change without statistical significance [exp_028]

## Data Quality Anti-Patterns
- REJECT datasets with >30% missing values without imputation strategy [exp_033]
- FLAG samples with library size <1M reads [exp_056]
- WARN when PCA shows batch effect larger than biological effect [exp_067]
```

#### Tier 3: Experience Replay for In-Context Learning

**Mechanism:** Inject relevant past successes into agent prompts.

```python
class ExperienceReplayPrompt:
    """Inject successful trajectories as in-context examples"""

    async def build_prompt(self, current_task: AnalysisTask) -> str:
        # Find similar past successes
        similar_tasks = await self.memory.find_similar_successes(
            data_type=current_task.data_type,
            analysis_type=current_task.analysis_type,
            k=3  # Top 3 most similar
        )

        prompt = f"""
## Current Task
{current_task.description}

## Similar Past Successes (for reference)

### Example 1: {similar_tasks[0].summary}
**Approach:** {similar_tasks[0].approach}
**Parameters:** {similar_tasks[0].parameters}
**Outcome:** {similar_tasks[0].outcome}
**Key Learning:** {similar_tasks[0].reflection}

### Example 2: {similar_tasks[1].summary}
...

## Your Task
Apply learnings from past successes to the current analysis.
Explicitly state which past patterns you're applying and why.
"""
        return prompt
```

#### Tier 4: Reflection Prompt Templates (DORA-Inspired)

**Post-Analysis Reflection Prompt:**
```
You just completed an analysis. Reflect on the following:

1. OUTCOME ASSESSMENT
   - Did the analysis produce interpretable results?
   - Were there any unexpected patterns or anomalies?
   - How confident are you in the findings (0-1)?

2. METHODOLOGY REVIEW
   - What parameters did you choose and why?
   - Would different parameters have been better? Which ones?
   - What assumptions did you make? Were they valid?

3. DOMAIN LEARNING
   - Did you discover any biological insights worth remembering?
   - Did this confirm or contradict prior knowledge?
   - What would you do differently next time?

4. TRANSFERABLE PATTERNS
   - Is this approach reusable for similar datasets?
   - What characteristics make a dataset suitable for this approach?
   - Rate the generalizability of this solution (0-1).

Structure your reflection as JSON for storage:
{
  "outcome_quality": 0.0-1.0,
  "confidence": 0.0-1.0,
  "parameters_optimal": true/false,
  "suggested_parameters": {...},
  "domain_insight": "...",
  "transferable": true/false,
  "reusability_score": 0.0-1.0,
  "next_time_different": "..."
}
```

**Pre-Analysis Recall Prompt:**
```
Before starting this analysis, review relevant past learnings:

## Relevant Domain Insights
{domain_insights_for_this_data_type}

## Parameter Recommendations
{parameter_patterns_for_this_analysis_type}

## Anti-Patterns to Avoid
{failure_patterns_for_this_context}

## Similar Past Successes
{experience_replay_examples}

Apply these learnings to your current analysis.
Explicitly note when you're following or deviating from past patterns.
```

---

### Avoiding Known Pitfalls

| Pitfall | Research Finding | Polymer Mitigation |
|---------|------------------|-------------------|
| Degeneration of thought | Single-agent reflection degrades | Multi-agent Review debate |
| Stubborn self-evaluation | LLMs resist changing conclusions | External Review Agents verify |
| Overcorrection | Reflection can degrade correct answers | Only reflect on failures/rejections |
| Context pollution | Learning files bloat token usage | Strict file discipline (Ralph pattern) |
| Echo chamber | Self-generated data reinforces errors | Cross-reference with Methods Observatory |

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Learning Memory Store                     │
│  (Persistent knowledge base across experiments/sessions)     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Successes   │  │ Failures    │  │ Domain Insights     │  │
│  │ (patterns   │  │ (anti-      │  │ (biological         │  │
│  │  that work) │  │  patterns)  │  │  knowledge gained)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    PI Agent     │ │ Pipeline Agents │ │  Review Agents  │
│                 │ │                 │ │                 │
│ DIRECTIVE:      │ │ DIRECTIVE:      │ │ DIRECTIVE:      │
│ "Learn which    │ │ "Learn optimal  │ │ "Learn common   │
│ hypotheses lead │ │ parameter       │ │ statistical     │
│ to significant  │ │ choices for     │ │ pitfalls and    │
│ findings"       │ │ data types"     │ │ reviewer blind  │
│                 │ │                 │ │ spots"          │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Learning Directive Types

#### 1. PI Agent Learning Directives
```
LEARN_HYPOTHESIS_OUTCOMES:
  - Track which hypothesis formulations lead to significant findings
  - Record dataset characteristics that predict analysis success
  - Build intuition for promising research directions

LEARN_DELEGATION_PATTERNS:
  - Which pipeline agent combinations work best for multi-omic questions
  - Optimal sequencing of analyses (e.g., QC → normalize → DE → enrichment)
  - When to request additional data vs proceed with available data
```

#### 2. Pipeline Agent Learning Directives
```
LEARN_PARAMETER_OPTIMIZATION:
  - DESeq2: Learn optimal filtering thresholds by dataset size/sparsity
  - Methylation: Learn which normalization methods work for which platforms
  - Enrichment: Learn which gene set databases yield actionable results

LEARN_DATA_PATTERNS:
  - Recognize batch effects before they corrupt analysis
  - Identify outlier samples that should be flagged
  - Detect when data quality is insufficient for requested analysis
```

#### 3. Review Agent Learning Directives
```
LEARN_COMMON_ERRORS:
  - Statistical: Multiple testing corrections missed, wrong test chosen
  - Methodological: Inappropriate normalization, confounders ignored
  - Clinical: Overinterpretation of marginal significance

LEARN_QUALITY_THRESHOLDS:
  - What p-value thresholds have historically held up to scrutiny
  - Which effect sizes are biologically meaningful vs statistically significant
  - When to reject findings vs request additional validation
```

### Implementation Components

#### LearningMemory Service
```python
class LearningMemory:
    """Persistent store for agent learnings across experiments"""

    async def record_success(
        self,
        agent_id: str,
        experiment_id: str,
        pattern: SuccessPattern
    ) -> None:
        """Record a successful analysis pattern for future reference"""

    async def record_failure(
        self,
        agent_id: str,
        experiment_id: str,
        anti_pattern: FailurePattern,
        root_cause: str
    ) -> None:
        """Record what went wrong and why"""

    async def record_insight(
        self,
        agent_id: str,
        experiment_id: str,
        insight: DomainInsight
    ) -> None:
        """Record biological/domain knowledge gained"""

    async def query_relevant_learnings(
        self,
        context: AnalysisContext
    ) -> List[Learning]:
        """Retrieve learnings relevant to current analysis"""
```

#### Learning-Augmented Agent Prompts
```python
class LearningAugmentedAgent:
    """Base class for agents with learning directives"""

    async def pre_analysis_recall(self, context: AnalysisContext) -> str:
        """Inject relevant past learnings into agent context"""
        learnings = await self.memory.query_relevant_learnings(context)
        return self._format_learnings_for_prompt(learnings)

    async def post_analysis_reflect(
        self,
        context: AnalysisContext,
        result: AnalysisResult
    ) -> None:
        """Extract and store learnings from completed analysis"""
        # Agent explicitly reflects on what worked/didn't
        reflection = await self._generate_reflection(context, result)
        await self._store_learnings(reflection)
```

### Data Model

```python
class SuccessPattern(BaseModel):
    """A pattern that led to successful analysis"""
    data_type: str              # e.g., "rnaseq", "methylation"
    dataset_characteristics: dict  # size, sparsity, platform
    approach_taken: str         # What the agent did
    parameters_used: dict       # Specific parameter choices
    outcome_quality: float      # 0-1 score
    reusability_score: float    # How generalizable is this pattern

class FailurePattern(BaseModel):
    """An anti-pattern to avoid"""
    data_type: str
    attempted_approach: str
    failure_mode: str           # What went wrong
    root_cause: str             # Why it went wrong
    prevention_strategy: str    # How to avoid in future

class DomainInsight(BaseModel):
    """Biological/domain knowledge gained"""
    domain: str                 # e.g., "AML", "breast cancer", "methylation"
    insight: str                # The knowledge gained
    supporting_evidence: str    # What experiment supported this
    confidence: float           # 0-1 confidence score
    references: List[str]       # PMIDs or experiment IDs
```

### Learning Triggers

| Event | Learning Action |
|-------|-----------------|
| Analysis completes successfully | Record success pattern + parameters |
| Review agent rejects finding | Record failure pattern + root cause |
| Reviewer consensus achieved | Record validated insight |
| Unexpected data pattern detected | Record domain insight |
| User provides feedback | Record correction + update confidence |

### Competitive Advantage

| Aspect | Kepler (Stateless) | Polymer (Learning) |
|--------|-------------------|-------------------|
| Session memory | None (fresh each time) | Persistent across experiments |
| Parameter tuning | Manual/defaults | Learns optimal per data type |
| Error patterns | Repeats mistakes | Learns to avoid |
| Domain knowledge | LLM training only | Accumulates from experiments |
| Institutional memory | None | Builds over time |

### Integration with Existing Architecture

**RuntimeTracker Integration:**
- Learning events become first-class provenance entries
- Every learning is traceable to its source experiment
- Learnings can be audited and corrected

**Review Agent Integration:**
- Reviewers explicitly flag learnings during certification
- Rejected findings become failure patterns
- Approved findings become success patterns + domain insights

**Methods Observatory Integration:**
- Cross-reference learnings with literature-derived methods
- Validate that learned patterns align with published best practices
- Identify when Polymer discovers novel approaches

### Success Metrics

1. **Learning Accumulation Rate**: Learnings recorded per experiment
2. **Recall Utilization**: % of analyses that use past learnings
3. **Error Reduction**: Decrease in reviewer rejections over time
4. **Parameter Convergence**: Stabilization of optimal parameter choices
5. **BixBench Improvement**: Accuracy gain attributable to learning

---

## References

### Competitive Intelligence
- Kepler announcement: https://www.getkepler.ai/news/kepler-achieves-state-of-the-art-performance-on-bixbench-computational-biology-benchmark
- ScienceMachine: https://www.sciencemachine.ai/
- ScienceMachine funding: https://tech.eu/2025/07/09/sciencemachine-raises-35m-for-leading-autonomous-ai-in-biotech-research/
- FutureHouse: https://www.futurehouse.org/
- FutureHouse platform launch: https://www.futurehouse.org/research-announcements/launching-futurehouse-platform-ai-agents
- Edison Scientific spinout ($70M): https://techfundingnews.com/edison-raises-70m-ai-scientist-platform/
- BixBench announcement: https://www.futurehouse.org/research-announcements/bixbench
- BixBench benchmark: https://github.com/Future-House/BixBench
- BixBench paper: https://arxiv.org/abs/2503.00096

---

## STRATEGIC DEVELOPMENT PLAN: Beating Kepler & ScienceMachine

### BixBench Question Analysis

Based on analysis of 298 benchmark questions, BixBench tests:

| Question Type | Example | % of Benchmark | Polymer Readiness |
|---------------|---------|----------------|-------------------|
| **Statistical value extraction** | "What is the adjusted p-value for X?" | ~40% | HIGH (R-Plumber) |
| **Differential expression** | DESeq2, limma results interpretation | ~25% | HIGH (validated) |
| **Pathway enrichment** | GO/KEGG over-representation analysis | ~15% | MEDIUM (needs tools) |
| **Phylogenetics** | BUSCO, treeness, evolutionary rates | ~10% | LOW (not implemented) |
| **Variant analysis** | VAF filtering, CHIP variants | ~5% | LOW (not implemented) |
| **Image/Colony analysis** | Area, circularity measurements | ~5% | NOT IMPLEMENTED |

**Critical insight:** Questions require **exact numerical precision** - not approximate answers. Claude 3.5 Sonnet's 17% baseline shows even strong LLMs fail without actual computation.

---

### DEVELOPMENT PATH 1: Infrastructure Excellence (Kepler's Formula)

**Goal:** Match Kepler's execution environment quality

**Rationale:** Kepler beat 10-agent systems with a single agent. Their edge is infrastructure, not agent complexity.

| Component | Current Polymer | Target | Priority |
|-----------|-----------------|--------|----------|
| Execution isolation | Docker containers | Firecracker MicroVMs (E2B) | HIGH |
| State preservation | Session-based | Pause/resume (30 days) | MEDIUM |
| Data versioning | Medallion tiers | Branch/experiment without affecting source | MEDIUM |
| Concurrency | Unknown | 1000+ concurrent tasks | LOW |

**Implementation:**
```
Phase 1: Evaluate E2B framework integration
Phase 2: Implement pause/resume for long analyses
Phase 3: Add data branching to ObjectStore
```

**Expected impact:** +5-10% accuracy from reduced execution failures

---



| Current Flow | BixBench Mode |
|--------------|---------------|
| PI Agent → Pipeline → Review (3 agents) | Direct Pipeline execution (1 agent) |
| Multiple conferral points | Single execution, verify against data |
| Rich provenance tracking | Minimal overhead |


---

### DEVELOPMENT PATH 3: Tool Coverage Expansion

**Goal:** Close capability gaps with Kepler and ScienceMachine

#### Tier 1: BixBench-Critical (Immediate)

| Tool | BixBench Coverage | Implementation Effort |
|------|-------------------|----------------------|
| Phylogenetics (BUSCO analysis) | ~10% of questions | HIGH - new domain |
| Variant calling interpretation | ~5% of questions | MEDIUM - extend existing |
| Image analysis (colony metrics) | ~5% of questions | HIGH - new domain |

#### Tier 2: Competitive Parity (Medium-term)

| Tool | Competitor Has | Polymer Gap |
|------|----------------|-------------|
| ChIP-seq (DiffBind, ChIPseeker) | Kepler | Not implemented |
| Flow cytometry | ScienceMachine | Not implemented |
| Mass spectrometry | ScienceMachine | Not implemented |

#### Tier 3: Differentiation (Long-term)

| Capability | Advantage |
|------------|-----------|
| BPCells (40M+ cells) | Scale beyond Kepler's 32GB |
| MAE multi-omic | Native multi-assay integration |
| Methods Observatory | Literature-backed method selection |

---

### DEVELOPMENT PATH 4: Pre-loaded Dataset Connectors

**Goal:** Match Kepler's instant data access advantage

**Kepler's pre-loaded datasets:**
1. Tahoe-100M (single-cell perturbation)
2. DepMap (cancer genomics)
3. GTEx (tissue expression)
4. CZI CELLxGENE (single-cell census)
5. OpenTargets GraphQL (target-disease)
6. HPO Terms API (phenotype ontology)

**Implementation:**
```python
class DatasetRegistry:
    """Pre-configured connectors for common datasets"""

    DATASETS = {
        "depmap": DepMapConnector,      # Priority 1: Cancer questions
        "gtex": GTExConnector,          # Priority 2: Tissue expression
        "geo": GEOConnector,            # Already implemented
        "tcga": TCGAConnector,          # Already implemented
        "cellxgene": CELLxGENEConnector, # Priority 3: Single-cell
    }

    async def get_data(self, dataset: str, query: dict) -> SEContract:
        connector = self.DATASETS[dataset]()
        return await connector.fetch(query)
```

**Expected impact:** +3-5% accuracy from faster data retrieval

---



### CONSOLIDATED ROADMAP

#### Phase 1: Quick Wins (Weeks 1-4)
- [ ] Implement BixBench-optimized mode (Path 2)
- [x] Add answer precision engineering (Path 6) ✅ January 2026
- [ ] Question classification & routing (Path 7)
- **Target: 25% accuracy** (+8% from baseline 17%)

#### Phase 2: Infrastructure (Weeks 5-12)
- [ ] Evaluate E2B/Firecracker integration (Path 1)
- [ ] Add DepMap, GTEx connectors (Path 4)
- [ ] Implement pause/resume workflows (Path 1)
- **Target: 30% accuracy** (+5% from Phase 1)

#### Phase 3: Coverage Expansion (Weeks 13-24)
- [ ] Phylogenetics tools (BUSCO analysis)
- [ ] Variant analysis interpretation
- [ ] ChIP-seq pipeline (DiffBind, ChIPseeker)
- **Target: 35% accuracy** (+5% from Phase 2, beats Kepler)

#### Phase 4: Learning System ✅ COMPLETED
- [x] Implement LearningMemory service (Path 5) ✅ January 2026
- [x] Build persistent knowledge files ✅ January 2026
- [ ] Deploy experience replay (integration pending)
- **Target: 40%+ accuracy** (continuous improvement)

---

### SUCCESS METRICS

| Metric | Baseline | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|--------|----------|---------|---------|---------|---------|
| BixBench Accuracy | 17% | 25% | 30% | 35% | 40%+ |
| Numerical precision | ~50% | 80% | 90% | 95% | 95% |
| Tool coverage | 60% | 65% | 75% | 85% | 90% |
| Learning utilization | 0% | 0% | 20% | 50% | 80% |

**Completed paths:** Path 5 (Learning System), Path 6 (Answer Precision Engineering)

---

### COMPETITIVE POSITIONING

| Phase | vs Kepler (33.4%) | vs ScienceMachine | Differentiator |
|-------|-------------------|-------------------|----------------|
| 1 | Behind | Behind | Foundation |
| 2 | Close | Behind | Infrastructure parity |
| 3 | **Ahead** | Parity | Tool coverage |
| 4 | **Ahead** | **Ahead** | Learning system (unique) |

**Ultimate moat:** Persistent learning system that no competitor has documented. Every experiment makes Polymer smarter.

---

### Agent Learning Research
- Reflexion (Verbal RL): https://arxiv.org/abs/2303.11366
- MAR Multi-Agent Reflexion: https://arxiv.org/abs/2512.20845
- Self-Improving AI Agents (Yohei Nakajima): https://yoheinakajima.com/better-ways-to-build-self-improving-ai-agents/
- Ralph Wiggum Technique: https://github.com/ghuntley/how-to-ralph-wiggum
- DORA Dynamic Reflection Optimization: https://aclanthology.org/2025.coling-main.504.pdf
- GEPA Prompt Optimization: https://o-mega.ai/articles/prompt-optimization-guide-continuously-improving-ai-agents-gepa-more
- Anthropic Prompt Best Practices: https://docs.anthropic.com/en/release-notes/system-prompts
- Self-Evaluation in AI Agents: https://galileo.ai/blog/self-evaluation-ai-agents-performance-reasoning-reflection
