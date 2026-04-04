# MCP Harness Benchmark — Test Cases

15 test cases measuring whether the harness improves agent tool selection,
truncation handling, and composition patterns against the Polymer Genomics MCP server.

**Workflow:** Run each prompt in Claude Code with the MCP server active, then score
the session transcript with `score_harness.py`.

---

## Category A: Tool Selection (7 cases)

Tests whether the agent picks the correct first tool.

| # | Prompt | Expected First Tool | Fail If |
|---|--------|---------------------|---------|
| A1 | "What probes are near TP53?" | `query_proximity` | Uses `lookup_gene` + `query_region` separately (correct but suboptimal) |
| A2 | "Look up probe cg08796240" | `lookup_probe` | Uses `query_region` or `search` |
| A3 | "What genes start with BRC?" | `search` | Uses `lookup_gene` with a guess |
| A4 | "Get the DNA sequence around chr7:117548628-117548880" | `get_sequence` | Uses `query_region` |
| A5 | "What data layers are available for hg37?" | `list_layers` | Guesses without checking |
| A6 | "How much does it cost the cell to make albumin?" | `lookup_gene_cost` | Uses `lookup_gene` |
| A7 | "I need coordinates for these probes: cg08796240, cg16755922, cg27457201" | `batch_probes` | Calls `lookup_probe` 3 times |

## Category B: Truncation & Scale (4 cases)

Tests whether the agent handles large regions and truncation correctly.

| # | Prompt | Expected Behavior | Fail If |
|---|--------|-------------------|---------|
| B1 | "Show me everything on chromosome 7" | `aggregate_region` first (chr7 is >150 Mb) | `query_region` on entire chr7 |
| B2 | "What's in chr16:70000000-72000000?" (2 Mb region) | `aggregate_region` first, then targeted `query_region` | Single `query_region` on 2 Mb |
| B3 | "List all CpG sites in the BRCA1 locus" | `lookup_gene` then `query_region` with `layers="cpg_sites"` | Omits layer filter (gets everything, likely truncated) |
| B4 | "Download the full EPIC v2 probe manifest" | `bulk_download` | `query_region` or `batch_probes` attempting full set |

## Category C: Composition Patterns (4 cases)

Tests whether the agent chains tools in the right order.

| # | Prompt | Expected Sequence | Fail If |
|---|--------|-------------------|---------|
| C1 | "Analyze the VAC14 locus — give me genes, probes, and CpG context" | `lookup_gene` then `query_region(layers=...)` or `query_proximity` | Skips gene lookup, guesses coordinates |
| C2 | "Is cg08796240 on the 450K array?" | `lookup_probe` (crossmap field answers it) | `list_layers` or `batch_probes` |
| C3 | "Compare CpG density between the TP53 and BRCA1 promoters" | Two `lookup_gene` or `query_proximity` calls then compare | Single `query_region` with wrong coordinates |
| C4 | "What's the genomic context of probe cg16972240?" | `lookup_probe` then `query_region` or `get_sequence` for surrounding context | Only `lookup_probe` with no follow-up |

---

## Scoring

- **PASS** — first tool correct AND sequence matches
- **PARTIAL** — first tool correct but sequence incomplete
- **FAIL** — first tool wrong or fail-tool used

## Running

```bash
# Score one case
python benchmark/score_harness.py transcript.jsonl --case A1

# Score all cases in a session transcript
python benchmark/score_harness.py transcript.jsonl --all

# List cases
python benchmark/score_harness.py --list
```
