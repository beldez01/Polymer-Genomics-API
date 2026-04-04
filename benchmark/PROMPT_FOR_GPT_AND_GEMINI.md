# Prompts for Generating PolymerBench Questions

Copy-paste these prompts into ChatGPT and Gemini separately. Each will generate ~75 questions. You'll compile all outputs into a single master question set alongside the 150 we're writing.

---

## PROMPT FOR ChatGPT

```
I'm building a benchmark called PolymerBench to evaluate how well AI agents answer genomics questions when augmented with a curated reference database versus ungrounded. I need you to generate 75 benchmark questions across 3 tiers. 

CONTEXT — What the database contains:
- Polymer Genomics (polymerbio.org) is a 22GB curated genomic reference database with 41 layers on hg38/hg37
- UNIQUE CAPABILITIES (no other database has these):
  - Genome-wide DNA biophysical properties: stacking free energy (ΔG₃₇), melting temperature, curvature, groove geometry, form propensity — computed per dinucleotide at 1kb resolution
  - Cross-layer correlation in a single query (biophysics + methylation + TEs + expression + constraint)
  - Physics linter for DNA sequences (flags CpG islands, low stability, Z-form propensity, repeats)
  - Mutation thermodynamics (96-channel SBS spectrum with δΔG per trinucleotide context)
  - Probe-biophysics annotation (annotate EWAS hits with biophysical context)
  - Gene biosynthetic cost (ATP equivalents for protein production, tissue-weighted)
- STANDARD CAPABILITIES (also available elsewhere):
  - Gene coordinates (GENCODE v44), expression (GTEx v10 54 tissues), constraint (gnomAD v4)
  - Methylation probe annotations (450K, EPIC, EPICv2), epigenetic clock probes (6 clocks)
  - CpG islands, transposable elements, TAD domains (108 cell types), Hi-C compartments
  - Nearest-neighbor thermodynamic parameters (SantaLucia 1998)
  - Amino acid properties, DNA physical constants with citations

TIER STRUCTURE — Generate 25 questions per tier:

TIER A — GeneTuring-Compatible (25 questions):
Questions that test standard genomics knowledge retrievable from NCBI/Ensembl/UniProt. These let us benchmark against published baselines (GeneGPT scored 0.83 on GeneTuring). Categories:
- Gene location/coordinates (5 Qs)
- Gene expression patterns (5 Qs) 
- Gene constraint/conservation (5 Qs)
- Gene-pathway/gene-disease associations (5 Qs)
- Probe/array annotation (5 Qs)

For each question include: the question text, the correct answer with source, and a "why_hard" field explaining what LLMs typically get wrong.

TIER B — Polymer-Unique (25 questions):
Questions that ONLY a biophysics-aware genomic database can answer. NCBI, Ensembl, UCSC Genome Browser cannot answer these. Categories:
- DNA biophysical properties of specific regions (5 Qs) — stacking energy, curvature, melting temp
- Cross-layer reasoning (5 Qs) — combining biophysics + methylation + TEs + expression
- Mutation thermodynamics (5 Qs) — how mutations change local DNA stability
- Probe biophysical context (5 Qs) — what's the biophysical environment around a methylation probe
- Gene biosynthetic cost (5 Qs) — protein production energetics

For Tier B: the correct answer should be a specific number or fact that can only come from biophysical computation. Include which Polymer tool would answer it.

TIER C — Anti-Hallucination Traps (25 questions):
Questions designed to catch LLM hallucinations about genomics. The correct behavior is either to refuse to answer, to correct a false premise, or to flag uncertainty. Categories:
- Fabricated genes/probes (5 Qs) — ask about entities that don't exist
- Wrong coordinate/assembly claims (5 Qs) — state something incorrect and ask for confirmation
- Unit/property conflation (5 Qs) — confuse ΔH with ΔG, kcal with cal, etc.
- Clinically dangerous oversimplifications (5 Qs) — questions where a wrong answer could harm patients
- Precision beyond data (5 Qs) — ask for specificity the data can't support

For Tier C: include what the "trap" is and what a correct response looks like.

OUTPUT FORMAT for each question:
{
  "id": "GPT_A01",
  "tier": "A",
  "category": "gene_location",
  "question": "...",
  "correct_answer": "...",
  "source": "...",
  "why_hard": "...",
  "polymer_tool": "...",
  "scoring_rubric": {
    "required_values": [],
    "required_terms": []
  }
}

Return all 75 questions as a JSON array. Be specific — use real gene names, real probe IDs (cg format), real coordinates. Don't use placeholder values. Every "correct_answer" must be verifiable against a public database.
```

---

## PROMPT FOR Gemini

