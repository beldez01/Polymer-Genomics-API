# Polymer BixBench Adapter

Bridges BixBench evaluation framework with Polymer's Tool Registry and R-Plumber engine.

## Overview

This adapter enables Polymer to be evaluated on the BixBench benchmark, competing directly with Claude 3.5 Sonnet's 17% accuracy on open-answer evaluation.

## Target Coverage

Based on capsule analysis (205 total questions):

| Category | Questions | Strategy |
|----------|-----------|----------|
| POLYMER_NATIVE | 44 (21.5%) | Direct tool match (DESeq2, enrichment, methylation) |
| POLYMER_CAPABLE | 47 (22.9%) | General RNA-seq capability |
| PARTIAL | 22 (10.7%) | Limited coverage |
| NO_CAPABILITY | 74 (36.1%) | Skip (phylogenetics, imaging) |

**Win condition**: 38% accuracy on 91 winnable questions = beat Claude's 17%

## Components

### QuestionParser
Parses BixBench questions into structured analysis requests:
- Task type detection (DESeq2, edgeR, limma, GO, KEGG, GSEA, methylation)
- Target metric extraction (p-value, gene count, fold change, percentage, NES)
- Parameter extraction (FDR threshold, fold change cutoff, reference levels, design formula)

### AnswerExtractor
Formats Polymer results to match BixBench expected answers:
- P-value formatting (4 decimal places or scientific notation)
- Gene counts
- Percentages
- NES scores

### PolymerBixBenchAgent
Main orchestrator connecting BixBench to Polymer's R-Plumber engine:
- Contract building from capsule data
- Tool selection based on task type
- Analysis execution via PlumberClient

### BixBenchEvaluator
Standalone evaluation runner:
- Loads dataset from HuggingFace
- Runs evaluation on selected categories
- Generates accuracy reports

## Usage

### Test Parser
```bash
cd /Users/zbb2/Desktop/Polymer/benchmarks
source bixbench/.venv/bin/activate

# Test on sample questions
python polymer_bixbench_agent.py --test

# Test specific question
python polymer_bixbench_agent.py --question "Using DESeq2..."
```

### Run Evaluation
```bash
# Run on RNA-seq questions (requires Polymer services running)
python polymer_bixbench_agent.py --evaluate --categories "RNA-seq,Differential Expression Analysis"

# Limit to first N questions
python polymer_bixbench_agent.py --evaluate --max-questions 10
```

### With BixBench Trajectory Generation
```bash
cd /Users/zbb2/Desktop/Polymer/benchmarks/bixbench
python bixbench/generate_trajectories.py --config_file bixbench/run_configuration/polymer.yaml
```

## Parser Validation Results

Tested on 81 RNA-seq questions:

**Task Type Distribution:**
- generic_de: 47 (58.0%) - uses DESeq2 by default
- deseq2: 9 (11.1%) - explicit DESeq2
- enrichment_gsea: 8 (9.9%)
- enrichment_kegg: 8 (9.9%)
- methylation: 8 (9.9%)
- enrichment_go: 1 (1.2%)

**Target Metric Distribution:**
- nes (NES scores): 24 (29.6%)
- gene_count: 12 (14.8%)
- fold_change: 11 (13.6%)
- percentage: 9 (11.1%)
- p_value: 8 (9.9%)
- correlation: 6 (7.4%)
- unknown: 11 (13.6%)

**Support Rate:** 81/81 (100%)

## Prerequisites

1. **Python 3.12+** (BixBench requirement)
2. **BixBench venv active**: `source bixbench/.venv/bin/activate`
3. **Polymer services running** (for actual evaluation):
   - R-Plumber: `cd r-engine && Rscript -e "plumber::pr_run(plumber::pr('plumber.R'), port=8002)"`
   - FastAPI: `cd backend && uvicorn app.main:app --port 8001`
4. **Docker** (for BixBench trajectory generation): `open -a Docker`

## Files

| File | Purpose |
|------|---------|
| `polymer_bixbench_agent.py` | Main adapter with parser, extractor, agent |
| `test_parser.py` | Parser validation script |
| `bixbench/run_configuration/polymer.yaml` | BixBench config for Polymer |
| `capsule_inventory.json` | Question inventory |
| `capability_analysis.json` | Capability mapping |
| `CAPSULE_ANALYSIS.md` | Coverage analysis summary |

## Next Steps

1. **Start Docker**: `open -a Docker`
2. **Pull BixBench image**: `docker pull futurehouse/bixbench:aviary-notebook-env`
3. **Start Polymer services**
4. **Run evaluation on RNA-seq subset**
5. **Analyze results and iterate**
