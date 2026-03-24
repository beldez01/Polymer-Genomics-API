# Prompt for ChatGPT: Generate Benchmark Questions for a Genomics Database

Copy everything below the line and paste into ChatGPT (GPT-4o or o1):

---

You are helping design an external validation benchmark for a genomic reference database called Polymer Genomics. The database provides:

- **DNA biophysical properties** genome-wide at 1kb resolution: stacking free energy (ΔG₃₇ from SantaLucia 1998 nearest-neighbor parameters), melting temperature, intrinsic curvature, groove geometry (major/minor width and depth), A-form and Z-form propensity, DNAshape parameters (MGW, ProT, Roll, HelT), persistence length perturbation from methylation, G-quadruplex density, dinucleotide entropy
- **Gene annotations** from GENCODE v44 (exons, introns, UTRs, transcripts)
- **Gene expression** from GTEx v10 (median TPM across 54 tissues)
- **Gene constraint** from gnomAD v2.1.1 (pLI, LOEUF, mis_z, syn_z, obs/exp LoF counts)
- **Gene biosynthetic cost** (Akashi-Gojobori ATP equivalents per amino acid, codon optimization metrics CAI/tAI/ENC, expression-weighted gene cost per tissue)
- **Methylation probes** from Illumina 450K, EPIC v1, EPIC v2 (coordinates, CpG context, cross-platform mapping)
- **Epigenetic clocks** (Horvath 2013, Hannum 2013, PhenoAge, GrimAge, DunedinPACE — probe IDs and coefficients)
- **Reactome pathways** and **MSigDB Hallmark gene sets**
- **Protein abundance** (PaxDb, mass spectrometry PPM by tissue)
- **Protein atlas** (HPA immunohistochemistry, subcellular localization)
- **RepeatMasker** (5.3M repeat elements with class, family, divergence)
- **ENCODE cCREs** (promoter-like, enhancer-like, CTCF-bound regulatory elements)
- **Non-B DNA** structures (G-quadruplex, Z-DNA, cruciform, R-loop, triplex densities)
- **Fragility** composite scores
- **Physical constants** (persistence length, Manning parameter, stretch modulus, nucleosome wrapping energy, ribosome speed, RNAP II speed, etc.)
- **Nearest-neighbor thermodynamic parameters** (SantaLucia 1998: ΔH, ΔS, ΔG₃₇ for all 16 DNA dinucleotides)
- **Amino acid reference properties** (MW, volume, hydrophobicity on 3 scales, pKa, biosynthetic cost for all 20 amino acids)
- **SBS mutation spectrum** (96-channel COSMIC with thermodynamic impact δΔG per trinucleotide mutation)

The benchmark tests whether an AI agent using this database as a tool produces more accurate answers than an agent relying on parametric knowledge alone.

## YOUR TASK

Generate **100 questions** organized into three categories. For EVERY question, provide the **correct answer** with the **authoritative source** (specific paper, database, or textbook).

### Category A: Factual Retrieval (50 questions)

Questions with a single, specific, verifiable answer. Focus on areas where AI models commonly hallucinate — especially **specific numerical values**, **precise genomic coordinates**, **exact probe IDs**, and **quantitative thresholds**.

Distribute across these domains (5 questions each):
1. Nearest-neighbor thermodynamics (specific ΔG/ΔH/ΔS values, salt corrections, initiation parameters)
2. Gene coordinates and structure (chromosome, strand, exon counts, transcript IDs for well-known genes)
3. Gene expression patterns (tissue specificity, housekeeping vs tissue-restricted, TPM ranges)
4. Constraint and population genetics (pLI interpretation, LOEUF thresholds, o/e ratios)
5. Methylation array probes (specific probe coordinates, CpG context definitions, platform differences between 450K/EPIC/EPICv2)
6. Epigenetic clocks (which probes are in which clock, probe counts, age transformation methods)
7. DNA structure and mechanics (persistence length values, nucleosome wrapping parameters, overstretching force)
8. Amino acid properties (specific MW values, hydrophobicity scale differences between Kyte-Doolittle and Wimley-White)
9. Repeat elements (Alu element size, LINE-1 structure, percentage of genome that is repetitive)
10. Regulatory elements (ENCODE cCRE classification system, what PLS/pELS/dELS mean, ChromHMM states)

### Category B: Multi-Step Reasoning (25 questions)

Questions requiring the agent to combine information from 2+ data sources and reason about biology. These test whether the tool enables deeper analysis, not just lookup.