```
I need you to generate 75 benchmark questions for evaluating AI agents on genomics tasks. This is for a benchmark called PolymerBench that tests whether a curated genomic reference database (Polymer Genomics) improves AI agent accuracy versus ungrounded LLMs.

WHAT MAKES THIS BENCHMARK DIFFERENT:
The database being tested has unique capabilities that no other genomics resource offers:
1. Genome-wide DNA biophysical properties (stacking ΔG₃₇, melting temperature, curvature, groove geometry) computed per dinucleotide
2. A "physics linter" for DNA sequences that flags biophysical risks (CpG islands, low stability regions, Z-form propensity)
3. Cross-layer correlation between biophysics, methylation, transposable elements, gene expression, and constraint
4. 96-channel mutation thermodynamics (how each trinucleotide mutation changes DNA stability)
5. Epigenetic clock probe biophysical context (6 clocks: Horvath, Hannum, PhenoAge, GrimAge, DunedinPACE, Retro-Age)
6. Transposable element methylation analysis and probe-repeat overlap mapping
7. Gene biosynthetic cost (ATP equivalents for protein production)

It also has standard genomics reference data: GENCODE v44 genes, GTEx v10 expression (54 tissues), gnomAD v4 constraint, ClinVar, methylation probe manifests, CpG islands, TAD domains (108 cell types).

WHAT I NEED — 75 questions across 3 tiers (25 each):

TIER A (25 Qs) — Standard genomics knowledge:
Focus on questions that benchmark against GeneTuring (a published genomics QA benchmark where tool-augmented agents score 0.83 vs ungrounded LLMs at 0.12). These should be hard enough that LLMs get them wrong without tool access but easy with database access.

Subcategories (5 each): gene structure/location, tissue-specific expression, evolutionary constraint, methylation array biology, reference biochemistry (thermodynamics, amino acids, DNA mechanics)

IMPORTANT: Choose genes, probes, and regions where LLMs are known to hallucinate. Don't pick TP53 or BRCA1 (too well-known). Pick genes like SEMA6B, ZCCHC14, VAC14, RPTOR, MGRN1 — real genes that are less famous and where LLMs are more likely to confabulate.

TIER B (25 Qs) — Biophysics and cross-layer reasoning:
Questions that CANNOT be answered by NCBI, Ensembl, or any existing genomics database. Only a database with material-channel DNA properties can answer these.

Subcategories (5 each):
- "What is the biophysical context of region X?" — requires computing stacking energy, curvature, groove width for a specific locus
- "Compare the biophysical stability of region A vs region B" — requires computing and comparing
- "Why might this CpG island resist methylation?" — requires reasoning about thermodynamics + structure
- "What's the mutation thermodynamic impact of X>Y in context Z?" — requires SBS spectrum lookup
- "Rank these probes by their biophysical environment" — requires cross-referencing probes with computed biophysics

TIER C (25 Qs) — Anti-hallucination and safety:
Questions where LLMs confidently give wrong answers about genomics. The correct response requires either:
- Refusing to answer (fabricated entity)
- Correcting a false premise
- Providing appropriate uncertainty
- Citing a specific source

Subcategories (5 each):
- Fabricated genomics entities (fake gene names, fake probe IDs, fake pathways)
- False premises (state something wrong and ask the agent to build on it)
- Precision beyond data resolution (ask for individual-level data from population-level resources)
- Source attribution traps (attribute a finding to the wrong paper/database)
- Clinically dangerous simplifications (questions where a simplified answer could mislead clinical decisions)

FORMAT for each question:
{
  "id": "GEM_A01",
  "tier": "A|B|C",
  "category": "descriptive_category_name",
  "question": "The full question text",
  "correct_answer": "The verified correct answer with specific values",
  "source": "The authoritative source for the answer",
  "why_hard": "Why LLMs typically get this wrong",
  "trap_type": "(Tier C only) What the trap is",
  "polymer_tool": "Which Polymer tool answers this (or 'none' for Tier C traps)",
  "scoring_rubric": {
    "required_values": ["specific numbers that must appear"],
    "required_terms": ["specific terms that must appear"]
  }
}

CRITICAL REQUIREMENTS:
1. Every correct_answer must be VERIFIABLE against a real public database (NCBI, Ensembl, GTEx, gnomAD, etc.)
2. Use REAL gene names, REAL probe IDs (cg followed by 8 digits), REAL genomic coordinates
3. For Tier B, the correct answers should reference specific biophysical quantities (ΔG in kcal/mol, Tm in °C, curvature in degrees, etc.) — you can describe what the computation would return even if you don't have access to the database
4. For Tier C, clearly state what the TRAP is and what a CORRECT response looks like
5. Don't use the most famous genes (TP53, BRCA1, EGFR) for Tier A — use less common genes where LLMs are more likely to hallucinate
6. Each question should be answerable in 1-3 sentences — no essays

Return all 75 questions as a JSON array.
```

---

## INSTRUCTIONS FOR COMPILING

After you get responses from both ChatGPT and Gemini:

1. Save ChatGPT output as `benchmark/questions_chatgpt.json`
2. Save Gemini output as `benchmark/questions_gemini.json`
3. Send both files back to me (Claude) — I will:
   - Merge with our 150 questions
   - Deduplicate and remove low-quality questions
   - Verify all ground-truth answers against the Polymer API
   - Assign difficulty levels
   - Create the 40/60 public/private split
   - Build the final `polymerbench_v3_questions.json`

Target: ~200-250 total questions after dedup (our 150 + ~50-75 unique from GPT/Gemini).

---

## KEY DIFFERENCES BETWEEN THE PROMPTS

| Aspect | ChatGPT Prompt | Gemini Prompt |
|--------|---------------|---------------|
| Gene selection | Open (likely picks famous genes) | Guided toward less-common genes (SEMA6B, VAC14) |
| Tier B framing | Tool-centric (which Polymer tool) | Reasoning-centric (why/how questions) |
| Tier C focus | Category-based traps | Scenario-based traps |
| Format | Minimal rubric | Includes trap_type field |

This ensures complementary coverage rather than duplicate questions.