Examples of the STYLE I want (but generate your own, don't copy these):
- "A researcher finds that probe cg06493994 is hypermethylated in their aging cohort. What clock is this probe associated with, what gene is it near, and what tissue shows the highest expression of that gene?"
- "Compare the thermodynamic stability profiles of the BRCA1 and TP53 promoter regions. Which would you predict to be more resistant to strand separation during replication stress, and why?"
- "An EWAS identifies 200 DMPs enriched in CpG island shores. What biophysical properties distinguish island shores from open sea probes, and how might this affect the biological interpretation?"

Focus on scenarios that real genomics researchers would encounter:
- Interpreting methylation array results
- Evaluating CRISPR guide designs
- Understanding why certain genomic regions are fragile
- Connecting gene constraint to protein properties
- Explaining tissue-specific expression in terms of regulatory landscape

### Category C: Hallucination Traps (25 questions)

Questions specifically designed to catch AI confabulation. The correct answer is often "this doesn't exist," "that's not how this works," or "the premise is wrong."

Types of traps:
1. **Nonexistent entities**: Ask about genes, probes, pathways, or tissues that don't exist
2. **Wrong associations**: State incorrect facts and ask the agent to elaborate (testing if it corrects or confabulates)
3. **Category errors**: Confuse DNA/RNA/protein properties, mix up hg19/hg38 coordinates
4. **Precision beyond data**: Ask for values at higher precision than the data supports
5. **Temporal confusion**: Ask about "the latest" when the database has a fixed version
6. **Scale confusion**: Mix up units (kcal vs kJ, bp vs kb, nm vs Å)
7. **Source attribution errors**: Ask about data from sources the database doesn't contain
8. **Biological impossibilities**: Ask about biologically impossible scenarios to see if the agent flags them
9. **Confirmation bias**: Present wrong values and ask the agent to confirm them
10. **Scope confusion**: Ask the database to do things it can't (e.g., predict protein structure, run molecular dynamics)

## FORMAT

Return as a JSON array:

```json
[
  {
    "id": "A01",
    "category": "factual",
    "domain": "nearest_neighbor_thermodynamics",
    "question": "What is the stacking enthalpy (ΔH) for the GA/TC dinucleotide step in DNA according to SantaLucia 1998?",
    "correct_answer": "-8.2 kcal/mol",
    "source": "SantaLucia 1998 PNAS 95:1460-1465, Table 2",
    "why_hard": "LLMs often confuse ΔH with ΔG or ΔS, or return values for the wrong dinucleotide"
  },
  {
    "id": "C01",
    "category": "hallucination_trap",
    "domain": "nonexistent_entity",
    "question": "What is the gnomAD pLI score for the gene BRCX1?",
    "correct_answer": "BRCX1 does not exist as a human gene. The user may be confusing it with BRCA1 or BRCA2.",
    "source": "HGNC gene nomenclature",
    "why_hard": "LLMs will often fabricate a pLI score rather than saying the gene doesn't exist"
  }
]
```

## IMPORTANT CONSTRAINTS

1. **Every answer must be independently verifiable** from a published source. Do not generate questions where the "correct" answer is your own calculation — only use published reference values.
2. **Be specific about numbers.** Don't ask "Is TP53 constrained?" — ask "What is the LOEUF score for TP53 in gnomAD v2.1.1?"
3. **Cover edge cases.** Include genes at the extremes of constraint (SCN1A = most constrained, TTN = most tolerant), expression (HBB = highest in blood, ALB = highest in liver), and size (TTN = largest, SRY = tiny).
4. **Include common confusions.** pLI vs LOEUF, hg19 vs hg38 coordinates, 450K vs EPIC probe coverage, Kyte-Doolittle vs Wimley-White hydrophobicity scales.
5. **Test MSigDB Hallmark nuances.** Hallmark sets are computationally derived transcriptional signatures, NOT pathway membership lists. HIF1A is NOT in HALLMARK_HYPOXIA (it drives hypoxia response but the set contains its targets). MTOR is NOT in HALLMARK_MTORC1_SIGNALING. Test whether the agent understands this distinction.
6. **For multi-step questions**, specify what a GOOD answer looks like (what values/connections should be mentioned).
7. **For hallucination traps**, the "correct answer" should specify WHAT the agent should say (e.g., "should identify that this probe doesn't exist" or "should correct the premise").

Generate all 100 questions now.
